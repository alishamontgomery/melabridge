#!/usr/bin/env bash
# Concurrency test for the atomic ticket RPCs.
#
# Verifies:
#   1. claim_free_tickets never oversells a capped ticket type under parallel load.
#   2. apply_ticket_refund never over-refunds an order under parallel load.
#   3. finalize_paid_ticket_order never oversells a capped ticket type under
#      parallel load, and a capacity rejection remains retryable.
#
# Requires exec-based Supabase DB access ($PGHOST etc). The RPCs are
# SECURITY DEFINER with EXECUTE granted only to service_role, but psql
# connects as the superuser so it can invoke them directly.
#
# The script creates an isolated fixture event using the first auth user in the
# database. The fixed IDs make cleanup and repeat runs deterministic:
#   events.id      = ...cafe0002
#   ticket_types.id = ...cafe0003  (free, quantity=5, max_per_order=1)
#   ticket_types.id = ...cafe0004  (paid, normally quantity=100)
#   ticket_orders.id = ...cafe0005 (paid, amount_cents=10000)
#
# Run: bash scripts/test-ticket-rpc-concurrency.sh
set -euo pipefail

TEST_EVENT=00000000-0000-0000-0000-0000cafe0002
FREE_TYPE=00000000-0000-0000-0000-0000cafe0003
PAID_TYPE=00000000-0000-0000-0000-0000cafe0004
PAID_ORDER=00000000-0000-0000-0000-0000cafe0005
PAID_ORDER_RETRY=00000000-0000-0000-0000-0000cafe0006
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Seed the fixture instead of relying on the historical seed migration. That
# migration is followed by a cleanup migration in the normal schema history.
OWNER_ID=$(psql -tAc "select id from auth.users order by created_at limit 1")
[[ -n "$OWNER_ID" ]] || {
  echo "FAIL: test requires at least one auth.users row to own the fixture event"
  exit 1
}
psql -q -v ON_ERROR_STOP=1 -c "delete from public.ticket_attendees where event_id='$TEST_EVENT';
                               delete from public.ticket_orders where event_id='$TEST_EVENT';
                               delete from public.ticket_types where event_id='$TEST_EVENT';
                               delete from public.events where id='$TEST_EVENT';
                               insert into public.events
                                 (id, owner_id, name, event_type, event_date, tickets_enabled, status)
                               values
                                 ('$TEST_EVENT', '$OWNER_ID', 'RPC concurrency test', 'Test',
                                  current_date + 30, true, 'draft');
                               insert into public.ticket_types
                                 (id, event_id, name, price_cents, quantity, max_per_order, is_active)
                               values
                                 ('$FREE_TYPE', '$TEST_EVENT', 'Free capped', 0, 5, 1, true),
                                 ('$PAID_TYPE', '$TEST_EVENT', 'Paid capped', 10000, 100, 5, true);
                               insert into public.ticket_orders
                                 (id, event_id, ticket_type_id, buyer_name, buyer_email, quantity,
                                  amount_cents, currency, status, stripe_payment_intent, finalized_at)
                               values
                                 ('$PAID_ORDER', '$TEST_EVENT', '$PAID_TYPE', 'Buyer',
                                  'buyer@test.local', 1, 10000, 'usd', 'paid',
                                  'pi_test_concurrency', now());" >/dev/null

echo "== Test 1: 20 parallel claim_free_tickets on capacity=5 =="
for i in $(seq 1 20); do
  ( psql -tAc "select public.claim_free_tickets('$FREE_TYPE'::uuid,'B$i','buyer$i@t.local',1,null)" \
      >"$TMP/claim_$i.out" 2>&1 ) &
done
# Capacity rejections are expected for 15 of the 20 calls.
wait || true
ok=$(grep -l '^[0-9a-f-]\{36\}$' "$TMP"/claim_*.out | wc -l)
sold=$(psql -tAc "select sold_count from public.ticket_types where id='$FREE_TYPE'")
orders=$(psql -tAc "select count(*) from public.ticket_orders where ticket_type_id='$FREE_TYPE'")
att=$(psql -tAc "select count(*) from public.ticket_attendees where order_id in (select id from public.ticket_orders where ticket_type_id='$FREE_TYPE')")
echo "  succeeded=$ok  sold_count=$sold  orders=$orders  attendees=$att  (expected 5/5/5/5)"
[[ "$ok" -eq 5 && "$sold" -eq 5 && "$orders" -eq 5 && "$att" -eq 5 ]] \
  || { echo "FAIL: claim_free_tickets partial state"; exit 1; }

echo "== Test 2: 30 parallel apply_ticket_refund of 500c on 10000c order =="
for i in $(seq 1 30); do
  ( psql -tAc "select refund_amount_cents from public.apply_ticket_refund('$PAID_ORDER'::uuid,500,'concurrent')" \
      >"$TMP/refund_$i.out" 2>&1 ) &
