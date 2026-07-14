-- 1) Deterministic stage computation from timestamps + event window + confirmation rule.
CREATE OR REPLACE FUNCTION public.fn_compute_booking_stage(_booking_id uuid)
RETURNS public.booking_stage
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  b public.vendor_bookings%ROWTYPE;
  rule public.booking_confirmation_rule;
  requires_dep boolean;
  ev_start timestamptz;
  ev_end   timestamptz;
  ev record;
  is_booked boolean := false;
BEGIN
  SELECT * INTO b FROM public.vendor_bookings WHERE id = _booking_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Terminal / exception states win.
  IF b.cancelled_at IS NOT NULL THEN RETURN 'cancelled'; END IF;
  IF b.lost_at IS NOT NULL THEN RETURN 'lost'; END IF;
  IF b.no_response_at IS NOT NULL THEN RETURN 'no_response'; END IF;

  -- Post-delivery states.
  IF b.reviewed_at IS NOT NULL THEN RETURN 'reviewed'; END IF;
  IF b.review_requested_at IS NOT NULL THEN RETURN 'review_requested'; END IF;

  -- Compute confirmation ("booked") based on the vendor's rule.
  SELECT s.confirmation_rule, s.requires_deposit INTO rule, requires_dep
    FROM public.vendor_booking_settings s WHERE s.vendor_id = b.vendor_id;
  IF rule IS NULL THEN rule := 'contract_and_deposit'; requires_dep := true; END IF;

  IF b.confirmed_at IS NOT NULL THEN
    is_booked := true;
  ELSIF rule = 'contract_only' AND b.contract_signed_at IS NOT NULL THEN
    is_booked := true;
  ELSIF rule = 'deposit_only' AND b.deposit_paid_at IS NOT NULL THEN
    is_booked := true;
  ELSIF rule = 'contract_and_deposit'
        AND b.contract_signed_at IS NOT NULL
        AND (NOT requires_dep OR b.deposit_paid_at IS NOT NULL) THEN
    is_booked := true;
  END IF;

  -- Time-based transitions after booked: in_progress / completed.
  IF b.event_id IS NOT NULL THEN
    SELECT e.event_date, e.event_time, e.end_time INTO ev
      FROM public.events e WHERE e.id = b.event_id;
    IF FOUND AND ev.event_date IS NOT NULL THEN
      ev_start := (ev.event_date::text || ' ' || COALESCE(ev.event_time, '00:00'))::timestamptz;
      ev_end   := (ev.event_date::text || ' ' || COALESCE(ev.end_time, ev.event_time, '23:59'))::timestamptz;
      IF ev.end_time IS NULL AND ev.event_time IS NOT NULL THEN
        ev_end := ev_start + interval '4 hours';
      END IF;
    END IF;
  END IF;

  IF b.completed_at IS NOT NULL OR (ev_end IS NOT NULL AND now() >= ev_end AND is_booked) THEN
    RETURN 'completed';
  END IF;
  IF is_booked AND ev_start IS NOT NULL AND now() >= ev_start THEN
    RETURN 'in_progress';
  END IF;
  IF is_booked THEN RETURN 'booked'; END IF;

  IF b.deposit_paid_at IS NOT NULL THEN RETURN 'deposit_paid'; END IF;
  IF b.contract_signed_at IS NOT NULL THEN RETURN 'contract_signed'; END IF;
  IF b.contract_sent_at IS NOT NULL THEN RETURN 'contract_sent'; END IF;
  IF b.quote_accepted_at IS NOT NULL THEN RETURN 'quote_accepted'; END IF;
  IF b.quote_viewed_at IS NOT NULL THEN RETURN 'quote_viewed'; END IF;
  IF b.quote_sent_at IS NOT NULL THEN RETURN 'quote_sent'; END IF;

  -- Any activity at all means at least "contacted"; otherwise keep the initial "saved".
  IF EXISTS (SELECT 1 FROM public.vendor_booking_events WHERE booking_id = b.id) THEN
    RETURN 'contacted';
  END IF;
  RETURN COALESCE(b.current_stage, 'saved');
END;
$$;

-- 2) Recompute + log-on-change helper.
CREATE OR REPLACE FUNCTION public.fn_recompute_booking_stage(_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur public.booking_stage;
  next public.booking_stage;
BEGIN
  SELECT current_stage INTO cur FROM public.vendor_bookings WHERE id = _booking_id;
  IF cur IS NULL THEN RETURN; END IF;

  next := public.fn_compute_booking_stage(_booking_id);
  IF next IS NOT NULL AND next <> cur THEN
    UPDATE public.vendor_bookings SET current_stage = next WHERE id = _booking_id;
    -- Log the transition unless the identical stage was just logged (avoid noise from cascading triggers).
    IF NOT EXISTS (
      SELECT 1 FROM public.vendor_booking_events
      WHERE booking_id = _booking_id
        AND stage = next
        AND occurred_at > now() - interval '5 seconds'
    ) THEN
      INSERT INTO public.vendor_booking_events (booking_id, stage, actor_id, note)
      VALUES (_booking_id, next, NULL, 'Auto: stage recomputed from actions');
    END IF;
  END IF;
END;
$$;

-- 3) Extend the existing per-event handler to stamp every timestamp column,
--    then hand off to recompute. Fan-out (calendar/notifications) is preserved.
CREATE OR REPLACE FUNCTION public.fn_apply_confirmation_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.vendor_bookings%ROWTYPE;
  rule public.booking_confirmation_rule;
  requires_dep boolean;
  vendor_uid uuid;
  should_book boolean := false;
  preview text;
  evt record;
  ev_start timestamptz;
  ev_end   timestamptz;
