-- =========================================================
-- Scheduled message claiming: atomic, concurrency-safe delivery.
--
-- Problem this fixes:
--   * The cron worker selected status='scheduled' rows with a plain SELECT,
--     so two overlapping runs could claim (and send) the same row twice.
--   * A row was marked 'sent' even when required recipient email deliveries
--     failed, hiding real delivery failures ("false sent").
--   * A hard-crash mid-send left no way to recover the row (stuck forever)
--     and a transient failure went straight to 'failed' with no retry.
--
-- Approach:
--   * Add lease / retry bookkeeping columns (attempts, next_attempt_at,
--     locked_at, last_error). No PII is stored in last_error.
--   * Widen the status set to include 'processing' and 'retryable'.
--   * claim_scheduled_communications(): atomically flips a bounded batch of
--     due 'scheduled'/'retryable' rows (and stuck 'processing' rows whose
--     lease expired) to 'processing' using FOR UPDATE SKIP LOCKED, so
--     concurrent cron runs never grab the same row.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Bookkeeping columns for lease + retry semantics.
-- ---------------------------------------------------------
ALTER TABLE public.event_communications
  ADD COLUMN IF NOT EXISTS attempts         INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error       TEXT;

-- ---------------------------------------------------------
-- 2. Allowed statuses. Existing rows use 'sent' | 'scheduled' | 'failed';
--    add 'processing' (claimed, in flight) and 'retryable' (transient
--    failure, eligible for another attempt after next_attempt_at).
--    Guarded so re-running the migration is safe.
-- ---------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_communications_status_check'
      AND conrelid = 'public.event_communications'::regclass
  ) THEN
    ALTER TABLE public.event_communications
      ADD CONSTRAINT event_communications_status_check
      CHECK (status IN ('sent', 'scheduled', 'failed', 'processing', 'retryable'));
  END IF;
END $$;

-- Partial index so the claim query only scans due, claimable rows.
CREATE INDEX IF NOT EXISTS idx_event_comms_claimable
  ON public.event_communications (status, scheduled_for, next_attempt_at)
  WHERE status IN ('scheduled', 'retryable', 'processing');

-- ---------------------------------------------------------
-- 3. Atomic claim RPC.
--
--    Selects up to `_batch_size` rows that are due for delivery:
--      * status='scheduled' and scheduled_for <= now(), OR
--      * status='retryable' and next_attempt_at <= now(), OR
--      * status='processing' whose lease is older than `_lease_seconds`
--        (crash recovery — the previous worker died mid-send).
--    Locks them with FOR UPDATE SKIP LOCKED so a concurrent cron run
--    skips already-claimed rows instead of blocking or double-claiming,
--    then flips them to 'processing', stamps locked_at, and bumps attempts.
--    Returns the claimed rows (including locked_at) for the caller to process.
--
--    locked_at doubles as a lease token: every row claimed in one call shares
--    this transaction's now(), and a later reclaim by another worker stamps a
--    fresh now(). Callers MUST guard their sent/retryable/failed updates by
--    both id AND locked_at so a stale worker whose lease expired cannot
--    transition a row a new worker has since reclaimed.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_scheduled_communications(
  _batch_size    INT DEFAULT 50,
  _lease_seconds INT DEFAULT 600
)
RETURNS TABLE (
  id              UUID,
  event_id        UUID,
  organizer_id    UUID,
  subject         TEXT,
  body            TEXT,
  recipient_group TEXT,
  scheduled_for   TIMESTAMPTZ,
  attempts        INT,
  locked_at       TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch INT := LEAST(GREATEST(COALESCE(_batch_size, 50), 1), 200);
  v_lease INT := GREATEST(COALESCE(_lease_seconds, 600), 30);
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT ec.id
    FROM public.event_communications ec
    WHERE (
        (ec.status = 'scheduled' AND ec.scheduled_for IS NOT NULL AND ec.scheduled_for <= now())
        OR (ec.status = 'retryable' AND COALESCE(ec.next_attempt_at, now()) <= now())
        OR (ec.status = 'processing' AND ec.locked_at IS NOT NULL
            AND ec.locked_at < now() - make_interval(secs => v_lease))
      )
    ORDER BY COALESCE(ec.scheduled_for, ec.next_attempt_at, ec.created_at) ASC
    LIMIT v_batch
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.event_communications ec
     SET status     = 'processing',
         locked_at  = now(),
         attempts   = ec.attempts + 1
    FROM due
   WHERE ec.id = due.id
  RETURNING
    ec.id,
    ec.event_id,
    ec.organizer_id,
    ec.subject,
    ec.body,
    ec.recipient_group,
    ec.scheduled_for,
    ec.attempts,
    ec.locked_at;
END;
$$;

-- Only the service role (cron worker) may claim work.
REVOKE ALL ON FUNCTION public.claim_scheduled_communications(int, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_scheduled_communications(int, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_communications(int, int) TO service_role;
