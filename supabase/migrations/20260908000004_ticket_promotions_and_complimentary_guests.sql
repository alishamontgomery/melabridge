ALTER TABLE public.ticket_types
  ADD COLUMN IF NOT EXISTS early_bird_price_cents integer,
  ADD COLUMN IF NOT EXISTS early_bird_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_discount_percent integer;

ALTER TABLE public.ticket_types
  DROP CONSTRAINT IF EXISTS ticket_types_early_bird_price_check,
  ADD CONSTRAINT ticket_types_early_bird_price_check
    CHECK (early_bird_price_cents IS NULL OR early_bird_price_cents >= 0),
  DROP CONSTRAINT IF EXISTS ticket_types_early_bird_before_regular_check,
  ADD CONSTRAINT ticket_types_early_bird_before_regular_check
    CHECK (early_bird_price_cents IS NULL OR early_bird_price_cents < price_cents),
  DROP CONSTRAINT IF EXISTS ticket_types_promo_discount_check,
  ADD CONSTRAINT ticket_types_promo_discount_check
    CHECK (promo_discount_percent IS NULL OR promo_discount_percent BETWEEN 1 AND 100);

CREATE OR REPLACE FUNCTION public.create_complimentary_ticket(
  _event_id uuid,
  _ticket_type_id uuid,
  _guest_name text,
  _guest_email text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_id uuid;
  ticket public.ticket_types%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = _event_id AND owner_id = public.current_app_user_id()
  ) THEN
    RAISE EXCEPTION 'Only the event owner can add complimentary guests';
  END IF;

  SELECT * INTO ticket FROM public.ticket_types
  WHERE id = _ticket_type_id AND event_id = _event_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket type not found'; END IF;
  IF ticket.quantity IS NOT NULL AND ticket.sold_count >= ticket.quantity THEN
    RAISE EXCEPTION 'This ticket type is sold out';
  END IF;

  INSERT INTO public.ticket_orders (
    event_id, ticket_type_id, buyer_name, buyer_email, quantity,
    amount_cents, currency, status, finalized_at
  ) VALUES (
    _event_id, _ticket_type_id, btrim(_guest_name), lower(btrim(_guest_email)), 1,
    0, ticket.currency, 'paid', now()
  ) RETURNING id INTO order_id;

  INSERT INTO public.ticket_attendees (order_id, event_id, full_name, email)
  VALUES (order_id, _event_id, btrim(_guest_name), lower(btrim(_guest_email)));

  UPDATE public.ticket_types SET sold_count = sold_count + 1 WHERE id = _ticket_type_id;
  RETURN order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_complimentary_ticket(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_complimentary_ticket(uuid, uuid, text, text) TO authenticated;