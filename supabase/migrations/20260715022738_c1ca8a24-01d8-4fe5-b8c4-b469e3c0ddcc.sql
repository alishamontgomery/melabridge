ALTER TABLE public.ticket_types
  ADD COLUMN IF NOT EXISTS max_per_order integer NOT NULL DEFAULT 10 CHECK (max_per_order BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','unlisted')),
  ADD COLUMN IF NOT EXISTS promo_code text;

CREATE INDEX IF NOT EXISTS idx_ticket_attendees_qr ON public.ticket_attendees (qr_code);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_event ON public.ticket_orders (event_id, status);