done
# Once the order is fully refunded, further refund attempts are expected to
# fail rather than mutate the order.
wait || true
refunded=$(psql -tAc "select refund_amount_cents from public.ticket_orders where id='$PAID_ORDER'")
status=$(psql -tAc "select status from public.ticket_orders where id='$PAID_ORDER'")
echo "  refunded_cents=$refunded  status=$status  (expected 10000/refunded)"
[[ "$refunded" -eq 10000 && "$status" = "refunded" ]] \
  || { echo "FAIL: apply_ticket_refund partial state"; exit 1; }

echo "== Test 3: 2 parallel paid finalizations on capacity=1 =="
# Use two fresh pending orders for the seeded paid type. The two RPC calls
# contend on the same ticket_types row; exactly one can commit at capacity=1.
psql -q -c "delete from public.ticket_attendees where order_id in ('$PAID_ORDER', '$PAID_ORDER_RETRY');
            delete from public.ticket_orders where id in ('$PAID_ORDER', '$PAID_ORDER_RETRY');
            update public.ticket_types set quantity=1, sold_count=0 where id='$PAID_TYPE';
            insert into public.ticket_orders
              (id, event_id, ticket_type_id, buyer_name, buyer_email, quantity,
               amount_cents, currency, status, stripe_payment_intent)
            select '$PAID_ORDER', event_id, '$PAID_TYPE', 'Buyer A',
                   'buyer-a@t.local', 1, 10000, 'usd', 'pending',
                   'pi_test_concurrency_a'
              from public.ticket_types
              where id='$PAID_TYPE';
            insert into public.ticket_orders
              (id, event_id, ticket_type_id, buyer_name, buyer_email, quantity,
               amount_cents, currency, status, stripe_payment_intent)
            select '$PAID_ORDER_RETRY', event_id, '$PAID_TYPE', 'Buyer B',
                   'buyer-b@t.local', 1, 10000, 'usd', 'pending',
                   'pi_test_concurrency_b'
              from public.ticket_types
              where id='$PAID_TYPE';" >/dev/null

for order in "$PAID_ORDER" "$PAID_ORDER_RETRY"; do
  ( psql -tAc "select * from public.finalize_paid_ticket_order('$order'::uuid,'pi_finalized_$order')" \
      >"$TMP/finalize_$order.out" 2>&1 ) &
done
wait || true

paid=$(psql -tAc "select count(*) from public.ticket_orders
                  where ticket_type_id='$PAID_TYPE' and status='paid'")
sold=$(psql -tAc "select sold_count from public.ticket_types where id='$PAID_TYPE'")
att=$(psql -tAc "select count(*) from public.ticket_attendees a
                 join public.ticket_orders o on o.id=a.order_id
                 where o.ticket_type_id='$PAID_TYPE' and o.status='paid'")
pending=$(psql -tAc "select count(*) from public.ticket_orders
                     where ticket_type_id='$PAID_TYPE' and status='pending'")
pending_att=$(psql -tAc "select count(*) from public.ticket_attendees a
                       join public.ticket_orders o on o.id=a.order_id
                       where o.ticket_type_id='$PAID_TYPE' and o.status='pending'")
echo "  paid=$paid  sold_count=$sold  attendees=$att  pending=$pending  pending_attendees=$pending_att (expected 1/1/1/1/0)"
[[ "$paid" -eq 1 && "$sold" -eq 1 && "$att" -eq 1 && "$pending" -eq 1 && "$pending_att" -eq 0 ]] \
  || { echo "FAIL: finalize_paid_ticket_order oversold or partially finalized"; exit 1; }

# A capacity rejection must leave its order pending. Release the winner's
# inventory, then retry the pending order to prove Stripe can safely redeliver
# the payment without creating duplicate or partial attendees.
winner=$(psql -tAc "select id from public.ticket_orders
                    where ticket_type_id='$PAID_TYPE' and status='paid' limit 1")
loser=$(psql -tAc "select id from public.ticket_orders
                   where ticket_type_id='$PAID_TYPE' and status='pending' limit 1")
psql -q -c "select * from public.apply_ticket_refund('$winner'::uuid,10000,'capacity retry test');" >/dev/null
psql -q -c "select * from public.finalize_paid_ticket_order('$loser'::uuid,'pi_retry_$loser');" >/dev/null

paid=$(psql -tAc "select count(*) from public.ticket_orders
                  where ticket_type_id='$PAID_TYPE' and status='paid'")
refunded=$(psql -tAc "select count(*) from public.ticket_orders
                      where ticket_type_id='$PAID_TYPE' and status='refunded'")
sold=$(psql -tAc "select sold_count from public.ticket_types where id='$PAID_TYPE'")
att=$(psql -tAc "select count(*) from public.ticket_attendees a
                 join public.ticket_orders o on o.id=a.order_id
                 where o.ticket_type_id='$PAID_TYPE' and o.status='paid'")
echo "  retry_paid=$paid  refunded=$refunded  sold_count=$sold  paid_attendees=$att (expected 1/1/1/1)"
[[ "$paid" -eq 1 && "$refunded" -eq 1 && "$sold" -eq 1 && "$att" -eq 1 ]] \
  || { echo "FAIL: rejected paid finalization was not retryable"; exit 1; }

echo "PASS"
