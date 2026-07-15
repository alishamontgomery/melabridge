
-- Atomic free-ticket claim: locks the ticket type, validates capacity/window,
-- creates the order + attendees, and bumps sold_count in one transaction.
CREATE OR REPLACE FUNCTION public.claim_free_tickets(
  _ticket_type_id uuid,
  _buyer_name text,
  _buyer_email text,
  _quantity int,
  _promo_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.ticket_types%ROWTYPE;
  new_order_id uuid;
BEGIN
  IF _quantity IS NULL OR _quantity < 1 THEN
    RAISE EXCEPTION 'Invalid quantity' USING ERRCODE = '22023';
  END IF;
  IF _buyer_email IS NULL OR length(btrim(_buyer_email)) = 0 THEN
    RAISE EXCEPTION 'Buyer email required' USING ERRCODE = '22023';
  END IF;

  -- Row-lock the ticket type to serialize concurrent claims.
  SELECT * INTO t
  FROM public.ticket_types
  WHERE id = _ticket_type_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket type not found' USING ERRCODE = 'P0002';
  END IF;
  IF t.price_cents <> 0 THEN
    RAISE EXCEPTION 'Not a free ticket type' USING ERRCODE = '22023';
  END IF;
  IF NOT t.is_active THEN
    RAISE EXCEPTION 'This ticket is no longer available.' USING ERRCODE = '22023';
  END IF;
  IF t.sales_start IS NOT NULL AND t.sales_start > now() THEN
    RAISE EXCEPTION 'Sales have not started yet.' USING ERRCODE = '22023';
  END IF;
  IF t.sales_end IS NOT NULL AND t.sales_end < now() THEN
    RAISE EXCEPTION 'Sales have ended.' USING ERRCODE = '22023';
  END IF;
  IF _quantity > COALESCE(t.max_per_order, 10) THEN
    RAISE EXCEPTION 'Over per-order limit' USING ERRCODE = '22023';
  END IF;
  IF t.quantity IS NOT NULL AND (t.sold_count + _quantity) > t.quantity THEN
    RAISE EXCEPTION 'Not enough tickets remaining.' USING ERRCODE = '22023';
  END IF;
  IF t.promo_code IS NOT NULL
     AND upper(coalesce(btrim(_promo_code), '')) <> upper(t.promo_code) THEN
    RAISE EXCEPTION 'Promo code required.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ticket_orders
    (event_id, ticket_type_id, buyer_name, buyer_email, quantity,
     amount_cents, currency, status, finalized_at)
  VALUES
    (t.event_id, t.id, _buyer_name, lower(btrim(_buyer_email)), _quantity,
     0, t.currency, 'paid', now())
  RETURNING id INTO new_order_id;

  INSERT INTO public.ticket_attendees (order_id, event_id, full_name, email)
  SELECT new_order_id, t.event_id,
         CASE WHEN i = 1 THEN _buyer_name ELSE NULL END,
         CASE WHEN i = 1 THEN lower(btrim(_buyer_email)) ELSE NULL END
  FROM generate_series(1, _quantity) AS i;

  UPDATE public.ticket_types
     SET sold_count = sold_count + _quantity
   WHERE id = t.id;

  RETURN new_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_free_tickets(uuid, text, text, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_free_tickets(uuid, text, text, int, text) TO service_role;

-- Atomic refund apply: locks the order + type, updates refund state,
-- and on full refund decrements inventory + clears non-checked-in attendees.
-- Called AFTER a successful Stripe refund (or immediately for free orders).
CREATE OR REPLACE FUNCTION public.apply_ticket_refund(
  _order_id uuid,
  _refund_delta_cents int,
  _reason text DEFAULT NULL
)
RETURNS TABLE(refund_amount_cents int, status text, released boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.ticket_orders%ROWTYPE;
  new_refunded int;
  is_full boolean;
BEGIN
  IF _refund_delta_cents IS NULL OR _refund_delta_cents < 1 THEN
    RAISE EXCEPTION 'Refund amount must be positive' USING ERRCODE = '22023';
  END IF;

  -- Lock the order row for the duration of the transaction.
  SELECT * INTO o
  FROM public.ticket_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;
  IF o.status NOT IN ('paid', 'partially_refunded') THEN
    RAISE EXCEPTION 'Only paid orders can be refunded' USING ERRCODE = '22023';
  END IF;

  new_refunded := COALESCE(o.refund_amount_cents, 0) + _refund_delta_cents;
  IF new_refunded > COALESCE(o.amount_cents, 0) AND COALESCE(o.amount_cents, 0) > 0 THEN
    RAISE EXCEPTION 'Refund exceeds order amount' USING ERRCODE = '22023';
  END IF;
  is_full := new_refunded >= COALESCE(o.amount_cents, 0);

  UPDATE public.ticket_orders
     SET refund_amount_cents = new_refunded,
         refund_reason = COALESCE(_reason, refund_reason),
         refunded_at = now(),
         status = CASE WHEN is_full THEN 'refunded' ELSE 'partially_refunded' END
   WHERE id = o.id;

  IF is_full THEN
    -- Lock the type row before touching inventory.
    PERFORM 1 FROM public.ticket_types WHERE id = o.ticket_type_id FOR UPDATE;
    UPDATE public.ticket_types
       SET sold_count = GREATEST(0, sold_count - o.quantity)
     WHERE id = o.ticket_type_id;
    DELETE FROM public.ticket_attendees
     WHERE order_id = o.id AND checked_in_at IS NULL;
  END IF;

  RETURN QUERY SELECT new_refunded,
    (CASE WHEN is_full THEN 'refunded' ELSE 'partially_refunded' END)::text,
    is_full;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_ticket_refund(uuid, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_ticket_refund(uuid, int, text) TO service_role;
