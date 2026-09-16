-- Stripe webhook finalize hardening:
--   1. Durable idempotency ledger (processed_stripe_events) with an explicit
--      processing/completed state machine + a lease/reclaim mechanism, so a
--      process crash between claim and completion cannot permanently swallow an
--      event.
--   2. Transactional RPC that atomically claims + finalizes a paid ticket order:
--        flips order -> paid, inserts attendee rows, bumps ticket_type.sold_count.
--      Every effect that must stay mutually consistent lives inside one transaction.
--
-- Both objects are server-side only (service_role); the webhook runs with the
-- service role via supabaseAdmin.

-- ---------------------------------------------------------------------------
-- 1. Durable idempotency ledger (state machine + lease)
-- ---------------------------------------------------------------------------
-- One row per Stripe event id. Lifecycle:
--   claim  -> INSERT status='processing' with a fresh lease (or atomically
--             RECLAIM an existing row whose processing lease has expired).
--   done   -> UPDATE status='completed' (only if still the current lease holder).
--   fail   -> DELETE the row (only if still the current lease holder), so the
--             next Stripe redelivery re-processes from scratch.
--
-- Outcomes the webhook must honour:
--   'completed'  duplicate  -> the event already finished -> respond 200.
--   'processing' active      -> another worker holds a live lease -> respond
--                               non-2xx so Stripe keeps retrying (NEVER 200).
--   'claimed'                -> this worker owns the (new or reclaimed) lease and
--                               must run side effects.
--
-- A lease_token pins ownership: a worker whose lease was reclaimed by another
-- worker can no longer complete or release the row, so it cannot clobber the
-- reclaimer's work.
CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  environment text NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed')),
  lease_token uuid NOT NULL DEFAULT gen_random_uuid(),
  leased_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processed_stripe_events TO service_role;

ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (which bypasses RLS) may touch this table.
-- authenticated/anon have no grants and no policies -> fully locked down.

