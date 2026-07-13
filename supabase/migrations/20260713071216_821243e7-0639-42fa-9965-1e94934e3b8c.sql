
-- Client info
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS preferred_contact text,
  ADD COLUMN IF NOT EXISTS lead_source text;

-- Custom event type + notes
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS custom_event_type text,
  ADD COLUMN IF NOT EXISTS event_notes text;

-- Address (structured)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_street text,
  ADD COLUMN IF NOT EXISTS venue_city text,
  ADD COLUMN IF NOT EXISTS venue_state text,
  ADD COLUMN IF NOT EXISTS venue_zip text,
  ADD COLUMN IF NOT EXISTS venue_lat numeric,
  ADD COLUMN IF NOT EXISTS venue_lng numeric,
  ADD COLUMN IF NOT EXISTS venue_place_id text;

-- Scheduling
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

-- Deposit / payment
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS deposit_required numeric,
  ADD COLUMN IF NOT EXISTS deposit_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due_date date,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';
