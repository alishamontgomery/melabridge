
CREATE TYPE public.calendar_provider AS ENUM ('google', 'outlook');
CREATE TYPE public.calendar_sync_direction AS ENUM ('push', 'pull', 'two_way');

CREATE TABLE public.calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.calendar_provider NOT NULL,
  external_account_email TEXT,
  external_calendar_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,
  sync_direction public.calendar_sync_direction NOT NULL DEFAULT 'two_way',
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_connections TO authenticated;
GRANT ALL ON public.calendar_connections TO service_role;

ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view calendar connections" ON public.calendar_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert calendar connections" ON public.calendar_connections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update calendar connections" ON public.calendar_connections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete calendar connections" ON public.calendar_connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_calendar_connections_updated
  BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.calendar_sync_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  provider public.calendar_provider NOT NULL,
  external_event_id TEXT NOT NULL,
  external_etag TEXT,
  last_pushed_at TIMESTAMPTZ,
  last_pulled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, provider)
);

CREATE INDEX calendar_sync_map_user_idx ON public.calendar_sync_map(user_id, provider);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_sync_map TO authenticated;
GRANT ALL ON public.calendar_sync_map TO service_role;

ALTER TABLE public.calendar_sync_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view sync map" ON public.calendar_sync_map
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert sync map" ON public.calendar_sync_map
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update sync map" ON public.calendar_sync_map
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete sync map" ON public.calendar_sync_map
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_calendar_sync_map_updated
  BEFORE UPDATE ON public.calendar_sync_map
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ics_token TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS profiles_ics_token_idx ON public.profiles(ics_token) WHERE ics_token IS NOT NULL;