BEGIN
  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Stamp per-stage timestamps (idempotent).
  IF NEW.stage = 'quote_sent'         AND b.quote_sent_at         IS NULL THEN UPDATE public.vendor_bookings SET quote_sent_at         = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'quote_viewed'       AND b.quote_viewed_at       IS NULL THEN UPDATE public.vendor_bookings SET quote_viewed_at       = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'quote_accepted'     AND b.quote_accepted_at     IS NULL THEN UPDATE public.vendor_bookings SET quote_accepted_at     = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'contract_sent'      AND b.contract_sent_at      IS NULL THEN UPDATE public.vendor_bookings SET contract_sent_at      = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'contract_signed'    AND b.contract_signed_at    IS NULL THEN UPDATE public.vendor_bookings SET contract_signed_at    = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'deposit_paid'       AND b.deposit_paid_at       IS NULL THEN UPDATE public.vendor_bookings SET deposit_paid_at       = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'in_progress'        AND b.in_progress_at        IS NULL THEN UPDATE public.vendor_bookings SET in_progress_at        = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'completed'          AND b.completed_at          IS NULL THEN UPDATE public.vendor_bookings SET completed_at          = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'review_requested'   AND b.review_requested_at   IS NULL THEN UPDATE public.vendor_bookings SET review_requested_at   = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'reviewed'           AND b.reviewed_at           IS NULL THEN UPDATE public.vendor_bookings SET reviewed_at           = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'no_response'        AND b.no_response_at        IS NULL THEN UPDATE public.vendor_bookings SET no_response_at        = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'lost'               AND b.lost_at               IS NULL THEN UPDATE public.vendor_bookings SET lost_at                = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'cancelled'          AND b.cancelled_at          IS NULL THEN UPDATE public.vendor_bookings SET cancelled_at          = NEW.occurred_at WHERE id = b.id; END IF;

  -- Refresh the local copy after stamping.
  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;

  -- Legacy: still mirror confirmed_at when the rule fires.
  IF NEW.stage IN ('contract_signed','deposit_paid') AND b.confirmed_at IS NULL THEN
    SELECT s.confirmation_rule, s.requires_deposit INTO rule, requires_dep
      FROM public.vendor_booking_settings s WHERE s.vendor_id = b.vendor_id;
    IF rule IS NULL THEN rule := 'contract_and_deposit'; requires_dep := true; END IF;

    IF rule = 'contract_only' AND b.contract_signed_at IS NOT NULL THEN
      should_book := true;
    ELSIF rule = 'deposit_only' AND b.deposit_paid_at IS NOT NULL THEN
      should_book := true;
    ELSIF rule = 'contract_and_deposit'
          AND b.contract_signed_at IS NOT NULL
          AND (NOT requires_dep OR b.deposit_paid_at IS NOT NULL) THEN
      should_book := true;
    END IF;

    IF should_book THEN
      UPDATE public.vendor_bookings SET confirmed_at = now() WHERE id = b.id;
    END IF;
  END IF;

  -- Deterministic stage from all the stamps + rule + event time.
  PERFORM public.fn_recompute_booking_stage(b.id);
  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;

  SELECT vp.user_id INTO vendor_uid FROM public.vendor_profiles vp WHERE vp.id = b.vendor_id;

  -- Calendar hold on booked (unchanged).
  IF b.current_stage = 'booked' AND vendor_uid IS NOT NULL AND b.event_id IS NOT NULL THEN
    SELECT e.event_date, e.event_time, e.name, e.event_type, e.location INTO evt
      FROM public.events e WHERE e.id = b.event_id;
    IF FOUND AND evt.event_date IS NOT NULL THEN
      ev_start := (evt.event_date::text || ' ' || COALESCE(evt.event_time, '18:00'))::timestamptz;
      ev_end   := ev_start + interval '4 hours';
      IF NOT EXISTS (
        SELECT 1 FROM public.calendar_events
         WHERE vendor_id = vendor_uid AND external_id = 'booking:' || b.id::text
      ) THEN
        INSERT INTO public.calendar_events
          (vendor_id, planner_id, event_id, event_name, event_type, venue_name,
           starts_at, ends_at, setup_minutes, breakdown_minutes, status,
           checklist, attachments, team_assignments, timeline, source, external_id, revenue_amount)
        VALUES
          (vendor_uid, b.planner_id, b.event_id, COALESCE(evt.name, b.title), evt.event_type, evt.location,
           ev_start, ev_end, 60, 60, 'confirmed'::calendar_event_status,
           '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'melabridge'::calendar_event_source,
           'booking:' || b.id::text, b.quote_amount);
      END IF;
    END IF;
  END IF;

  IF NEW.stage = 'cancelled' AND vendor_uid IS NOT NULL THEN
    DELETE FROM public.calendar_events WHERE vendor_id = vendor_uid AND external_id = 'booking:' || b.id::text;
  END IF;

  preview := 'Booking "' || b.title || '" moved to ' || NEW.stage::text;

  INSERT INTO public.notifications (user_id, category, title, body, href, entity_type, entity_id)
  VALUES (b.planner_id, 'booking', 'Booking update', preview, '/bookings/' || b.id::text, 'vendor_booking', b.id);

  IF vendor_uid IS NOT NULL AND vendor_uid <> b.planner_id THEN
    INSERT INTO public.notifications (user_id, category, title, body, href, entity_type, entity_id)
    VALUES (vendor_uid, 'booking', 'Booking update', preview, '/bookings/' || b.id::text, 'vendor_booking', b.id);
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Trigger that recomputes when timestamps on the booking itself change
--    (e.g. writes coming from server code paths that update timestamps directly).
CREATE OR REPLACE FUNCTION public.fn_booking_stage_watcher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when a relevant timestamp actually changed; avoid recursion from current_stage updates.
  IF (NEW.quote_sent_at        IS DISTINCT FROM OLD.quote_sent_at)
     OR (NEW.quote_viewed_at    IS DISTINCT FROM OLD.quote_viewed_at)
     OR (NEW.quote_accepted_at  IS DISTINCT FROM OLD.quote_accepted_at)
     OR (NEW.contract_sent_at   IS DISTINCT FROM OLD.contract_sent_at)
     OR (NEW.contract_signed_at IS DISTINCT FROM OLD.contract_signed_at)
     OR (NEW.deposit_paid_at    IS DISTINCT FROM OLD.deposit_paid_at)
     OR (NEW.confirmed_at       IS DISTINCT FROM OLD.confirmed_at)
     OR (NEW.in_progress_at     IS DISTINCT FROM OLD.in_progress_at)
     OR (NEW.completed_at       IS DISTINCT FROM OLD.completed_at)
     OR (NEW.review_requested_at IS DISTINCT FROM OLD.review_requested_at)
     OR (NEW.reviewed_at        IS DISTINCT FROM OLD.reviewed_at)
     OR (NEW.cancelled_at       IS DISTINCT FROM OLD.cancelled_at)
     OR (NEW.no_response_at     IS DISTINCT FROM OLD.no_response_at)
     OR (NEW.lost_at            IS DISTINCT FROM OLD.lost_at) THEN
    PERFORM public.fn_recompute_booking_stage(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_bookings_stage_watcher ON public.vendor_bookings;
CREATE TRIGGER trg_vendor_bookings_stage_watcher
AFTER UPDATE ON public.vendor_bookings
FOR EACH ROW EXECUTE FUNCTION public.fn_booking_stage_watcher();

-- Ensure the event-driven trigger is bound (it may already exist under this name).
DROP TRIGGER IF EXISTS trg_vendor_booking_events_apply_rule ON public.vendor_booking_events;
CREATE TRIGGER trg_vendor_booking_events_apply_rule
AFTER INSERT ON public.vendor_booking_events
FOR EACH ROW EXECUTE FUNCTION public.fn_apply_confirmation_rule();

REVOKE EXECUTE ON FUNCTION public.fn_compute_booking_stage(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_recompute_booking_stage(uuid) FROM anon, authenticated;

-- 5) Scheduled recompute for time-based transitions (in_progress / completed).
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.fn_recompute_time_based_stages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT b.id
    FROM public.vendor_bookings b
    LEFT JOIN public.events e ON e.id = b.event_id
    WHERE b.cancelled_at IS NULL
      AND b.lost_at IS NULL
      AND b.no_response_at IS NULL
      AND b.current_stage NOT IN ('reviewed','review_requested','completed','saved','cancelled','lost','no_response')
      AND (
        e.event_date IS NULL
        OR e.event_date BETWEEN (CURRENT_DATE - INTERVAL '3 days') AND (CURRENT_DATE + INTERVAL '1 day')
      )
  LOOP
    PERFORM public.fn_recompute_booking_stage(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_recompute_time_based_stages() FROM anon, authenticated;

SELECT cron.unschedule('recompute-booking-stages')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recompute-booking-stages');

SELECT cron.schedule(
  'recompute-booking-stages',
  '*/15 * * * *',
  $cron$ SELECT public.fn_recompute_time_based_stages(); $cron$
);