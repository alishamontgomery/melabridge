ALTER TABLE public.calendar_settings
  ADD COLUMN IF NOT EXISTS include_event_name boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_venue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_address boolean NOT NULL DEFAULT false;