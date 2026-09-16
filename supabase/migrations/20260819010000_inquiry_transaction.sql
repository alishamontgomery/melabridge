-- Vendor inquiry: single atomic, idempotent submission path.
--
-- Replaces the previous read-then-insert + compensating-delete flow in the
-- server function with one SECURITY DEFINER RPC that:
--   * validates the auth.uid() caller has an inquiring role
--     (personal / organization / admin), via user_roles or profiles.account_type,
--   * validates the target vendor exists and is public/onboarded,
--   * blocks self-inquiry,
--   * validates the event date is today or later,
--   * validates input lengths,
--   * creates the vendor_bookings lead + calendar_booking_requests row atomically,
--   * is idempotent under concurrent retries via a deterministic idempotency_key
--     and a unique index over non-null keys.
--
-- Terminology note: the vendor-side row is the "request"; the planner-side
-- vendor_bookings row is the "lead". This RPC preserves that lead-only language.
--
-- calendar_booking_requests.vendor_id references auth.users(id) and therefore
-- stores the vendor's USER id. This RPC standardizes on the vendor user id and
-- accepts the vendor_profiles.id as its argument, resolving the user id itself.
--
-- This migration is idempotent (safe to re-run) and locks down search_path and
-- EXECUTE grants on the RPC.

-- ---------------------------------------------------------------------------
-- 1) Idempotency key column + uniqueness on non-null keys only.
--
--    A composite partial index over historical columns would fail to install if
--    production already holds duplicate active requests. Instead we add a
--    nullable idempotency_key column and enforce uniqueness ONLY on non-null
--    keys. Every existing/historical row keeps a NULL key and is therefore
--    exempt — no back-fill, no status mutation, install is always safe.
--
--    The RPC stamps a deterministic key on every NEW request it creates, so
--    concurrent retries of the same logical inquiry collide on this unique index
--    and collapse via unique_violation. Historical rows are still honoured by the
--    RPC's precheck (which matches on the natural columns), so idempotency holds
--    for pre-existing inquiries even though they carry no key.
-- ---------------------------------------------------------------------------
ALTER TABLE public.calendar_booking_requests
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cbr_idempotency_key
  ON public.calendar_booking_requests (idempotency_key)
  WHERE idempotency_key IS NOT NULL
    AND status IN ('pending', 'alternate_proposed', 'approved');

