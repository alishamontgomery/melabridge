#!/usr/bin/env bash
# Concurrency test for the atomic ticket RPCs.
#
# Verifies:
#   1. claim_free_tickets never oversells a capped ticket type under parallel load.
#   2. apply_ticket_refund never over-refunds an order under parallel load.
#
# Requires exec-based Supabase DB access ($PGHOST etc). The RPCs are
# SECURITY DEFINER with EXECUTE granted only to service_role, but psql
# connects as the superuser so it can invoke them directly.
#
# Fixtures are assumed to be pre-seeded by the accompanying migration:
#   ticket_types.id = ...cafe0003  (free, quantity=5, max_per_order=1)
#   ticket_orders.id = ...cafe0005 (paid, amount_cents=10000)
#
# Run: bash scripts/test-ticket-rpc-concurrency.sh
set -euo pipefail

FREE_TYPE=00000000-0000-0000-0000-0000cafe0003
PAID_ORDER=00000000-0000-0000-0000-0000cafe0005
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Reset counters so the test is repeatable. Requires a migration for the
# initial fixtures; this only zeroes runtime state between runs.
psql -q -c "delete from public.ticket_attendees where order_id in (select id from public.ticket_orders where ticket_type_id='$FREE_TYPE');
            delete from public.ticket_orders where ticket_type_id='$FREE_TYPE';
            update public.ticket_types set sold_count=0 where id='$FREE_TYPE';
            update public.ticket_orders set refund_amount_cents=0, refunded_at=null, status='paid'
              where id='$PAID_ORDER';" >/dev/null 2>&1 || true

echo "== Test 1: 20 parallel claim_free_tickets on capacity=5 =="
for i in $(seq 1 20); do
  ( psql -tAc "select public.claim_free_tickets('$FREE_TYPE'::uuid,'B$i','buyer$i@t.local',1,null)" \
      >"$TMP/claim_$i.out" 2>&1 ) &
done
wait
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
wait
refunded=$(psql -tAc "select refund_amount_cents from public.ticket_orders where id='$PAID_ORDER'")
status=$(psql -tAc "select status from public.ticket_orders where id='$PAID_ORDER'")
echo "  refunded_cents=$refunded  status=$status  (expected 10000/refunded)"
[[ "$refunded" -eq 10000 && "$status" = "refunded" ]] \
  || { echo "FAIL: apply_ticket_refund partial state"; exit 1; }

echo "PASS"
