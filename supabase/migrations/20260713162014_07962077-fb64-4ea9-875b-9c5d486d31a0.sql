
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.calendar_block_reason AS ENUM ('day_off','vacation','travel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.calendar_event_status AS ENUM ('inquiry','pending','confirmed','completed','cancelled','declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.calendar_event_source AS ENUM ('native','external');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.calendar_request_status AS ENUM ('pending','approved','declined','alternate_proposed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ calendar_availability ============
CREATE TABLE public.calendar_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_availability TO authenticated;
GRANT ALL ON public.calendar_availability TO service_role;
ALTER TABLE public.calendar_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avail_owner_all" ON public.calendar_availability FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.calendar_availability (user_id, weekday);

-- ============ calendar_blocked_dates ============
CREATE TABLE public.calendar_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason public.calendar_block_reason NOT NULL DEFAULT 'day_off',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_blocked_dates TO authenticated;
GRANT ALL ON public.calendar_blocked_dates TO service_role;
ALTER TABLE public.calendar_blocked_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_owner_all" ON public.calendar_blocked_dates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.calendar_blocked_dates (user_id, start_date, end_date);

-- ============ calendar_settings ============
CREATE TABLE public.calendar_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  buffer_before_minutes integer NOT NULL DEFAULT 30,
  buffer_after_minutes integer NOT NULL DEFAULT 30,
  max_events_per_day integer NOT NULL DEFAULT 2,
  block_travel_days boolean NOT NULL DEFAULT false,
  vacation_start date,
  vacation_end date,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_settings TO authenticated;
GRANT ALL ON public.calendar_settings TO service_role;
ALTER TABLE public.calendar_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_owner_all" ON public.calendar_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ calendar_events ============
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  planner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  client_name text,
  event_name text NOT NULL,
  event_type text,
  venue_name text,
  address text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  setup_minutes integer NOT NULL DEFAULT 0,
  breakdown_minutes integer NOT NULL DEFAULT 0,
  status public.calendar_event_status NOT NULL DEFAULT 'pending',
  internal_notes text,
  payment_status text,
  contract_status text,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  team_assignments jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  revenue_amount numeric(12,2),
  source public.calendar_event_source NOT NULL DEFAULT 'native',
  external_provider text,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cal_events_vendor_all" ON public.calendar_events FOR ALL USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);
CREATE POLICY "cal_events_planner_read" ON public.calendar_events FOR SELECT USING (auth.uid() = planner_id);
CREATE INDEX ON public.calendar_events (vendor_id, starts_at);
CREATE INDEX ON public.calendar_events (planner_id);
CREATE INDEX ON public.calendar_events (status);

-- ============ calendar_booking_requests ============
CREATE TABLE public.calendar_booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  vendor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  planner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_type text,
  client_name text,
  venue_name text,
  address text,
  requested_start timestamptz NOT NULL,
  requested_end timestamptz NOT NULL,
  message text,
  status public.calendar_request_status NOT NULL DEFAULT 'pending',
  alternate_start timestamptz,
  alternate_end timestamptz,
  alternate_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requested_end > requested_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_booking_requests TO authenticated;
GRANT ALL ON public.calendar_booking_requests TO service_role;
ALTER TABLE public.calendar_booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "req_vendor_all" ON public.calendar_booking_requests FOR ALL USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);
CREATE POLICY "req_planner_read" ON public.calendar_booking_requests FOR SELECT USING (auth.uid() = planner_id);
CREATE POLICY "req_planner_insert" ON public.calendar_booking_requests FOR INSERT WITH CHECK (auth.uid() = planner_id);
CREATE POLICY "req_planner_update_own" ON public.calendar_booking_requests FOR UPDATE USING (auth.uid() = planner_id AND status IN ('pending','alternate_proposed')) WITH CHECK (auth.uid() = planner_id);
CREATE INDEX ON public.calendar_booking_requests (vendor_id, status);
CREATE INDEX ON public.calendar_booking_requests (planner_id, status);

-- ============ updated_at triggers ============
CREATE TRIGGER trg_cal_avail_updated BEFORE UPDATE ON public.calendar_availability FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cal_blocked_updated BEFORE UPDATE ON public.calendar_blocked_dates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cal_settings_updated BEFORE UPDATE ON public.calendar_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cal_events_updated BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cal_requests_updated BEFORE UPDATE ON public.calendar_booking_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
