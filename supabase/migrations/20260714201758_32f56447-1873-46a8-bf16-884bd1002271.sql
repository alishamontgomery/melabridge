
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sample_mode boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sample_seeded_at timestamptz;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS sample_metadata jsonb;

ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.budget_items ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendor_bookings ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.event_files ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.event_members ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_owner_sample ON public.events(owner_id, is_sample);
CREATE INDEX IF NOT EXISTS idx_guests_event_sample ON public.guests(event_id, is_sample);
CREATE INDEX IF NOT EXISTS idx_tasks_event_sample ON public.tasks(event_id, is_sample);
