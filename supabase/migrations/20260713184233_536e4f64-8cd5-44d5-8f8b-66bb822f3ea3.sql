
-- ============ ENUMS ============
CREATE TYPE public.booking_stage AS ENUM (
  'saved','contacted','consultation_scheduled','quote_sent',
  'quote_under_review','contract_sent','contract_signed',
  'deposit_paid','booked','completed','review_requested','reviewed'
);

CREATE TYPE public.booking_confirmation_rule AS ENUM (
  'contract_only','deposit_only','contract_and_deposit','manual'
);

-- ============ vendor_booking_settings ============
CREATE TABLE public.vendor_booking_settings (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  confirmation_rule public.booking_confirmation_rule NOT NULL DEFAULT 'contract_and_deposit',
  requires_deposit boolean NOT NULL DEFAULT true,
  auto_advance boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_booking_settings TO authenticated;
GRANT ALL ON public.vendor_booking_settings TO service_role;
ALTER TABLE public.vendor_booking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors manage own settings"
  ON public.vendor_booking_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid()));

CREATE POLICY "planners can read vendor settings"
  ON public.vendor_booking_settings FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_vbs_updated
  BEFORE UPDATE ON public.vendor_booking_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ vendor_bookings ============
CREATE TABLE public.vendor_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  title text NOT NULL,
  category text NOT NULL,
  current_stage public.booking_stage NOT NULL DEFAULT 'saved',
  quote_amount numeric(12,2),
  deposit_amount numeric(12,2),
  deposit_paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_paid numeric(12,2) NOT NULL DEFAULT 0,
  quote_sent_at timestamptz,
  contract_sent_at timestamptz,
  contract_signed_at timestamptz,
  deposit_paid_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vb_planner ON public.vendor_bookings(planner_id);
CREATE INDEX idx_vb_vendor  ON public.vendor_bookings(vendor_id);
CREATE INDEX idx_vb_event   ON public.vendor_bookings(event_id);
CREATE INDEX idx_vb_stage   ON public.vendor_bookings(current_stage);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_bookings TO authenticated;
GRANT ALL ON public.vendor_bookings TO service_role;
ALTER TABLE public.vendor_bookings ENABLE ROW LEVEL SECURITY;

-- helper: is caller party to this booking?
CREATE OR REPLACE FUNCTION public.is_booking_party(_booking_id uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_bookings b
    LEFT JOIN public.vendor_profiles vp ON vp.id = b.vendor_id
    WHERE b.id = _booking_id
      AND (b.planner_id = _user OR vp.user_id = _user)
  );
$$;

CREATE POLICY "booking parties select"
  ON public.vendor_bookings FOR SELECT TO authenticated
  USING (
    planner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid())
  );

CREATE POLICY "planner inserts booking"
  ON public.vendor_bookings FOR INSERT TO authenticated
  WITH CHECK (planner_id = auth.uid() AND created_by = auth.uid());

CREATE POLICY "booking parties update"
  ON public.vendor_bookings FOR UPDATE TO authenticated
  USING (
    planner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid())
  );

CREATE POLICY "planner deletes booking"
  ON public.vendor_bookings FOR DELETE TO authenticated
  USING (planner_id = auth.uid());

CREATE TRIGGER trg_vb_updated
  BEFORE UPDATE ON public.vendor_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ vendor_booking_events ============
CREATE TABLE public.vendor_booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.vendor_bookings(id) ON DELETE CASCADE,
  stage public.booking_stage NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vbe_booking ON public.vendor_booking_events(booking_id, occurred_at DESC);

GRANT SELECT, INSERT ON public.vendor_booking_events TO authenticated;
GRANT ALL ON public.vendor_booking_events TO service_role;
ALTER TABLE public.vendor_booking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties read events"
  ON public.vendor_booking_events FOR SELECT TO authenticated
  USING (public.is_booking_party(booking_id, auth.uid()));

CREATE POLICY "parties insert events"
  ON public.vendor_booking_events FOR INSERT TO authenticated
  WITH CHECK (public.is_booking_party(booking_id, auth.uid()));

-- ============ Confirmation trigger ============
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

  -- update flags from stage
  IF NEW.stage = 'quote_sent'      AND b.quote_sent_at      IS NULL THEN UPDATE public.vendor_bookings SET quote_sent_at = NEW.occurred_at, current_stage = NEW.stage WHERE id = b.id; END IF;
  IF NEW.stage = 'contract_sent'   AND b.contract_sent_at   IS NULL THEN UPDATE public.vendor_bookings SET contract_sent_at = NEW.occurred_at, current_stage = NEW.stage WHERE id = b.id; END IF;
  IF NEW.stage = 'contract_signed' AND b.contract_signed_at IS NULL THEN UPDATE public.vendor_bookings SET contract_signed_at = NEW.occurred_at, current_stage = NEW.stage WHERE id = b.id; END IF;
  IF NEW.stage = 'deposit_paid'    AND b.deposit_paid_at    IS NULL THEN UPDATE public.vendor_bookings SET deposit_paid_at = NEW.occurred_at, current_stage = NEW.stage WHERE id = b.id; END IF;
  IF NEW.stage = 'completed'       AND b.completed_at       IS NULL THEN UPDATE public.vendor_bookings SET completed_at = NEW.occurred_at, current_stage = NEW.stage WHERE id = b.id; END IF;

  -- for non-book, non-flag stages just bump current_stage forward
  IF NEW.stage NOT IN ('booked') THEN
    UPDATE public.vendor_bookings
       SET current_stage = NEW.stage
     WHERE id = b.id
       AND public.event_role_rank IS NOT NULL -- placeholder to keep search_path aware
       AND (NEW.stage::text <> 'saved');
  END IF;

  -- refresh b
  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;

  -- Evaluate auto-book only when trigger event is contract_signed or deposit_paid
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

  -- Notifications for both parties
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

CREATE TRIGGER trg_vbe_apply_rule
  AFTER INSERT ON public.vendor_booking_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_apply_confirmation_rule();

-- Backfill settings for existing vendor profiles
INSERT INTO public.vendor_booking_settings (vendor_id)
SELECT id FROM public.vendor_profiles
ON CONFLICT (vendor_id) DO NOTHING;
