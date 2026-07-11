
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.event_role AS ENUM ('owner','admin','editor','commenter','viewer');
CREATE TYPE public.event_status AS ENUM ('draft','planning','confirmed','completed','archived');
CREATE TYPE public.task_status AS ENUM ('todo','in_progress','done');
CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');
CREATE TYPE public.guest_rsvp AS ENUM ('pending','yes','no','maybe');

-- =========================================================
-- UPDATED_AT HELPER
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  primary_role TEXT,                       -- host | planner | vendor | team
  planning_priorities TEXT[] DEFAULT '{}',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles: read own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles: insert own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles: update own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create a profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- EVENTS
-- =========================================================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_type TEXT,                          -- wedding, reunion, birthday...
  description TEXT,
  event_date DATE,
  event_time TIME,
  location TEXT,
  budget_target NUMERIC(12,2),
  guest_target INTEGER,
  cover_image_url TEXT,
  status public.event_status NOT NULL DEFAULT 'planning',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_owner_id_idx ON public.events(owner_id);
CREATE INDEX events_status_idx ON public.events(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- EVENT_MEMBERS
-- =========================================================
CREATE TABLE public.event_members (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.event_role NOT NULL DEFAULT 'editor',
  invited_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX event_members_user_idx ON public.event_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_members TO authenticated;
GRANT ALL ON public.event_members TO service_role;
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- ACCESS HELPERS (SECURITY DEFINER — avoid recursive RLS)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_event_member(_event_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = _event_id AND e.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.event_members m WHERE m.event_id = _event_id AND m.user_id = _user_id
  );
$$;

-- Role ordering: viewer(1) < commenter(2) < editor(3) < admin(4) < owner(5)
CREATE OR REPLACE FUNCTION public.event_role_rank(_role public.event_role)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE _role
    WHEN 'viewer' THEN 1
    WHEN 'commenter' THEN 2
    WHEN 'editor' THEN 3
    WHEN 'admin' THEN 4
    WHEN 'owner' THEN 5
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_event_access(_event_id UUID, _user_id UUID, _min public.event_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    -- owner always passes
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = _event_id AND e.owner_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.event_members m
      WHERE m.event_id = _event_id
        AND m.user_id  = _user_id
        AND public.event_role_rank(m.role) >= public.event_role_rank(_min)
    );
$$;

-- Now that helpers exist, define event/member policies
CREATE POLICY "Events: members can view" ON public.events
  FOR SELECT TO authenticated USING (public.is_event_member(id, auth.uid()));
CREATE POLICY "Events: signed-in users can create their own" ON public.events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Events: editors and above can update" ON public.events
  FOR UPDATE TO authenticated
  USING (public.has_event_access(id, auth.uid(), 'editor'))
  WITH CHECK (public.has_event_access(id, auth.uid(), 'editor'));
CREATE POLICY "Events: owner can delete" ON public.events
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Members: members can view roster" ON public.event_members
  FOR SELECT TO authenticated USING (public.is_event_member(event_id, auth.uid()));
CREATE POLICY "Members: admins can add" ON public.event_members
  FOR INSERT TO authenticated WITH CHECK (public.has_event_access(event_id, auth.uid(), 'admin'));
CREATE POLICY "Members: admins can update" ON public.event_members
  FOR UPDATE TO authenticated
  USING (public.has_event_access(event_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_event_access(event_id, auth.uid(), 'admin'));
CREATE POLICY "Members: admins can remove" ON public.event_members
  FOR DELETE TO authenticated USING (public.has_event_access(event_id, auth.uid(), 'admin'));

-- =========================================================
-- TASKS
-- =========================================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET DEFAULT DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
