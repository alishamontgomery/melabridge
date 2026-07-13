
CREATE OR REPLACE FUNCTION public.fn_apply_confirmation_rule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.vendor_bookings%ROWTYPE;
  rule public.booking_confirmation_rule;
  requires_dep boolean;
  vendor_uid uuid;
  should_book boolean := false;
  preview text;
BEGIN
  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.stage = 'quote_sent'      AND b.quote_sent_at      IS NULL THEN UPDATE public.vendor_bookings SET quote_sent_at = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'contract_sent'   AND b.contract_sent_at   IS NULL THEN UPDATE public.vendor_bookings SET contract_sent_at = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'contract_signed' AND b.contract_signed_at IS NULL THEN UPDATE public.vendor_bookings SET contract_signed_at = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'deposit_paid'    AND b.deposit_paid_at    IS NULL THEN UPDATE public.vendor_bookings SET deposit_paid_at = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'completed'       AND b.completed_at       IS NULL THEN UPDATE public.vendor_bookings SET completed_at = NEW.occurred_at WHERE id = b.id; END IF;

  IF NEW.stage <> 'booked' THEN
    UPDATE public.vendor_bookings SET current_stage = NEW.stage WHERE id = b.id;
  END IF;

  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;

  IF NEW.stage IN ('contract_signed','deposit_paid') AND b.confirmed_at IS NULL THEN
    SELECT s.confirmation_rule, s.requires_deposit
      INTO rule, requires_dep
      FROM public.vendor_booking_settings s
      WHERE s.vendor_id = b.vendor_id;

    IF rule IS NULL THEN rule := 'contract_and_deposit'; requires_dep := true; END IF;

    IF rule = 'contract_only' AND b.contract_signed_at IS NOT NULL THEN
      should_book := true;
    ELSIF rule = 'deposit_only' AND b.deposit_paid_at IS NOT NULL THEN
      should_book := true;
    ELSIF rule = 'contract_and_deposit' THEN
      IF b.contract_signed_at IS NOT NULL AND (NOT requires_dep OR b.deposit_paid_at IS NOT NULL) THEN
        should_book := true;
      END IF;
    END IF;

    IF should_book THEN
      UPDATE public.vendor_bookings
         SET current_stage = 'booked', confirmed_at = now()
       WHERE id = b.id;
      INSERT INTO public.vendor_booking_events (booking_id, stage, actor_id, note)
      VALUES (b.id, 'booked', NULL, 'Auto-confirmed by rule: ' || rule::text);
    END IF;
  END IF;

  SELECT vp.user_id INTO vendor_uid FROM public.vendor_profiles vp WHERE vp.id = b.vendor_id;
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

REVOKE ALL ON FUNCTION public.fn_apply_confirmation_rule() FROM PUBLIC, anon, authenticated;
