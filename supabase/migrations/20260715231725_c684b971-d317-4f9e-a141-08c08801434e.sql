
DO $$
DECLARE
  owner_uid uuid := '102072e4-b1ef-4e8d-8ab4-bfe6d35f929d';
  ev_id uuid := '00000000-0000-0000-0000-0000cafe0002';
  free_type uuid := '00000000-0000-0000-0000-0000cafe0003';
  paid_type uuid := '00000000-0000-0000-0000-0000cafe0004';
  paid_order uuid := '00000000-0000-0000-0000-0000cafe0005';
BEGIN
  DELETE FROM public.ticket_attendees WHERE event_id = ev_id;
  DELETE FROM public.ticket_orders WHERE event_id = ev_id;
  DELETE FROM public.ticket_types WHERE event_id = ev_id;
  DELETE FROM public.events WHERE id = ev_id;

  INSERT INTO public.events (id, owner_id, name, event_type, event_date, tickets_enabled, status)
  VALUES (ev_id, owner_uid, 'RPC concurrency test', 'Test', CURRENT_DATE + 30, true, 'draft');

  INSERT INTO public.ticket_types (id, event_id, name, price_cents, quantity, max_per_order, is_active)
  VALUES (free_type, ev_id, 'Free capped', 0, 5, 1, true);

  INSERT INTO public.ticket_types (id, event_id, name, price_cents, quantity, max_per_order, is_active)
  VALUES (paid_type, ev_id, 'Paid', 10000, 100, 5, true);

  INSERT INTO public.ticket_orders (id, event_id, ticket_type_id, buyer_name, buyer_email,
                                    quantity, amount_cents, currency, status,
                                    stripe_payment_intent, finalized_at)
  VALUES (paid_order, ev_id, paid_type, 'Buyer', 'buyer@test.local',
          1, 10000, 'usd', 'paid', 'pi_test_concurrency', now());
END $$;
