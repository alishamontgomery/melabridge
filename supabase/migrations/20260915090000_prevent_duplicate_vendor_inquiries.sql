-- A planner may have only one active inquiry with a vendor at a time.
-- Keep this check inside the existing atomic RPC so concurrent submissions
-- cannot bypass it.
CREATE OR REPLACE FUNCTION public.submit_vendor_inquiry(
  p_vendor_profile_id uuid,
  p_event_name text,
  p_event_date date,
  p_event_type text DEFAULT NULL,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_can_inquire boolean;
  v_vendor record;
  v_event_name text := btrim(COALESCE(p_event_name, ''));
  v_event_type text := NULLIF(btrim(COALESCE(p_event_type, '')), '');
  v_message text := NULLIF(btrim(COALESCE(p_message, '')), '');
  v_start timestamptz;
  v_end timestamptz;
  v_idem_key text;
  v_existing uuid;
  v_booking_id uuid;
  v_request_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

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

  IF v_event_name = '' THEN
    RAISE EXCEPTION 'Event name is required' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_event_name) > 200 THEN
    RAISE EXCEPTION 'Event name is too long' USING ERRCODE = '22023';
  END IF;
  IF v_event_type IS NOT NULL AND char_length(v_event_type) > 100 THEN
    v_event_type := left(v_event_type, 100);
  END IF;
  IF v_message IS NOT NULL AND char_length(v_message) > 2000 THEN
    RAISE EXCEPTION 'Message is too long' USING ERRCODE = '22023';
  END IF;
  IF p_event_date IS NULL THEN
    RAISE EXCEPTION 'Invalid event date' USING ERRCODE = '22007';
  END IF;
  IF p_event_date < (now() AT TIME ZONE 'UTC')::date THEN
    RAISE EXCEPTION 'Event date must be today or later' USING ERRCODE = '22007';
  END IF;

  SELECT vp.id, vp.user_id, vp.business_category, vp.onboarding_completed
  INTO v_vendor
  FROM public.vendor_profiles vp
  WHERE vp.id = p_vendor_profile_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Vendor not found' USING ERRCODE = 'P0002'; END IF;
  IF COALESCE(v_vendor.onboarding_completed, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Vendor is not accepting inquiries yet' USING ERRCODE = '42501';
  END IF;
  IF v_vendor.user_id = v_caller THEN
    RAISE EXCEPTION 'You cannot submit an inquiry to your own profile' USING ERRCODE = '42501';
  END IF;

  -- Serialize inquiry creation for this planner/vendor pair. The active-row
  -- check and insert then behave atomically even when two submissions race.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_vendor.user_id::text || '|' || v_caller::text, 0)
  );

  -- Duplicate means any active request between this planner and vendor,
  -- regardless of event details.
  SELECT cbr.id INTO v_existing
  FROM public.calendar_booking_requests cbr
  WHERE cbr.vendor_id = v_vendor.user_id
    AND cbr.planner_id = v_caller
    AND cbr.status IN ('pending', 'alternate_proposed', 'approved')
  ORDER BY cbr.created_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('duplicate', true, 'request_id', v_existing);
  END IF;

  -- Preserve the established inquiry window used by availability workflows.
  v_start := (p_event_date::text || 'T12:00:00Z')::timestamptz;
  v_end := (p_event_date::text || 'T20:00:00Z')::timestamptz;
  -- The unique index is partial to active statuses, so this pair key can be
  -- reused after an inquiry is cancelled or declined.
  v_idem_key := md5(v_vendor.user_id::text || '|' || v_caller::text);

  INSERT INTO public.vendor_bookings (
    planner_id, vendor_id, title, category, current_stage, created_by
  ) VALUES (
    v_caller, v_vendor.id, v_event_name,
    COALESCE(v_vendor.business_category, 'General'),
    'contacted'::public.booking_stage, v_caller
  )
  RETURNING id INTO v_booking_id;

  BEGIN
    INSERT INTO public.calendar_booking_requests (
      vendor_id, planner_id, event_name, event_type,
      requested_start, requested_end, message, status, idempotency_key
    ) VALUES (
      v_vendor.user_id, v_caller, v_event_name, v_event_type,
      v_start, v_end, v_message, 'pending'::public.calendar_request_status, v_idem_key
    )
    RETURNING id INTO v_request_id;
  EXCEPTION WHEN unique_violation THEN
    DELETE FROM public.vendor_bookings WHERE id = v_booking_id;
    SELECT cbr.id INTO v_existing
    FROM public.calendar_booking_requests cbr
    WHERE cbr.vendor_id = v_vendor.user_id
      AND cbr.planner_id = v_caller
      AND cbr.status IN ('pending', 'alternate_proposed', 'approved')
    ORDER BY cbr.created_at DESC
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

REVOKE ALL ON FUNCTION public.submit_vendor_inquiry(uuid, text, date, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_vendor_inquiry(uuid, text, date, text, text)
  TO authenticated;