-- Check-in tokens: time-limited, revocable tokens that let event staff
-- scan tickets without needing the organizer's login.

CREATE TABLE IF NOT EXISTS public.checkin_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,   -- SHA-256 of the plain token
  label       TEXT,                          -- optional human name, e.g. "Door Staff"
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  revoked_at  TIMESTAMPTZ,
  created_by  UUID        NOT NULL,          -- auth.users.id of the organizer
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organizer reads their own event's tokens
CREATE POLICY "owner can read own checkin_tokens"
  ON public.checkin_tokens FOR SELECT
  USING (
    public.current_app_user_id() = created_by
    OR public.current_app_user_id() IN (
      SELECT owner_id FROM public.events WHERE id = event_id
    )
  );

-- Organizer creates tokens for their own events
CREATE POLICY "owner can insert checkin_tokens"
  ON public.checkin_tokens FOR INSERT
  WITH CHECK (
    public.current_app_user_id() = created_by
    AND public.current_app_user_id() IN (
      SELECT owner_id FROM public.events WHERE id = event_id
    )
  );

-- Server-side revocation uses the service-role key (bypasses RLS).
-- No direct UPDATE policy is granted to authenticated users at all,
-- so there is no path for a client to mutate any column via RLS.

-- Belt-and-suspenders: a trigger makes event_id, token_hash, and
-- created_by completely immutable regardless of who calls UPDATE.
CREATE OR REPLACE FUNCTION public.checkin_tokens_immutable_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_id    IS DISTINCT FROM OLD.event_id    OR
     NEW.token_hash  IS DISTINCT FROM OLD.token_hash  OR
     NEW.created_by  IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'checkin_tokens: event_id, token_hash, and created_by are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER checkin_tokens_immutable_cols_trigger
  BEFORE UPDATE ON public.checkin_tokens
  FOR EACH ROW EXECUTE FUNCTION public.checkin_tokens_immutable_cols();

ALTER TABLE public.checkin_tokens ENABLE ROW LEVEL SECURITY;
