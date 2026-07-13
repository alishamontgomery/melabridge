
-- Overlap prevention on calendar_events for a vendor
CREATE OR REPLACE FUNCTION public.fn_prevent_calendar_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  IF NEW.vendor_id IS NULL OR NEW.starts_at IS NULL OR NEW.ends_at IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.calendar_events c
    WHERE c.vendor_id = NEW.vendor_id
      AND c.id <> NEW.id
      AND c.status <> 'cancelled'
      AND tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'calendar_overlap: vendor % already has an event overlapping % - %', NEW.vendor_id, NEW.starts_at, NEW.ends_at
      USING ERRCODE = 'exclusion_violation';
  END IF;

  -- Respect blocked dates
  IF EXISTS (
    SELECT 1 FROM public.calendar_blocked_dates b
    WHERE b.vendor_id = NEW.vendor_id
      AND daterange(b.start_date, b.end_date, '[]') && daterange(NEW.starts_at::date, NEW.ends_at::date, '[]')
  ) THEN
    RAISE EXCEPTION 'calendar_blocked: vendor % has blocked dates in this range', NEW.vendor_id
      USING ERRCODE = 'exclusion_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_calendar_overlap ON public.calendar_events;
CREATE TRIGGER trg_prevent_calendar_overlap
BEFORE INSERT OR UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_calendar_overlap();

-- Enable realtime for calendar_events, vendor_bookings, vendor_booking_events, notifications
ALTER TABLE public.calendar_events REPLICA IDENTITY FULL;
ALTER TABLE public.vendor_bookings REPLICA IDENTITY FULL;
ALTER TABLE public.vendor_booking_events REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_bookings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_booking_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
