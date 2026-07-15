-- 1. Add tickets_enabled to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tickets_enabled boolean NOT NULL DEFAULT false;

-- Auto-enable for ticketed event types
UPDATE public.events
SET tickets_enabled = true
WHERE tickets_enabled = false
  AND event_type IN ('Conference','Festival','Fundraiser','Community','Gala','Concert','Workshop');

-- 2. ticket_types
CREATE TABLE public.ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  quantity integer,
  sold_count integer NOT NULL DEFAULT 0,
  sales_start timestamptz,
  sales_end timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_types_event ON public.ticket_types(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_types TO authenticated;
GRANT SELECT ON public.ticket_types TO anon;
GRANT ALL ON public.ticket_types TO service_role;

ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;

-- Anyone can read active types for events with ticketing enabled (public buy page)
CREATE POLICY "Public can view active ticket types"
  ON public.ticket_types FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.tickets_enabled = true AND e.deleted_at IS NULL
    )
  );

-- Owners/editors can manage
CREATE POLICY "Event members can view all ticket types"
  ON public.ticket_types FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_members m
      WHERE m.event_id = ticket_types.event_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Event owners can insert ticket types"
  ON public.ticket_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid())
  );

CREATE POLICY "Event owners can update ticket types"
  ON public.ticket_types FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()));

CREATE POLICY "Event owners can delete ticket types"
  ON public.ticket_types FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()));

CREATE TRIGGER tg_ticket_types_updated_at
  BEFORE UPDATE ON public.ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. ticket_orders
CREATE TABLE public.ticket_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id) ON DELETE RESTRICT,
  buyer_name text,
  buyer_email text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending',
  stripe_session_id text,
  stripe_payment_intent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_orders_event ON public.ticket_orders(event_id);
CREATE INDEX idx_ticket_orders_type ON public.ticket_orders(ticket_type_id);
CREATE INDEX idx_ticket_orders_session ON public.ticket_orders(stripe_session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_orders TO authenticated;
GRANT ALL ON public.ticket_orders TO service_role;

ALTER TABLE public.ticket_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event owners can view orders"
  ON public.ticket_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_members m
      WHERE m.event_id = ticket_orders.event_id AND m.user_id = auth.uid()
    )
  );

-- Inserts/updates come from server-side (service_role) via Stripe webhook / checkout server fn.

CREATE TRIGGER tg_ticket_orders_updated_at
  BEFORE UPDATE ON public.ticket_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. ticket_attendees
CREATE TABLE public.ticket_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.ticket_orders(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  full_name text,
  email text,
  qr_code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_attendees_order ON public.ticket_attendees(order_id);
CREATE INDEX idx_ticket_attendees_event ON public.ticket_attendees(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_attendees TO authenticated;
GRANT ALL ON public.ticket_attendees TO service_role;

ALTER TABLE public.ticket_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event owners can view attendees"
  ON public.ticket_attendees FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_members m
      WHERE m.event_id = ticket_attendees.event_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Event owners can check in attendees"
  ON public.ticket_attendees FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()));