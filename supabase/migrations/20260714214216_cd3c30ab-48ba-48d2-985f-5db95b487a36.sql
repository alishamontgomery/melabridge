
DO $$ BEGIN
  CREATE TYPE public.runsheet_status AS ENUM ('planned','in_progress','complete','delayed','critical','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.event_runsheet_items
  ADD COLUMN IF NOT EXISTS status public.runsheet_status NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_vendor_id uuid,
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ceremony_start_time time;
