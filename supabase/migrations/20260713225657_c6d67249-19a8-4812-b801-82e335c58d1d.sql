
-- Enums
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft','sent','partial','paid','overdue','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_schedule_status AS ENUM ('pending','paid','overdue','waived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Invoices
CREATE TABLE IF NOT EXISTS public.booking_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.vendor_bookings(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  amount numeric(12,2) NOT NULL,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  due_date date,
  issued_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, invoice_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_invoices TO authenticated;
GRANT ALL ON public.booking_invoices TO service_role;
ALTER TABLE public.booking_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking parties can view invoices"
  ON public.booking_invoices FOR SELECT TO authenticated
  USING (public.is_booking_party(booking_id, auth.uid()));
CREATE POLICY "Booking parties can insert invoices"
  ON public.booking_invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_booking_party(booking_id, auth.uid()));
CREATE POLICY "Booking parties can update invoices"
  ON public.booking_invoices FOR UPDATE TO authenticated
  USING (public.is_booking_party(booking_id, auth.uid()));
CREATE POLICY "Booking parties can delete invoices"
  ON public.booking_invoices FOR DELETE TO authenticated
  USING (public.is_booking_party(booking_id, auth.uid()));

CREATE TRIGGER trg_booking_invoices_updated_at
BEFORE UPDATE ON public.booking_invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Payment schedule
CREATE TABLE IF NOT EXISTS public.booking_payment_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.vendor_bookings(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric(12,2) NOT NULL,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date,
  status public.payment_schedule_status NOT NULL DEFAULT 'pending',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_payment_schedule TO authenticated;
GRANT ALL ON public.booking_payment_schedule TO service_role;
ALTER TABLE public.booking_payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking parties can view schedule"
  ON public.booking_payment_schedule FOR SELECT TO authenticated
  USING (public.is_booking_party(booking_id, auth.uid()));
CREATE POLICY "Booking parties can insert schedule"
  ON public.booking_payment_schedule FOR INSERT TO authenticated
  WITH CHECK (public.is_booking_party(booking_id, auth.uid()));
CREATE POLICY "Booking parties can update schedule"
  ON public.booking_payment_schedule FOR UPDATE TO authenticated
  USING (public.is_booking_party(booking_id, auth.uid()));
CREATE POLICY "Booking parties can delete schedule"
  ON public.booking_payment_schedule FOR DELETE TO authenticated
  USING (public.is_booking_party(booking_id, auth.uid()));

CREATE TRIGGER trg_booking_payment_schedule_updated_at
BEFORE UPDATE ON public.booking_payment_schedule
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-generate invoice + schedule on booked
CREATE OR REPLACE FUNCTION public.fn_generate_booking_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev_date date;
  dep numeric(12,2);
  bal numeric(12,2);
  inv_no text;
BEGIN
  IF NEW.current_stage = 'booked' AND (OLD.current_stage IS DISTINCT FROM 'booked') THEN
    IF EXISTS (SELECT 1 FROM public.booking_invoices WHERE booking_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    inv_no := 'INV-' || to_char(now(), 'YYYYMM') || '-' || substr(NEW.id::text, 1, 6);
    SELECT event_date INTO ev_date FROM public.events WHERE id = NEW.event_id;

    INSERT INTO public.booking_invoices (booking_id, invoice_number, amount, status, due_date, notes)
    VALUES (NEW.id, inv_no, COALESCE(NEW.quote_amount, 0), 'sent',
            COALESCE(ev_date - INTERVAL '14 days', now() + INTERVAL '7 days')::date,
            'Auto-generated on booking confirmation.');

    dep := COALESCE(NEW.deposit_amount, ROUND(COALESCE(NEW.quote_amount, 0) * 0.25, 2));
    bal := GREATEST(COALESCE(NEW.quote_amount, 0) - dep, 0);

    IF dep > 0 THEN
      INSERT INTO public.booking_payment_schedule (booking_id, label, amount, paid_amount, due_date, status, sort_order)
      VALUES (NEW.id, 'Deposit', dep,
              LEAST(COALESCE(NEW.deposit_paid_amount, 0), dep),
              CURRENT_DATE,
              CASE WHEN COALESCE(NEW.deposit_paid_amount, 0) >= dep THEN 'paid'::payment_schedule_status ELSE 'pending'::payment_schedule_status END,
              1);
    END IF;
    IF bal > 0 THEN
      INSERT INTO public.booking_payment_schedule (booking_id, label, amount, due_date, status, sort_order)
      VALUES (NEW.id, 'Final balance', bal,
              COALESCE(ev_date - INTERVAL '14 days', now() + INTERVAL '30 days')::date,
              'pending', 2);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_generate_booking_invoice() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_generate_booking_invoice ON public.vendor_bookings;
CREATE TRIGGER trg_generate_booking_invoice
AFTER UPDATE OF current_stage ON public.vendor_bookings
FOR EACH ROW EXECUTE FUNCTION public.fn_generate_booking_invoice();

-- Realtime
ALTER TABLE public.booking_invoices REPLICA IDENTITY FULL;
ALTER TABLE public.booking_payment_schedule REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_invoices; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_payment_schedule; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