-- ---------------------------------------------------------------------------
-- 2) The atomic inquiry RPC.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_vendor_inquiry(
  p_vendor_profile_id uuid,
  p_event_name        text,
  p_event_date        date,
  p_event_type        text DEFAULT NULL,
  p_message           text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller        uuid := auth.uid();
  v_can_inquire   boolean;
  v_vendor        record;
  v_event_name    text;
  v_event_type    text;
  v_message       text;
  v_start         timestamptz;
  v_end           timestamptz;
  v_existing      uuid;
  v_booking_id    uuid;
  v_request_id    uuid;
  v_idem_key      text;
BEGIN
  -- Caller must be authenticated.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Caller role: personal / organization / admin, from user_roles or profiles.
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_caller
        AND ur.role IN ('personal'::public.app_role,
                        'organization'::public.app_role,
                        'admin'::public.app_role)
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = v_caller
        AND p.account_type IN ('personal', 'organization', 'admin')
    )
  INTO v_can_inquire;

  IF NOT v_can_inquire THEN
    RAISE EXCEPTION 'This account cannot submit vendor inquiries' USING ERRCODE = '42501';
  END IF;

  -- Validate + normalize input lengths.
  v_event_name := btrim(COALESCE(p_event_name, ''));
  IF length(v_event_name) < 1 THEN
    RAISE EXCEPTION 'Event name is required' USING ERRCODE = '22023';
  END IF;
  IF length(v_event_name) > 200 THEN
    RAISE EXCEPTION 'Event name is too long' USING ERRCODE = '22023';
  END IF;

  v_event_type := NULLIF(btrim(COALESCE(p_event_type, '')), '');
  IF v_event_type IS NOT NULL AND length(v_event_type) > 100 THEN
    v_event_type := left(v_event_type, 100);
  END IF;

  v_message := NULLIF(btrim(COALESCE(p_message, '')), '');
  IF v_message IS NOT NULL AND length(v_message) > 2000 THEN
    RAISE EXCEPTION 'Message is too long' USING ERRCODE = '22023';
  END IF;

  -- Validate the event date is today or later (UTC calendar day).
  IF p_event_date IS NULL THEN
    RAISE EXCEPTION 'Invalid event date' USING ERRCODE = '22007';
  END IF;
  IF p_event_date < (now() AT TIME ZONE 'UTC')::date THEN
    RAISE EXCEPTION 'Event date must be today or later' USING ERRCODE = '22007';
  END IF;

  -- Fixed inquiry window mirrors the previous server logic (12:00Z–20:00Z).
  v_start := (p_event_date::text || 'T12:00:00Z')::timestamptz;
  v_end   := (p_event_date::text || 'T20:00:00Z')::timestamptz;

  -- Resolve + validate the vendor. Must exist and be public/onboarded.
  SELECT vp.id, vp.user_id, vp.business_category, vp.onboarding_completed
    INTO v_vendor
  FROM public.vendor_profiles vp
  WHERE vp.id = p_vendor_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_vendor.onboarding_completed IS NOT TRUE THEN
    RAISE EXCEPTION 'Vendor is not accepting inquiries yet' USING ERRCODE = '42501';
  END IF;

  -- No self-inquiry.
  IF v_vendor.user_id = v_caller THEN
    RAISE EXCEPTION 'You cannot submit an inquiry to your own profile' USING ERRCODE = '42501';
  END IF;

  -- Deterministic idempotency key from the normalized natural identity of the
  -- inquiry: vendor user id, planner id, lower(event name), and start instant.
  -- The same logical inquiry always hashes to the same key, so concurrent
  -- retries collide on uq_cbr_idempotency_key. md5 is a core built-in — no
  -- pgcrypto extension dependency — and collision-safe enough for a dedupe key.
  v_idem_key := md5(
    v_vendor.user_id::text || '|' ||
    v_caller::text || '|' ||
    lower(v_event_name) || '|' ||
    v_start::text
  );

  -- Precheck (covers both keyed new rows AND historical NULL-key rows): if an
  -- active request already exists for this natural identity, return it instead
  -- of duplicating.
  SELECT cbr.id
    INTO v_existing
  FROM public.calendar_booking_requests cbr
  WHERE cbr.vendor_id = v_vendor.user_id
    AND cbr.planner_id = v_caller
    AND cbr.event_name = v_event_name
    AND cbr.requested_start = v_start
    AND cbr.status IN ('pending', 'alternate_proposed', 'approved')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('duplicate', true, 'request_id', v_existing);
  END IF;

  -- Atomic creation: lead (planner-side vendor_bookings) + vendor-side request.
  INSERT INTO public.vendor_bookings (
    planner_id, vendor_id, title, category, current_stage, created_by
  ) VALUES (
    v_caller,
    v_vendor.id,                          -- vendor_bookings.vendor_id -> vendor_profiles.id
    v_event_name,
    COALESCE(v_vendor.business_category, 'General'),
    'contacted'::public.booking_stage,
    v_caller
  )
  RETURNING id INTO v_booking_id;

  BEGIN
    INSERT INTO public.calendar_booking_requests (
      vendor_id, planner_id, event_name, event_type,
      requested_start, requested_end, message, status, idempotency_key
    ) VALUES (
      v_vendor.user_id,                   -- calendar_booking_requests.vendor_id -> auth.users(id)
      v_caller,
      v_event_name,
      v_event_type,
      v_start,
      v_end,
      v_message,
      'pending'::public.calendar_request_status,
      v_idem_key
    )
    RETURNING id INTO v_request_id;
  EXCEPTION WHEN unique_violation THEN
    -- A concurrent NEW retry raced us to uq_cbr_idempotency_key. Roll back the
    -- lead we just created (it belongs to this same aborted attempt) and return
    -- the winning request — looked up by the shared deterministic key — as a
    -- duplicate. Atomic and idempotent under concurrency, no client-side
    -- compensating delete.
    DELETE FROM public.vendor_bookings WHERE id = v_booking_id;

    SELECT cbr.id
      INTO v_existing
    FROM public.calendar_booking_requests cbr
    WHERE cbr.idempotency_key = v_idem_key
    LIMIT 1;

    RETURN jsonb_build_object('duplicate', true, 'request_id', v_existing);
  END;

  RETURN jsonb_build_object(
    'duplicate', false,
    'booking_id', v_booking_id,
    'request_id', v_request_id,
    'vendor_user_id', v_vendor.user_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Lock down the RPC: explicit search_path (set above) + EXECUTE grants.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.submit_vendor_inquiry(uuid, text, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_vendor_inquiry(uuid, text, date, text, text)
  TO authenticated, service_role;
