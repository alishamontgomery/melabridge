-- Keep paid ticket fulfillment atomic and reject capacity over-allocation.
CREATE OR REPLACE FUNCTION public.finalize_paid_ticket_order(
  _order_id uuid,
  _payment_intent text DEFAULT NULL
)
RETURNS TABLE(claimed boolean, event_id uuid, ticket_type_id uuid, quantity int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o public.ticket_orders%ROWTYPE;
  t public.ticket_types%ROWTYPE;
BEGIN
  IF _order_id IS NULL THEN
    RAISE EXCEPTION 'Order id required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO o
  FROM public.ticket_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF o.status <> 'pending' THEN
    RETURN QUERY SELECT false, o.event_id, o.ticket_type_id, o.quantity;
    RETURN;
  END IF;

  SELECT * INTO t
  FROM public.ticket_types
  WHERE id = o.ticket_type_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket type not found' USING ERRCODE = 'P0002';
  END IF;

  IF t.quantity IS NOT NULL AND COALESCE(t.sold_count, 0) + o.quantity > t.quantity THEN
    RAISE EXCEPTION 'Ticket capacity exceeded' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ticket_orders
     SET status = 'paid',
         finalized_at = now(),
         stripe_payment_intent = COALESCE(_payment_intent, stripe_payment_intent)
   WHERE id = o.id;

  INSERT INTO public.ticket_attendees (order_id, event_id, full_name, email)
  SELECT o.id, o.event_id,
         CASE WHEN i = 1 THEN o.buyer_name ELSE NULL END,
         CASE WHEN i = 1 THEN o.buyer_email ELSE NULL END
  FROM generate_series(1, o.quantity) AS i;

  UPDATE public.ticket_types
     SET sold_count = COALESCE(sold_count, 0) + o.quantity
   WHERE id = o.ticket_type_id;

  RETURN QUERY SELECT true, o.event_id, o.ticket_type_id, o.quantity;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_paid_ticket_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_paid_ticket_order(uuid, text) TO service_role;