-- claim_stripe_event: atomically acquire (or reclaim) the processing lease.
--
-- Returns exactly one row:
--   outcome = 'claimed'    -> caller owns lease_token and must process.
--   outcome = 'completed'  -> already finished; caller responds 200 (no-op).
--   outcome = 'processing' -> a live lease is held elsewhere; caller responds
--                             non-2xx (Stripe retries later).
--
-- Reclaim is race-safe: the UPDATE ... WHERE status='processing' AND lease
-- expired only touches the row while it is row-locked, and rotates lease_token,
-- so of N concurrent callers at most one observes 'claimed'; the rest see the
-- refreshed live lease and get 'processing'.
CREATE OR REPLACE FUNCTION public.claim_stripe_event(
  _event_id text,
  _event_type text,
  _environment text,
  _lease_seconds int DEFAULT 120
)
RETURNS TABLE(outcome text, lease_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  existing public.processed_stripe_events%ROWTYPE;
  new_token uuid;
BEGIN
  IF _event_id IS NULL OR length(btrim(_event_id)) = 0 THEN
    RAISE EXCEPTION 'event_id required' USING ERRCODE = '22023';
  END IF;

  -- Fast path: first delivery. INSERT wins the claim outright.
  BEGIN
    new_token := gen_random_uuid();
    INSERT INTO public.processed_stripe_events
      (event_id, event_type, environment, status, lease_token, leased_at)
    VALUES
      (_event_id, _event_type, _environment, 'processing', new_token, now());
    RETURN QUERY SELECT 'claimed'::text, new_token;
    RETURN;
  EXCEPTION WHEN unique_violation THEN
    -- Row already exists — fall through to inspect / possibly reclaim it.
    NULL;
  END;

  -- Row-lock the existing ledger row so reclaim decisions serialize.
  SELECT * INTO existing
  FROM public.processed_stripe_events
  WHERE event_id = _event_id
  FOR UPDATE;

  IF existing.status = 'completed' THEN
    RETURN QUERY SELECT 'completed'::text, NULL::uuid;
    RETURN;
  END IF;

  -- status = 'processing'. Reclaim only if the lease has expired.
  IF existing.leased_at < now() - make_interval(secs => _lease_seconds) THEN
    new_token := gen_random_uuid();
    UPDATE public.processed_stripe_events
       SET lease_token = new_token,
           leased_at = now(),
           event_type = _event_type,
           environment = _environment
     WHERE event_id = _event_id;
    RETURN QUERY SELECT 'claimed'::text, new_token;
    RETURN;
  END IF;

  -- A live lease is held by another worker.
  RETURN QUERY SELECT 'processing'::text, NULL::uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_event(text, text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event(text, text, text, int) TO service_role;

-- complete_stripe_event: mark the event completed, but only if the caller still
-- holds the current lease. Returns true on success; false if the lease was
-- reclaimed/rotated (caller lost ownership and must NOT treat as completed).
CREATE OR REPLACE FUNCTION public.complete_stripe_event(
  _event_id text,
  _lease_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  affected int;
BEGIN
  UPDATE public.processed_stripe_events
     SET status = 'completed',
         completed_at = now()
   WHERE event_id = _event_id
     AND lease_token = _lease_token
     AND status = 'processing';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_stripe_event(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_stripe_event(text, uuid) TO service_role;

-- release_stripe_event: relinquish the claim on a retryable failure, but only if
-- the caller still holds the current lease AND the row is still 'processing'
-- (never delete a 'completed' row). Returns true if this call released its own
-- claim; false if the lease was already reclaimed/completed by someone else.
CREATE OR REPLACE FUNCTION public.release_stripe_event(
  _event_id text,
  _lease_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  affected int;
BEGIN
  DELETE FROM public.processed_stripe_events
   WHERE event_id = _event_id
     AND lease_token = _lease_token
     AND status = 'processing';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.release_stripe_event(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_stripe_event(text, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Transactional finalize RPC
-- ---------------------------------------------------------------------------
-- Atomically finalizes a *paid* checkout for a ticket order. Mirrors the free
-- claim RPC (claim_free_tickets): row-locks the order, and on the winning claim
-- inserts attendees + bumps sold_count in the same transaction so paid state,
-- attendee rows and inventory can never diverge.
--
-- Returns one row describing the outcome:
--   claimed = true  -> this call performed the finalize (caller may send email /
--                      fire milestones post-commit).
--   claimed = false -> order was already finalized (or not pending); this is a
--                      safe no-op for a duplicate/racing delivery.
-- Raises only on genuine, retryable failures (missing order, constraint errors),
-- so the webhook can map an exception -> non-2xx (Stripe retry).
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
BEGIN
  IF _order_id IS NULL THEN
    RAISE EXCEPTION 'Order id required' USING ERRCODE = '22023';
  END IF;

  -- Row-lock the order so concurrent webhook + confirm-page deliveries serialize.
  SELECT * INTO o
  FROM public.ticket_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Genuine problem: Stripe references an order we don't have. Let the caller
    -- surface this as a retryable error (order row may still be replicating).
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency: only a 'pending' order is finalizable. Anything else
  -- (already paid, refunded, expired, failed) is a safe no-op.
  IF o.status <> 'pending' THEN
    RETURN QUERY SELECT false, o.event_id, o.ticket_type_id, o.quantity;
    RETURN;
  END IF;

  UPDATE public.ticket_orders
     SET status = 'paid',
         finalized_at = now(),
         stripe_payment_intent = COALESCE(_payment_intent, stripe_payment_intent)
   WHERE id = o.id;

  -- Attendee rows: first attendee carries buyer identity, remainder are blank.
  INSERT INTO public.ticket_attendees (order_id, event_id, full_name, email)
  SELECT o.id, o.event_id,
         CASE WHEN i = 1 THEN o.buyer_name ELSE NULL END,
         CASE WHEN i = 1 THEN o.buyer_email ELSE NULL END
  FROM generate_series(1, o.quantity) AS i;

  -- Inventory: lock the type row before bumping sold_count.
  PERFORM 1 FROM public.ticket_types WHERE id = o.ticket_type_id FOR UPDATE;
  UPDATE public.ticket_types
     SET sold_count = sold_count + o.quantity
   WHERE id = o.ticket_type_id;

  RETURN QUERY SELECT true, o.event_id, o.ticket_type_id, o.quantity;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_paid_ticket_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_paid_ticket_order(uuid, text) TO service_role;
