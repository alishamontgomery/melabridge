
-- Soft-delete columns
ALTER TABLE public.events        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.tasks         ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.guests        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.budget_items  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.event_files   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_events_deleted_at        ON public.events(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at         ON public.tasks(event_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_guests_deleted_at        ON public.guests(event_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_budget_items_deleted_at  ON public.budget_items(event_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_event_files_deleted_at   ON public.event_files(event_id, deleted_at);

-- Nightly purge job: permanently remove events (cascades to child rows via FK)
-- that have been in Trash for 30+ days. Runs at 03:00 UTC daily.
CREATE OR REPLACE FUNCTION public.purge_trashed_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  WITH d AS (
    DELETE FROM public.events
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT count(*) INTO n FROM d;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_trashed_events() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_trashed_events() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('purge-trashed-events-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'purge-trashed-events-daily',
  '0 3 * * *',
  $$SELECT public.purge_trashed_events();$$
);
