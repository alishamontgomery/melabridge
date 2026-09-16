-- =========================================================
-- MelaBridge — all migrations consolidated
-- Generated 2026-08-02T21:13:19Z from 87 migration files
-- =========================================================


-- === Migration: 20260711172951_34f9f424-d288-480f-8618-79f3dd0c03ff.sql ===

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


-- === Migration: 20260711173055_b0a019cf-a6d9-4d14-b441-93771ed68db2.sql ===

-- Rebuild tasks cleanly
DROP TABLE IF EXISTS public.tasks CASCADE;

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tasks_event_idx ON public.tasks(event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Tasks: members read" ON public.tasks
  FOR SELECT TO authenticated USING (public.is_event_member(event_id, auth.uid()));
CREATE POLICY "Tasks: editors insert" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (public.has_event_access(event_id, auth.uid(), 'editor'));
CREATE POLICY "Tasks: editors update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.has_event_access(event_id, auth.uid(), 'editor'))
  WITH CHECK (public.has_event_access(event_id, auth.uid(), 'editor'));
CREATE POLICY "Tasks: editors delete" ON public.tasks
  FOR DELETE TO authenticated USING (public.has_event_access(event_id, auth.uid(), 'editor'));

-- Budget items
CREATE TABLE public.budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  estimated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  vendor_name TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX budget_items_event_idx ON public.budget_items(event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_items TO authenticated;
GRANT ALL ON public.budget_items TO service_role;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_budget_items_updated_at BEFORE UPDATE ON public.budget_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Budget: members read" ON public.budget_items
  FOR SELECT TO authenticated USING (public.is_event_member(event_id, auth.uid()));
CREATE POLICY "Budget: editors insert" ON public.budget_items
  FOR INSERT TO authenticated WITH CHECK (public.has_event_access(event_id, auth.uid(), 'editor'));
CREATE POLICY "Budget: editors update" ON public.budget_items
  FOR UPDATE TO authenticated
  USING (public.has_event_access(event_id, auth.uid(), 'editor'))
  WITH CHECK (public.has_event_access(event_id, auth.uid(), 'editor'));
CREATE POLICY "Budget: editors delete" ON public.budget_items
  FOR DELETE TO authenticated USING (public.has_event_access(event_id, auth.uid(), 'editor'));

-- Guests
CREATE TABLE public.guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  household TEXT,
  rsvp_status public.guest_rsvp NOT NULL DEFAULT 'pending',
  plus_ones INTEGER NOT NULL DEFAULT 0,
  meal_choice TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX guests_event_idx ON public.guests(event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guests TO authenticated;
GRANT ALL ON public.guests TO service_role;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_guests_updated_at BEFORE UPDATE ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Guests: members read" ON public.guests
  FOR SELECT TO authenticated USING (public.is_event_member(event_id, auth.uid()));
CREATE POLICY "Guests: editors insert" ON public.guests
  FOR INSERT TO authenticated WITH CHECK (public.has_event_access(event_id, auth.uid(), 'editor'));
CREATE POLICY "Guests: editors update" ON public.guests
  FOR UPDATE TO authenticated
  USING (public.has_event_access(event_id, auth.uid(), 'editor'))
  WITH CHECK (public.has_event_access(event_id, auth.uid(), 'editor'));
CREATE POLICY "Guests: editors delete" ON public.guests
  FOR DELETE TO authenticated USING (public.has_event_access(event_id, auth.uid(), 'editor'));

-- Activity log
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_event_idx ON public.activity_log(event_id, created_at DESC);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity: members read" ON public.activity_log
  FOR SELECT TO authenticated USING (public.is_event_member(event_id, auth.uid()));
CREATE POLICY "Activity: members insert" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (public.is_event_member(event_id, auth.uid()) AND actor_id = auth.uid());

-- Lock down helper functions (revoke public, keep authenticated)
REVOKE EXECUTE ON FUNCTION public.is_event_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_event_access(UUID, UUID, public.event_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.event_role_rank(public.event_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Fix mutable search_path warnings
ALTER FUNCTION public.event_role_rank(public.event_role) SET search_path = public;


-- === Migration: 20260712014258_5452bd0b-4d54-4b7b-896d-ad8916acc406.sql ===

-- Extend profiles with account type + organization flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT,           -- 'planner' | 'vendor' | 'guest'
  ADD COLUMN IF NOT EXISTS is_organization BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS organization_name TEXT,
  ADD COLUMN IF NOT EXISTS organization_type TEXT;      -- business | school | church | nonprofit | corporate

-- Vendor profiles
CREATE TABLE IF NOT EXISTS public.vendor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  business_name TEXT NOT NULL,
  business_category TEXT NOT NULL,
  business_description TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  city TEXT,
  state TEXT,
  travel_radius INTEGER,
  business_address TEXT,
  mobile_service BOOLEAN DEFAULT false,
  virtual_services TEXT,
  years_in_business INTEGER,
  starting_price NUMERIC(12,2),
  business_hours JSONB,
  social_links JSONB,
  portfolio_urls TEXT[] DEFAULT '{}',
  accepted_terms BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_profiles TO authenticated;
GRANT ALL ON public.vendor_profiles TO service_role;
GRANT SELECT ON public.vendor_profiles TO anon; -- allow public marketplace browsing
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendor profiles: public read"
  ON public.vendor_profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Vendor profiles: insert own"
  ON public.vendor_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Vendor profiles: update own"
  ON public.vendor_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Vendor profiles: delete own"
  ON public.vendor_profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_vendor_profiles_updated_at
  BEFORE UPDATE ON public.vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- === Migration: 20260712182003_d0974b2a-6dd1-4189-91ac-d85702131e4d.sql ===

-- Fix 1: Vendor profiles public read exposure
DROP POLICY IF EXISTS "Vendor profiles: public read" ON public.vendor_profiles;

CREATE POLICY "Vendor profiles: owner read"
ON public.vendor_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

REVOKE SELECT ON public.vendor_profiles FROM anon;

-- Fix 2: Restrict SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_event_access(uuid, uuid, public.event_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_event_member(uuid, uuid) FROM PUBLIC, anon;


-- === Migration: 20260712211503_e24e7cde-869a-4255-a6de-d70f9161c90e.sql ===

-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('planner', 'vendor', 'guest', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 3. has_role helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 4. Auto-assign role when profile.account_type is set
CREATE OR REPLACE FUNCTION public.sync_role_from_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.account_type IS NOT NULL AND NEW.account_type IN ('planner','vendor','guest') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, NEW.account_type::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_role_after_profile_upsert ON public.profiles;
CREATE TRIGGER sync_role_after_profile_upsert
AFTER INSERT OR UPDATE OF account_type ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_role_from_profile();

-- 5. Backfill existing users
INSERT INTO public.user_roles (user_id, role)
SELECT id, account_type::public.app_role
FROM public.profiles
WHERE account_type IN ('planner','vendor','guest')
ON CONFLICT (user_id, role) DO NOTHING;


-- === Migration: 20260712211521_07f5a70a-7d64-4cc2-a535-2ecc98f30944.sql ===

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.sync_role_from_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_role_from_profile() TO service_role;


-- === Migration: 20260712214911_da75c8e5-0e86-4b14-8ce8-e5b25ae8e5ba.sql ===
-- Revoke broad execute from trigger-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_role_from_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Tighten RLS helper functions: no anon execution, keep authenticated for RLS policy usage
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_event_access(uuid, uuid, public.event_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_event_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.event_role_rank(public.event_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_event_access(uuid, uuid, public.event_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.event_role_rank(public.event_role) TO authenticated;

-- === Migration: 20260712233734_f30f3604-a576-4406-a26b-fd194f4632b1.sql ===

-- Notification preferences (per user, per channel)
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL,
  email_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification prefs"
  ON public.notification_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notification_preferences_set_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Scheduled messages
CREATE TABLE public.scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  recipients text[] NOT NULL DEFAULT '{}',
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  template_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_messages TO authenticated;
GRANT ALL ON public.scheduled_messages TO service_role;

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scheduled messages"
  ON public.scheduled_messages
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER scheduled_messages_set_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX scheduled_messages_user_send_at_idx
  ON public.scheduled_messages (user_id, send_at);


-- === Migration: 20260712235238_9631a97f-ce41-4636-8287-f5e9ebc1d279.sql ===
CREATE POLICY "Admins can insert user roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update user roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- === Migration: 20260713005326_024ee5e2-1c94-4d6a-991b-9f1bced96c4a.sql ===

-- =========================
-- Conversations
-- =========================
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  type text NOT NULL DEFAULT 'internal' CHECK (type IN ('internal','vendor','guest','payment','system')),
  is_pinned boolean NOT NULL DEFAULT false,
  is_muted boolean NOT NULL DEFAULT false,
  is_favorite boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  deleted_at timestamptz,
  labels text[] NOT NULL DEFAULT '{}',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Security-definer participant check to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = _conv AND c.owner_id = _user
  ) OR EXISTS (
    SELECT 1 FROM public.conversation_participants p WHERE p.conversation_id = _conv AND p.user_id = _user
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;

CREATE POLICY "conv: participants can read"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()));
CREATE POLICY "conv: owner can insert"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "conv: owner can update"
  ON public.conversations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "conv: owner can delete"
  ON public.conversations FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "cp: participants can read"
  ON public.conversation_participants FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "cp: owner manages"
  ON public.conversation_participants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.owner_id = auth.uid()));

-- =========================
-- Messages
-- =========================
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','read')),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "msg: participants can read"
  ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "msg: participants can insert"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "msg: sender can update"
  ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY "msg: sender can delete"
  ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_owner ON public.conversations(owner_id, last_message_at DESC);

-- =========================
-- Templates
-- =========================
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = global/seeded
  category text NOT NULL DEFAULT 'guest',
  title text NOT NULL,
  body text NOT NULL,
  variables text[] NOT NULL DEFAULT '{}',
  is_favorite boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  tone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tpl: read global or own"
  ON public.message_templates FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid());
CREATE POLICY "tpl: insert own"
  ON public.message_templates FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "tpl: update own"
  ON public.message_templates FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "tpl: delete own"
  ON public.message_templates FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.message_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  edited_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.message_template_versions TO authenticated;
GRANT ALL ON public.message_template_versions TO service_role;
ALTER TABLE public.message_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tplv: read own"
  ON public.message_template_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.message_templates t WHERE t.id = template_id AND (t.owner_id = auth.uid() OR t.owner_id IS NULL)));
CREATE POLICY "tplv: insert own"
  ON public.message_template_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.message_templates t WHERE t.id = template_id AND t.owner_id = auth.uid()));

-- =========================
-- Extend notification_preferences
-- =========================
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'messages',
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'instant' CHECK (frequency IN ('instant','hourly','daily','weekly','off')),
  ADD COLUMN IF NOT EXISTS sms_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS in_app_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS calendar_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start time,
  ADD COLUMN IF NOT EXISTS quiet_hours_end time,
  ADD COLUMN IF NOT EXISTS event_id uuid;

-- =========================
-- Triggers
-- =========================
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- Seed 80+ global templates
-- =========================
INSERT INTO public.message_templates (owner_id, category, title, body, variables, tone) VALUES
-- Guest (14)
(NULL,'guest','RSVP reminder — 30 days','Hi {name}, just a friendly reminder our RSVP window closes in 30 days. Tap your invite link to confirm — can''t wait to celebrate with you!',ARRAY['name'],'friendly'),
(NULL,'guest','RSVP reminder — 7 days','Hi {name}, RSVPs close in one week. If you haven''t already, please confirm at {rsvp_link}.',ARRAY['name','rsvp_link'],'friendly'),
(NULL,'guest','RSVP final call — 48 hours','Hi {name}, final call for RSVPs — we close the guest list in 48 hours. Confirm here: {rsvp_link}.',ARRAY['name','rsvp_link'],'urgent'),
(NULL,'guest','Save-the-date','Save the date! {couple} are getting married on {date} in {city}. Formal invitation to follow.',ARRAY['couple','date','city'],'friendly'),
(NULL,'guest','Dietary preference check','Hi {name}, we want your meal to be perfect. Any dietary preferences or allergies we should know about?',ARRAY['name'],'friendly'),
(NULL,'guest','Plus-one confirmation','Hi {name}, could you share your plus-one''s full name so we can print place cards? Thank you!',ARRAY['name'],'friendly'),
(NULL,'guest','Kids policy note','Hi {name}, our celebration is adults-only. We''ve set aside a list of trusted local sitters if that helps — just let us know.',ARRAY['name'],'professional'),
(NULL,'guest','Travel details','Hi {name}, your travel packet: hotel block {hotel}, arrival window {arrival}, transfer info attached. Reply if anything looks off.',ARRAY['name','hotel','arrival'],'professional'),
(NULL,'guest','Hotel room block','Hi {name}, we''ve reserved a room block at {hotel}. Use code {code} before {cutoff} for our rate.',ARRAY['name','hotel','code','cutoff'],'professional'),
(NULL,'guest','Weekend itinerary','Hi {name}, here''s the full weekend at a glance: welcome dinner Friday, ceremony Saturday, farewell brunch Sunday. Full timeline attached.',ARRAY['name'],'friendly'),
(NULL,'guest','Ceremony dress code','Hi {name}, quick note on dress code: {dress_code}. Can''t wait to see you.',ARRAY['name','dress_code'],'friendly'),
(NULL,'guest','Ceremony timing update','Hi {name}, small timing update — ceremony now begins at {time}. Everything else on the itinerary stays the same.',ARRAY['name','time'],'professional'),
(NULL,'guest','Post-event thank you','Thank you so much for celebrating with us — it truly wouldn''t have been the same without you.',ARRAY[]::text[],'friendly'),
(NULL,'guest','Registry acknowledgement','Thank you {name} for the thoughtful gift — we''re so grateful for you.',ARRAY['name'],'friendly'),

-- Vendor (14)
(NULL,'vendor','Deposit invoice','Hi {vendor}, attaching the deposit invoice for our {event_date} event. Due by {due_date}. Let me know if you need anything else.',ARRAY['vendor','event_date','due_date'],'professional'),
(NULL,'vendor','Deposit reminder','Hi {vendor}, friendly reminder the deposit is due {due_date}. Happy to resend the invoice if useful.',ARRAY['vendor','due_date'],'professional'),
(NULL,'vendor','Contract sent','Hi {vendor}, contract is attached — please review and countersign at your convenience. Any redlines welcome.',ARRAY['vendor'],'professional'),
(NULL,'vendor','Contract follow-up','Hi {vendor}, checking in on the contract. Do you have any questions before signing?',ARRAY['vendor'],'professional'),
(NULL,'vendor','Timeline draft','Hi {vendor}, first draft of the day-of timeline attached. Please review your service window and flag anything that needs to move.',ARRAY['vendor'],'professional'),
(NULL,'vendor','Final walkthrough','Hi {vendor}, scheduling our final walkthrough for {date} at {time}. Please confirm.',ARRAY['vendor','date','time'],'professional'),
(NULL,'vendor','Load-in details','Hi {vendor}, load-in details for {event_date}: doors open {load_in}, service entry at {entry}. Contact on site: {coordinator}.',ARRAY['vendor','event_date','load_in','entry','coordinator'],'professional'),
(NULL,'vendor','COI request','Hi {vendor}, could you send a certificate of insurance naming {venue} as additional insured? Venue requires it by {due_date}.',ARRAY['vendor','venue','due_date'],'professional'),
(NULL,'vendor','Final headcount','Hi {vendor}, our final headcount is {headcount}. Please confirm receipt.',ARRAY['vendor','headcount'],'professional'),
(NULL,'vendor','Menu tasting scheduling','Hi {vendor}, could we book a tasting the week of {week}? Any afternoon works.',ARRAY['vendor','week'],'friendly'),
(NULL,'vendor','Final payment','Hi {vendor}, final payment sent today — thank you for everything you''re doing to make this special.',ARRAY['vendor'],'friendly'),
(NULL,'vendor','Post-event thank you','Thank you for making {event_date} unforgettable. Reviews on the way.',ARRAY['vendor','event_date'],'friendly'),
(NULL,'vendor','Review request','Hi {vendor}, would love to leave you a review — is there a preferred platform?',ARRAY['vendor'],'friendly'),
(NULL,'vendor','Referral introduction','Hi {vendor}, introducing {friend} who''s planning their {event_type}. I couldn''t recommend you more.',ARRAY['vendor','friend','event_type'],'friendly'),

-- Payment (8)
(NULL,'payment','Invoice sent','Hi {name}, invoice #{invoice} for {amount} is attached. Due {due_date}.',ARRAY['name','invoice','amount','due_date'],'professional'),
(NULL,'payment','Payment received','Hi {name}, confirming receipt of {amount} on {date}. Receipt attached.',ARRAY['name','amount','date'],'professional'),
(NULL,'payment','Past-due gentle nudge','Hi {name}, checking in on invoice #{invoice} — showing past due. Any issues on your end?',ARRAY['name','invoice'],'professional'),
(NULL,'payment','Past-due firm','Hi {name}, invoice #{invoice} is now {days} days past due. Please remit by {due_date} to avoid late fees.',ARRAY['name','invoice','days','due_date'],'urgent'),
(NULL,'payment','Payment plan proposal','Hi {name}, happy to split the balance into {installments} installments. Let me know if that works.',ARRAY['name','installments'],'professional'),
(NULL,'payment','Refund confirmation','Hi {name}, refund of {amount} processed today. Please allow 5–7 business days.',ARRAY['name','amount'],'professional'),
(NULL,'payment','Deposit received','Hi {name}, deposit received — you''re officially on the calendar for {event_date}.',ARRAY['name','event_date'],'friendly'),
(NULL,'payment','Change order','Hi {name}, change order attached reflecting the recent updates. New balance due: {amount}.',ARRAY['name','amount'],'professional'),

-- Internal (10)
(NULL,'internal','Weekly sync agenda','Team, agenda for {date}: 1) status by event 2) blockers 3) upcoming week. Add anything under AOB.',ARRAY['date'],'professional'),
(NULL,'internal','Decision needed','Team, need a call on {topic} by {deadline}. Context in thread.',ARRAY['topic','deadline'],'urgent'),
(NULL,'internal','Handoff','Handing off {event} to {owner}. Full brief in shared drive; ping me anytime.',ARRAY['event','owner'],'professional'),
(NULL,'internal','On-call rotation','You''re on-call for {event} from {start} to {end}. Emergency line: {phone}.',ARRAY['event','start','end','phone'],'professional'),
(NULL,'internal','Kudos','Huge shout-out to {name} for {reason}. Truly appreciated.',ARRAY['name','reason'],'friendly'),
(NULL,'internal','Post-mortem invite','Post-mortem for {event} on {date}. Come with wins, misses, and one thing to change.',ARRAY['event','date'],'professional'),
(NULL,'internal','Client escalation','Escalation on {event}: {issue}. Owning it — will update by {deadline}.',ARRAY['event','issue','deadline'],'urgent'),
(NULL,'internal','Weekend coverage','Need weekend coverage for {event}. Reply if you can cover any slot.',ARRAY['event'],'professional'),
(NULL,'internal','New team member','Welcome {name} — joining as {role}. Please make them feel at home.',ARRAY['name','role'],'friendly'),
(NULL,'internal','Sprint review','Sprint review Friday {time}. Bring demos, blockers, and priorities for next sprint.',ARRAY['time'],'professional'),

-- Timeline (6)
(NULL,'timeline','Timeline draft — planners','Attaching v1 of the day-of timeline. Review by {deadline} please.',ARRAY['deadline'],'professional'),
(NULL,'timeline','Timeline update','Timeline updated — key changes: {changes}. Latest version attached.',ARRAY['changes'],'professional'),
(NULL,'timeline','Rehearsal reminder','Rehearsal is {date} at {time}, {location}. Please arrive 10 minutes early.',ARRAY['date','time','location'],'friendly'),
(NULL,'timeline','Ceremony order','Ceremony order attached. Processional begins promptly at {time}.',ARRAY['time'],'professional'),
(NULL,'timeline','Reception flow','Reception flow: cocktail {time1}, seated dinner {time2}, first dance {time3}, cake {time4}.',ARRAY['time1','time2','time3','time4'],'professional'),
(NULL,'timeline','Wrap and load-out','Wrap begins {time}. Load-out complete by {end}. Contact on site: {coordinator}.',ARRAY['time','end','coordinator'],'professional'),

-- RSVP (4)
(NULL,'rsvp','RSVP confirmed','Thanks {name} — RSVP confirmed for {count}. Full details will follow closer to the date.',ARRAY['name','count'],'friendly'),
(NULL,'rsvp','RSVP declined ack','Thanks for letting us know, {name}. We''ll miss you and hope to celebrate together another time.',ARRAY['name'],'friendly'),
(NULL,'rsvp','RSVP change request','Hi {name}, we received your RSVP change to {count}. Confirming this is correct?',ARRAY['name','count'],'professional'),
(NULL,'rsvp','Waitlist offer','Hi {name}, a spot opened up — would you still like to join us on {date}?',ARRAY['name','date'],'friendly'),

-- Thank you (4)
(NULL,'thank_you','Guest thank you','Thank you {name} for celebrating with us. Your presence meant the world.',ARRAY['name'],'friendly'),
(NULL,'thank_you','Vendor thank you','Thank you {vendor} — your work was flawless. We''re still hearing from guests about it.',ARRAY['vendor'],'friendly'),
(NULL,'thank_you','Team thank you','Team — that was a masterclass. Thank you for the care and craft.',ARRAY[]::text[],'friendly'),
(NULL,'thank_you','Client thank you','Thank you for trusting us with {event}. It was an honor.',ARRAY['event'],'friendly'),

-- Emergency (6)
(NULL,'emergency','Weather advisory','Weather advisory for {date}: {details}. Backup plan attached — please confirm receipt.',ARRAY['date','details'],'urgent'),
(NULL,'emergency','Venue change','Important: venue change for {event}. New location: {venue}, same start time. Reply to confirm.',ARRAY['event','venue'],'urgent'),
(NULL,'emergency','Time change','Time change for {event}: now {time}. Please update calendars.',ARRAY['event','time'],'urgent'),
(NULL,'emergency','Vendor no-show','Backup plan in effect for {vendor} no-show. {solution} — I''ll update within the hour.',ARRAY['vendor','solution'],'urgent'),
(NULL,'emergency','Health notice','Small health notice for {event}: {details}. Precautions in place.',ARRAY['event','details'],'urgent'),
(NULL,'emergency','Postponement','With care and after much thought, {event} is being postponed. New date TBD; we''ll be in touch within {timeframe}.',ARRAY['event','timeframe'],'professional'),

-- Contracts (4)
(NULL,'contracts','Contract review','Hi {name}, contract attached — please review and share any redlines by {deadline}.',ARRAY['name','deadline'],'professional'),
(NULL,'contracts','Contract signed','Hi {name}, countersigned contract attached. Officially official.',ARRAY['name'],'professional'),
(NULL,'contracts','Amendment sent','Hi {name}, amendment reflecting {changes} attached. Please sign at your convenience.',ARRAY['name','changes'],'professional'),
(NULL,'contracts','Contract expiring','Hi {name}, contract expires {date}. Let''s discuss renewal.',ARRAY['name','date'],'professional'),

-- Travel (4)
(NULL,'travel','Flight details request','Hi {name}, share your flight details so we can arrange transfers.',ARRAY['name'],'professional'),
(NULL,'travel','Transfer schedule','Hi {name}, your transfer: {vehicle} at {time} from {pickup}. Driver: {driver}.',ARRAY['name','vehicle','time','pickup','driver'],'professional'),
(NULL,'travel','Airport pickup change','Hi {name}, pickup time moved to {time} due to traffic. Same driver.',ARRAY['name','time'],'professional'),
(NULL,'travel','Welcome bag delivered','Hi {name}, welcome bag is at the front desk under your name. Enjoy!',ARRAY['name'],'friendly'),

-- Announcements (4)
(NULL,'announcements','Event announcement','Excited to share {event} on {date} at {venue}. Details to follow.',ARRAY['event','date','venue'],'friendly'),
(NULL,'announcements','New feature announcement','New in your planner: {feature}. Try it in your dashboard.',ARRAY['feature'],'professional'),
(NULL,'announcements','Team announcement','Team update: {news}.',ARRAY['news'],'professional'),
(NULL,'announcements','Public announcement','We''re thrilled to share {news}. Thank you for being part of this journey.',ARRAY['news'],'friendly'),

-- Marketing (4)
(NULL,'marketing','Booking window opening','Booking for {season} events opens {date}. Early birds get first pick.',ARRAY['season','date'],'friendly'),
(NULL,'marketing','Case study share','Case study on {event}: how we brought {vision} to life. Link inside.',ARRAY['event','vision'],'professional'),
(NULL,'marketing','Referral program','Refer a couple, earn {reward}. Details attached.',ARRAY['reward'],'friendly'),
(NULL,'marketing','Testimonial request','Hi {name}, would you share a short testimonial about your experience?',ARRAY['name'],'friendly')
;


-- === Migration: 20260713010901_cbe90f6f-b8ba-4311-87fe-1c9853bd7a2f.sql ===

-- =========================================================================
-- 1) Move SECURITY DEFINER RLS helpers out of the exposed public schema
-- =========================================================================
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

-- Recreate helpers inside app_private
CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION app_private.has_event_access(_event_id uuid, _user_id uuid, _min public.event_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events e WHERE e.id = _event_id AND e.owner_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.event_members m
        WHERE m.event_id = _event_id AND m.user_id = _user_id
          AND public.event_role_rank(m.role) >= public.event_role_rank(_min)
      );
$$;

CREATE OR REPLACE FUNCTION app_private.is_event_member(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events e WHERE e.id = _event_id AND e.owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.event_members m WHERE m.event_id = _event_id AND m.user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION app_private.is_conversation_participant(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = _conv AND c.owner_id = _user)
      OR EXISTS (SELECT 1 FROM public.conversation_participants p WHERE p.conversation_id = _conv AND p.user_id = _user);
$$;

REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.has_event_access(uuid, uuid, public.event_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_event_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_conversation_participant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.has_event_access(uuid, uuid, public.event_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_event_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_conversation_participant(uuid, uuid) TO authenticated, service_role;

-- Rewrite every policy to use the app_private helpers
-- activity_log
DROP POLICY IF EXISTS "Activity: members insert" ON public.activity_log;
DROP POLICY IF EXISTS "Activity: members read" ON public.activity_log;
CREATE POLICY "Activity: members insert" ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (app_private.is_event_member(event_id, auth.uid()) AND actor_id = auth.uid());
CREATE POLICY "Activity: members read" ON public.activity_log FOR SELECT TO authenticated
  USING (app_private.is_event_member(event_id, auth.uid()));

-- budget_items
DROP POLICY IF EXISTS "Budget: editors delete" ON public.budget_items;
DROP POLICY IF EXISTS "Budget: editors insert" ON public.budget_items;
DROP POLICY IF EXISTS "Budget: editors update" ON public.budget_items;
DROP POLICY IF EXISTS "Budget: members read" ON public.budget_items;
CREATE POLICY "Budget: editors delete" ON public.budget_items FOR DELETE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::public.event_role));
CREATE POLICY "Budget: editors insert" ON public.budget_items FOR INSERT TO authenticated
  WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::public.event_role));
CREATE POLICY "Budget: editors update" ON public.budget_items FOR UPDATE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::public.event_role))
  WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::public.event_role));
CREATE POLICY "Budget: members read" ON public.budget_items FOR SELECT TO authenticated
  USING (app_private.is_event_member(event_id, auth.uid()));

-- conversation_participants
DROP POLICY IF EXISTS "cp: participants can read" ON public.conversation_participants;
CREATE POLICY "cp: participants can read" ON public.conversation_participants FOR SELECT TO authenticated
  USING (app_private.is_conversation_participant(conversation_id, auth.uid()));

-- conversations
DROP POLICY IF EXISTS "conv: participants can read" ON public.conversations;
CREATE POLICY "conv: participants can read" ON public.conversations FOR SELECT TO authenticated
  USING (app_private.is_conversation_participant(id, auth.uid()));

-- events
DROP POLICY IF EXISTS "Events: editors and above can update" ON public.events;
DROP POLICY IF EXISTS "Events: members can view" ON public.events;
CREATE POLICY "Events: editors and above can update" ON public.events FOR UPDATE TO authenticated
  USING (app_private.has_event_access(id, auth.uid(), 'editor'::public.event_role))
  WITH CHECK (app_private.has_event_access(id, auth.uid(), 'editor'::public.event_role));
CREATE POLICY "Events: members can view" ON public.events FOR SELECT TO authenticated
  USING (app_private.is_event_member(id, auth.uid()));

-- guests
DROP POLICY IF EXISTS "Guests: editors delete" ON public.guests;
DROP POLICY IF EXISTS "Guests: editors insert" ON public.guests;
DROP POLICY IF EXISTS "Guests: editors update" ON public.guests;
DROP POLICY IF EXISTS "Guests: members read" ON public.guests;
CREATE POLICY "Guests: editors delete" ON public.guests FOR DELETE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::public.event_role));
CREATE POLICY "Guests: editors insert" ON public.guests FOR INSERT TO authenticated
  WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::public.event_role));
CREATE POLICY "Guests: editors update" ON public.guests FOR UPDATE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::public.event_role))
  WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::public.event_role));
CREATE POLICY "Guests: members read" ON public.guests FOR SELECT TO authenticated
  USING (app_private.is_event_member(event_id, auth.uid()));

-- messages
DROP POLICY IF EXISTS "msg: participants can insert" ON public.messages;
DROP POLICY IF EXISTS "msg: participants can read" ON public.messages;
CREATE POLICY "msg: participants can insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND app_private.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "msg: participants can read" ON public.messages FOR SELECT TO authenticated
  USING (app_private.is_conversation_participant(conversation_id, auth.uid()));

-- tasks
DROP POLICY IF EXISTS "Tasks: editors delete" ON public.tasks;
DROP POLICY IF EXISTS "Tasks: editors insert" ON public.tasks;
DROP POLICY IF EXISTS "Tasks: editors update" ON public.tasks;
DROP POLICY IF EXISTS "Tasks: members read" ON public.tasks;
CREATE POLICY "Tasks: editors delete" ON public.tasks FOR DELETE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::public.event_role));
CREATE POLICY "Tasks: editors insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::public.event_role));
CREATE POLICY "Tasks: editors update" ON public.tasks FOR UPDATE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::public.event_role))
  WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::public.event_role));
CREATE POLICY "Tasks: members read" ON public.tasks FOR SELECT TO authenticated
  USING (app_private.is_event_member(event_id, auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert user roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update user roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

-- event_members: rewrite existing policies against new helpers, and tighten insert
DROP POLICY IF EXISTS "Members: admins can add" ON public.event_members;
DROP POLICY IF EXISTS "Members: admins can remove" ON public.event_members;
DROP POLICY IF EXISTS "Members: admins can update" ON public.event_members;
DROP POLICY IF EXISTS "Members: members can view roster" ON public.event_members;
CREATE POLICY "Members: admins can add" ON public.event_members FOR INSERT TO authenticated
  WITH CHECK (
    app_private.has_event_access(event_id, auth.uid(), 'admin'::public.event_role)
    AND (
      invited_email IS NULL
      OR (
        invited_email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.email) = lower(invited_email))
      )
    )
  );
CREATE POLICY "Members: admins can remove" ON public.event_members FOR DELETE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'admin'::public.event_role));
CREATE POLICY "Members: admins can update" ON public.event_members FOR UPDATE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'admin'::public.event_role))
  WITH CHECK (
    app_private.has_event_access(event_id, auth.uid(), 'admin'::public.event_role)
    AND (
      invited_email IS NULL
      OR (
        invited_email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.email) = lower(invited_email))
      )
    )
  );
CREATE POLICY "Members: members can view roster" ON public.event_members FOR SELECT TO authenticated
  USING (app_private.is_event_member(event_id, auth.uid()));

-- Drop the now-unused public helpers so they can no longer be called via API
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.has_event_access(uuid, uuid, public.event_role);
DROP FUNCTION IF EXISTS public.is_event_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_conversation_participant(uuid, uuid);

-- =========================================================================
-- 2) message_template_versions: allow owner update/delete
-- =========================================================================
CREATE POLICY "tplv: update own" ON public.message_template_versions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.message_templates t WHERE t.id = message_template_versions.template_id AND t.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.message_templates t WHERE t.id = message_template_versions.template_id AND t.owner_id = auth.uid()));
CREATE POLICY "tplv: delete own" ON public.message_template_versions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.message_templates t WHERE t.id = message_template_versions.template_id AND t.owner_id = auth.uid()));

-- =========================================================================
-- 3) vendor_profiles: allow authenticated users to discover onboarded vendors
-- =========================================================================
CREATE POLICY "Vendor profiles: discoverable when onboarded" ON public.vendor_profiles FOR SELECT TO authenticated
  USING (onboarding_completed = true);


-- === Migration: 20260713041338_e240273e-5014-4c1b-953e-52ec6fbc7f45.sql ===

-- 1. event_files table
CREATE TABLE public.event_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'other',
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX event_files_event_id_idx ON public.event_files(event_id);
CREATE INDEX event_files_uploaded_by_idx ON public.event_files(uploaded_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_files TO authenticated;
GRANT ALL ON public.event_files TO service_role;

ALTER TABLE public.event_files ENABLE ROW LEVEL SECURITY;

-- Members of the event can see files
CREATE POLICY "Event members can view files"
  ON public.event_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_files.event_id AND e.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.event_members m
      WHERE m.event_id = event_files.event_id AND m.user_id = auth.uid()
    )
  );

-- Uploader (must be a member) can insert
CREATE POLICY "Members can upload files"
  ON public.event_files FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.event_members m WHERE m.event_id = event_id AND m.user_id = auth.uid())
    )
  );

-- Uploader can update own metadata
CREATE POLICY "Uploader can update own files"
  ON public.event_files FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

-- Uploader or event owner can delete
CREATE POLICY "Uploader or event owner can delete files"
  ON public.event_files FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_files.event_id AND e.owner_id = auth.uid()
    )
  );

CREATE TRIGGER event_files_set_updated_at
  BEFORE UPDATE ON public.event_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Storage policies on bridgevault bucket
-- Objects are stored under `${auth.uid()}/${event_id}/${filename}`
CREATE POLICY "Users can read own bridgevault files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'bridgevault'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload to own bridgevault path"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bridgevault'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own bridgevault files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'bridgevault'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own bridgevault files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bridgevault'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- === Migration: 20260713044102_4d8b8e2b-c654-4b7f-8e60-0d77a4d6bb27.sql ===
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.has_active_subscription(
  user_uuid uuid,
  check_env text DEFAULT 'live'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND (
        (status IN ('active', 'trialing', 'past_due') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated, anon;

-- === Migration: 20260713044722_d5f991cb-4965-4f8a-92a4-dcdea6cb266b.sql ===
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO service_role;

-- === Migration: 20260713045818_d8a0b5df-eeba-42c5-a924-5f78fd59f72f.sql ===

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  body text,
  href text,
  icon text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications read"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own notifications update"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own notifications delete"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "service role manages notifications"
  ON public.notifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.notify_message_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  convo record;
  participant_id uuid;
  preview text;
BEGIN
  SELECT id, title, type, owner_id INTO convo
  FROM public.conversations WHERE id = NEW.conversation_id;

  preview := COALESCE(LEFT(NEW.body, 140), '');

  FOR participant_id IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id
      AND user_id <> NEW.sender_id
    UNION
    SELECT convo.owner_id WHERE convo.owner_id IS NOT NULL AND convo.owner_id <> NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, category, title, body, href, entity_type, entity_id)
    VALUES (
      participant_id,
      'messages',
      COALESCE(convo.title, 'New message'),
      preview,
      '/messaging',
      'conversation',
      NEW.conversation_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_message_participants ON public.messages;
CREATE TRIGGER trg_notify_message_participants
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_message_participants();

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


-- === Migration: 20260713045830_88fda6a4-aa9e-4286-a6da-1636397845ac.sql ===
REVOKE EXECUTE ON FUNCTION public.notify_message_participants() FROM PUBLIC, anon, authenticated;

-- === Migration: 20260713053801_719081c0-5b3a-4639-b8d3-b38bd9af4537.sql ===

-- 1. Extend app_role enum with 'attendee'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'attendee';

-- 2. Add is_test_seed marker to seedable tables
ALTER TABLE public.events            ADD COLUMN IF NOT EXISTS is_test_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.guests            ADD COLUMN IF NOT EXISTS is_test_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.tasks             ADD COLUMN IF NOT EXISTS is_test_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.budget_items      ADD COLUMN IF NOT EXISTS is_test_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.event_files       ADD COLUMN IF NOT EXISTS is_test_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.conversations     ADD COLUMN IF NOT EXISTS is_test_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.messages          ADD COLUMN IF NOT EXISTS is_test_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.notifications     ADD COLUMN IF NOT EXISTS is_test_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendor_profiles   ADD COLUMN IF NOT EXISTS is_test_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.subscriptions     ADD COLUMN IF NOT EXISTS is_test_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles          ADD COLUMN IF NOT EXISTS is_test_seed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_is_test_seed        ON public.events (is_test_seed) WHERE is_test_seed;
CREATE INDEX IF NOT EXISTS idx_notifications_is_test_seed ON public.notifications (is_test_seed) WHERE is_test_seed;

-- 3. Extend profile → role sync trigger to include 'attendee'
CREATE OR REPLACE FUNCTION public.sync_role_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.account_type IS NOT NULL AND NEW.account_type IN ('planner','vendor','guest','attendee') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, NEW.account_type::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Seed function — admin-only, idempotent (wipe first, then insert)
CREATE OR REPLACE FUNCTION public.seed_test_data(
  planner_id  uuid,
  vendor_id   uuid,
  attendee_id uuid,
  guest_id    uuid,
  admin_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_draft     uuid := gen_random_uuid();
  event_upcoming  uuid := gen_random_uuid();
  event_completed uuid := gen_random_uuid();
  convo_id        uuid := gen_random_uuid();
  vendor_convo_id uuid := gen_random_uuid();
BEGIN
  -- Only admin may call this
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admin can seed test data' USING ERRCODE = '42501';
  END IF;

  -- Wipe existing seed rows first (idempotent)
  PERFORM public.wipe_test_data();

  -- Mark profiles as test seed for identification (do not overwrite real names)
  UPDATE public.profiles SET is_test_seed = true, account_type = 'planner',  display_name = 'Test Planner'  WHERE id = planner_id;
  UPDATE public.profiles SET is_test_seed = true, account_type = 'vendor',   display_name = 'Test Vendor'   WHERE id = vendor_id;
  UPDATE public.profiles SET is_test_seed = true, account_type = 'attendee', display_name = 'Test Attendee' WHERE id = attendee_id;
  UPDATE public.profiles SET is_test_seed = true, account_type = 'guest',    display_name = 'Test Guest'    WHERE id = guest_id;
  UPDATE public.profiles SET is_test_seed = true,                            display_name = 'Test Admin'    WHERE id = admin_id;

  -- Ensure role rows exist
  INSERT INTO public.user_roles (user_id, role) VALUES
    (planner_id,'planner'), (vendor_id,'vendor'), (attendee_id,'attendee'),
    (guest_id,'guest'), (admin_id,'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- === PLANNER: 3 events (draft/upcoming/completed) ===
  INSERT INTO public.events (id, owner_id, name, event_type, description, event_date, event_time, location, budget_target, guest_target, status, is_test_seed) VALUES
    (event_draft,     planner_id, 'Priya & Arjun Sangeet',   'Sangeet',      'Draft plan for the sangeet night.',       (CURRENT_DATE + 90)::date, '18:00', 'Rosewood Hall, Atlanta GA',   15000, 120, 'draft',     true),
    (event_upcoming,  planner_id, 'The Patel Wedding',       'Wedding',      'Multi-day wedding celebration.',          (CURRENT_DATE + 30)::date, '16:00', 'Grand Palazzo, Miami FL',     85000, 350, 'confirmed', true),
    (event_completed, planner_id, 'Sharma Anniversary Gala', 'Anniversary',  '25th anniversary celebration.',           (CURRENT_DATE - 45)::date, '19:00', 'Ritz Carlton, Chicago IL',    42000, 180, 'completed', true);

  -- Event members
  INSERT INTO public.event_members (event_id, user_id, role) VALUES
    (event_upcoming,  planner_id, 'owner'),
    (event_upcoming,  vendor_id,  'editor'),
    (event_completed, planner_id, 'owner')
  ON CONFLICT DO NOTHING;

  -- Guests for upcoming event
  INSERT INTO public.guests (event_id, full_name, email, phone, household, rsvp_status, plus_ones, meal_choice, is_test_seed) VALUES
    (event_upcoming, 'Rajesh Kumar',     'rajesh.k@example.com',   '+1-555-0101', 'Kumar Family',    'yes',     2, 'Vegetarian', true),
    (event_upcoming, 'Anita Sharma',     'anita.s@example.com',    '+1-555-0102', 'Sharma Family',   'yes',     1, 'Vegan',      true),
    (event_upcoming, 'Vikram Singh',     'vikram.s@example.com',   '+1-555-0103', 'Singh Family',    'no',      0, NULL,         true),
    (event_upcoming, 'Meera Patel',      'meera.p@example.com',    '+1-555-0104', 'Patel Family',    'maybe',   1, 'Non-Veg',    true),
    (event_upcoming, 'Deepak Iyer',      'deepak.i@example.com',   '+1-555-0105', 'Iyer Family',     'yes',     0, 'Vegetarian', true),
    (event_upcoming, 'Kavya Reddy',      'kavya.r@example.com',    '+1-555-0106', 'Reddy Family',    'pending', 0, NULL,         true),
    (event_upcoming, 'Arjun Mehta',      'arjun.m@example.com',    '+1-555-0107', 'Mehta Family',    'yes',     2, 'Non-Veg',    true),
    -- Attendee has real account
    (event_upcoming, 'Test Attendee',    'attendee@test.melabridge.com', NULL, 'Attendee Household','yes',   1, 'Vegetarian', true);

  -- Invite guest (pending)
  INSERT INTO public.guests (event_id, full_name, email, rsvp_status, plus_ones, is_test_seed) VALUES
    (event_upcoming, 'Test Guest', 'guest@test.melabridge.com', 'pending', 0, true);

  -- Tasks
  INSERT INTO public.tasks (event_id, title, description, status, priority, due_date, assigned_to, created_by, is_test_seed) VALUES
    (event_upcoming, 'Finalize catering menu',      'Confirm final menu with Spice Route Caterers.', 'in_progress', 'high',   (CURRENT_DATE+7),  planner_id, planner_id, true),
    (event_upcoming, 'Confirm floral arrangements', 'Sign off on centerpieces and mandap decor.',    'todo',        'medium', (CURRENT_DATE+10), planner_id, planner_id, true),
    (event_upcoming, 'Send save-the-dates',         'All guests confirmed via email.',               'done',        'low',    (CURRENT_DATE-14), planner_id, planner_id, true),
    (event_upcoming, 'Book DJ',                     'Confirm DJ Ravi for reception.',                'todo',        'urgent', (CURRENT_DATE+3),  planner_id, planner_id, true),
    (event_upcoming, 'Order welcome bags',          'Include itinerary and local treats.',           'todo',        'low',    (CURRENT_DATE+21), planner_id, planner_id, true);

  -- Budget items
  INSERT INTO public.budget_items (event_id, category, label, estimated_amount, actual_amount, paid_amount, vendor_name, created_by, is_test_seed) VALUES
    (event_upcoming, 'Venue',      'Grand Palazzo rental',    25000, 25000, 12500, 'Grand Palazzo',        planner_id, true),
    (event_upcoming, 'Catering',   'Dinner + appetizers',     18000, 17500,  8000, 'Spice Route',          planner_id, true),
    (event_upcoming, 'Florals',    'Mandap + centerpieces',    8000,  7200,     0, 'Bloom & Petal',        planner_id, true),
    (event_upcoming, 'Photography','Full-day coverage',       12000, 12000,  6000, 'Lens Story Studio',    planner_id, true),
    (event_upcoming, 'Music',      'DJ + live musicians',      7000,     0,     0, NULL,                    planner_id, true),
    (event_upcoming, 'Attire',     'Bridal outfits',          15000, 14200, 14200, 'Anokhi Couture',        planner_id, true);

  -- Files
  INSERT INTO public.event_files (event_id, uploaded_by, category, storage_path, filename, mime_type, size_bytes, is_test_seed) VALUES
    (event_upcoming, planner_id, 'contracts', 'test-seed/venue-contract.pdf',    'venue-contract.pdf',      'application/pdf', 245000, true),
    (event_upcoming, planner_id, 'invoices',  'test-seed/catering-invoice.pdf',  'catering-invoice.pdf',    'application/pdf',  85000, true),
    (event_upcoming, planner_id, 'photos',    'test-seed/venue-preview.jpg',     'venue-preview.jpg',       'image/jpeg',      420000, true);

  -- Conversation (planner ↔ vendor)
  INSERT INTO public.conversations (id, owner_id, title, type, labels, last_message_at, last_message_preview, is_test_seed) VALUES
    (vendor_convo_id, planner_id, 'Spice Route — catering thread', 'direct', ARRAY['vendor'], now(), 'Menu locked in — thanks!', true);
  INSERT INTO public.conversation_participants (conversation_id, user_id, participant_role) VALUES
    (vendor_convo_id, planner_id, 'owner'),
    (vendor_convo_id, vendor_id,  'member')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.messages (conversation_id, sender_id, body, attachments, status, is_test_seed) VALUES
    (vendor_convo_id, planner_id, 'Hi, sending over the guest count update — 350 confirmed.', '[]'::jsonb, 'delivered', true),
    (vendor_convo_id, vendor_id,  'Got it. I''ll update the menu proposal today.',            '[]'::jsonb, 'delivered', true),
    (vendor_convo_id, planner_id, 'Menu locked in — thanks!',                                 '[]'::jsonb, 'delivered', true);

  -- Planner notifications
  INSERT INTO public.notifications (user_id, category, title, body, href, is_test_seed) VALUES
    (planner_id, 'messages', 'New reply from Spice Route',      'Menu proposal updated.',         '/messaging',     true),
    (planner_id, 'team',     'Vendor accepted invite',          'Test Vendor joined your event.', '/events',        true);

  -- Planner subscription (sandbox active)
  INSERT INTO public.subscriptions (user_id, stripe_subscription_id, stripe_customer_id, product_id, price_id, status, current_period_start, current_period_end, cancel_at_period_end, environment, is_test_seed) VALUES
    (planner_id, 'sub_test_seed_planner', 'cus_test_seed_planner', 'prod_test_planner_pro', 'planner_pro_monthly', 'active', now(), now() + interval '30 days', false, 'sandbox', true);

  -- === VENDOR ===
  INSERT INTO public.vendor_profiles (user_id, business_name, business_category, business_description, phone, email, website, city, state, starting_price, years_in_business, accepted_terms, onboarding_completed, is_test_seed)
  VALUES (vendor_id, 'Spice Route Caterers', 'Catering', 'Award-winning South Asian catering for weddings and events.', '+1-555-0200', 'vendor@test.melabridge.com', 'https://example.com/spice-route', 'Miami', 'FL', 85, 12, true, true, true)
  ON CONFLICT (user_id) DO UPDATE SET is_test_seed = true, onboarding_completed = true;

  -- Vendor notifications
  INSERT INTO public.notifications (user_id, category, title, body, href, is_test_seed) VALUES
    (vendor_id, 'messages', 'New inquiry from Test Planner', 'Wants pricing for 350 guests.', '/messaging',      true),
    (vendor_id, 'payments', 'Deposit received',              '$8,000 deposit from Patel Wedding.', '/subscription', true);

  -- === ATTENDEE ===
  INSERT INTO public.notifications (user_id, category, title, body, href, is_test_seed) VALUES
    (attendee_id, 'system',   'Your ticket is confirmed',  'The Patel Wedding — 1 guest.', '/tickets',   true),
    (attendee_id, 'messages', 'Message from planner',      'Welcome bag details attached.', '/messaging', true);

  -- === GUEST ===
  INSERT INTO public.notifications (user_id, category, title, body, href, is_test_seed) VALUES
    (guest_id, 'system', 'You have a new invite', 'The Patel Wedding — RSVP by next week.', '/guest-portal', true);

  -- === ADMIN ===
  INSERT INTO public.notifications (user_id, category, title, body, href, is_test_seed) VALUES
    (admin_id, 'system', '3 vendor applications pending review', NULL, '/admin', true),
    (admin_id, 'system', 'Platform activity summary ready',      NULL, '/reports', true);

  RETURN jsonb_build_object(
    'ok', true,
    'events', 3,
    'guests', 9,
    'tasks',  5,
    'budget_items', 6,
    'files',  3,
    'messages', 3,
    'notifications', 9
  );
END;
$$;

-- 5. Wipe function
CREATE OR REPLACE FUNCTION public.wipe_test_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_events int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admin can wipe test data' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.messages          WHERE is_test_seed;
  DELETE FROM public.conversation_participants WHERE conversation_id IN (SELECT id FROM public.conversations WHERE is_test_seed);
  DELETE FROM public.conversations     WHERE is_test_seed;
  DELETE FROM public.notifications     WHERE is_test_seed;
  DELETE FROM public.event_files       WHERE is_test_seed;
  DELETE FROM public.budget_items      WHERE is_test_seed;
  DELETE FROM public.tasks             WHERE is_test_seed;
  DELETE FROM public.guests            WHERE is_test_seed;
  DELETE FROM public.event_members     WHERE event_id IN (SELECT id FROM public.events WHERE is_test_seed);
  DELETE FROM public.events            WHERE is_test_seed RETURNING 1 INTO n_events;
  DELETE FROM public.subscriptions     WHERE is_test_seed;
  UPDATE public.vendor_profiles SET onboarding_completed = false WHERE is_test_seed;
  DELETE FROM public.vendor_profiles   WHERE is_test_seed;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Grants: only authenticated may call; body enforces admin role
REVOKE ALL ON FUNCTION public.seed_test_data(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wipe_test_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_test_data(uuid,uuid,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wipe_test_data() TO authenticated;


-- === Migration: 20260713055013_04c84634-1431-4515-8f72-5425e89b3ec3.sql ===
-- Seed admin role for dev user if they exist in this project.
-- Wrapped in a guard so this is safe on a fresh database (user won't exist on new projects).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '62b67a04-8069-4c48-a848-38c43cf40ae1') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES ('62b67a04-8069-4c48-a848-38c43cf40ae1', 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;


-- === Migration: 20260713055613_604c0f5f-1fd3-446e-b5c0-ddb7f0a20946.sql ===

-- 1) Fix broken INSERT policy on event_files
DROP POLICY IF EXISTS "Members can upload files" ON public.event_files;
CREATE POLICY "Members can upload files" ON public.event_files
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_files.event_id AND e.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_members m WHERE m.event_id = event_files.event_id AND m.user_id = auth.uid())
  )
);

-- 2) Vendor profiles: remove broad discoverability policy so contact fields are owner-only.
--    Expose a curated view with only safe marketing columns for discovery.
DROP POLICY IF EXISTS "Vendor profiles: discoverable when onboarded" ON public.vendor_profiles;

-- Also allow event owners to read vendor contact info when the vendor is a member of their event
CREATE POLICY "Vendor profiles: event owner read for their vendors"
ON public.vendor_profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.event_members m
    JOIN public.events e ON e.id = m.event_id
    WHERE m.user_id = vendor_profiles.user_id AND e.owner_id = auth.uid()
  )
);

-- Public marketing view — no email, phone, or business_address
CREATE OR REPLACE VIEW public.vendor_profiles_public AS
SELECT
  id,
  user_id,
  business_name,
  business_category,
  business_description,
  website,
  logo_url,
  city,
  state,
  travel_radius,
  mobile_service,
  virtual_services,
  years_in_business,
  starting_price,
  business_hours,
  social_links,
  portfolio_urls,
  onboarding_completed,
  created_at,
  updated_at
FROM public.vendor_profiles
WHERE onboarding_completed = true;

GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;

-- 3) Lock down SECURITY DEFINER seed/wipe functions to service_role only
REVOKE ALL ON FUNCTION public.seed_test_data(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wipe_test_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_test_data(uuid, uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.wipe_test_data() TO service_role;


-- === Migration: 20260713055717_de3335a1-a083-4f56-819a-2689e6614c0d.sql ===
ALTER VIEW public.vendor_profiles_public SET (security_invoker = true);
-- Ensure the invoker (anon / authenticated) can pass RLS for the underlying rows.
-- Add a narrow row-visibility policy on the base table so the view returns onboarded rows
-- without exposing contact columns (columns not selected by the view are never read).
DROP POLICY IF EXISTS "Vendor profiles: view can read onboarded" ON public.vendor_profiles;
CREATE POLICY "Vendor profiles: view can read onboarded"
ON public.vendor_profiles FOR SELECT TO authenticated, anon
USING (onboarding_completed = true);

-- === Migration: 20260713055750_689b03dc-16a4-4f91-a045-605e60f945aa.sql ===
-- Revoke broad SELECT on base table; grant SELECT only on safe columns.
REVOKE SELECT ON public.vendor_profiles FROM anon, authenticated;

GRANT SELECT (
  id, user_id, business_name, business_category, business_description,
  website, logo_url, city, state, travel_radius, mobile_service, virtual_services,
  years_in_business, starting_price, business_hours, social_links, portfolio_urls,
  onboarding_completed, created_at, updated_at, is_test_seed
) ON public.vendor_profiles TO anon, authenticated;

-- Owner needs to read all columns (email, phone, business_address, accepted_terms).
-- Grant sensitive column SELECT to authenticated; RLS "owner full read" +
-- "event owner read for their vendors" gate rows.
GRANT SELECT (email, phone, business_address, accepted_terms)
  ON public.vendor_profiles TO authenticated;

-- The broad "view can read onboarded" policy would expose sensitive columns to any
-- authenticated user if they SELECT those columns. Column grants block that for anon,
-- but authenticated has the grant (for owners). Restrict the row policy: only expose
-- onboarded rows for the safe columns via a separate role — solved by keeping the row
-- policy as-is (auth can see the row) but relying on the column grant for auth to
-- include sensitive columns only when the row-level owner policy also permits.
-- In Postgres, column privileges are AND'd with RLS. We need the sensitive columns
-- readable ONLY when auth.uid() = user_id. Use a dedicated policy for those columns:
-- Postgres has no per-column RLS, so instead we split: revoke sensitive column SELECT
-- from authenticated at large, and re-grant via a SECURITY DEFINER function or view
-- if needed. Since owner already has the row via "owner full read" policy and column
-- grant, but any authenticated user also passes "view can read onboarded" for onboarded
-- rows and holds the column grant on email/phone → still exposed.
-- Fix: revoke sensitive column grants from authenticated; owner reads sensitive fields
-- through a dedicated SECURITY INVOKER view scoped to auth.uid() = user_id.
REVOKE SELECT (email, phone, business_address, accepted_terms)
  ON public.vendor_profiles FROM authenticated;

-- Owner-scoped full view (security_invoker so RLS applies with owner's session).
CREATE OR REPLACE VIEW public.vendor_profiles_self AS
SELECT * FROM public.vendor_profiles WHERE user_id = auth.uid();
ALTER VIEW public.vendor_profiles_self SET (security_invoker = true);
GRANT SELECT ON public.vendor_profiles_self TO authenticated;

-- Event-owner view for reading their engaged vendors' contact info
CREATE OR REPLACE VIEW public.vendor_profiles_for_event_owner AS
SELECT vp.*
FROM public.vendor_profiles vp
WHERE EXISTS (
  SELECT 1 FROM public.event_members m
  JOIN public.events e ON e.id = m.event_id
  WHERE m.user_id = vp.user_id AND e.owner_id = auth.uid()
);
ALTER VIEW public.vendor_profiles_for_event_owner SET (security_invoker = true);
GRANT SELECT ON public.vendor_profiles_for_event_owner TO authenticated;

-- For the two owner-scoped views to return sensitive columns, the invoker still needs
-- column-level SELECT on those columns. Grant them back but rely on the base table RLS
-- ("owner full read" + "event owner read for their vendors") to hide non-matching rows.
-- Since RLS filters rows, the column grant only matters for rows the policy already exposes.
GRANT SELECT (email, phone, business_address, accepted_terms)
  ON public.vendor_profiles TO authenticated;

-- Drop the broad discoverability policy on the base table so authenticated users cannot
-- select sensitive columns from arbitrary onboarded vendors. Discovery uses the public view.
DROP POLICY IF EXISTS "Vendor profiles: view can read onboarded" ON public.vendor_profiles;

-- Recreate a discoverability policy restricted to rows the caller does NOT own or engage,
-- but column grants on sensitive columns are still available to authenticated. Postgres
-- cannot express per-column RLS, so we accept: for onboarded rows, sensitive columns are
-- readable by any authenticated user if they select them. To close this, drop the discovery
-- policy entirely and route ALL discovery through the security_invoker view on a policy
-- that returns onboarded rows ONLY through a safe-column projection. We simulate that by
-- keeping RLS deny-by-default and letting the marketing view use a SECURITY DEFINER
-- function.
CREATE OR REPLACE FUNCTION public.list_public_vendors()
RETURNS SETOF public.vendor_profiles_public
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.vendor_profiles_public;
$$;
REVOKE ALL ON FUNCTION public.list_public_vendors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_vendors() TO anon, authenticated;

-- Now vendor_profiles_public view is unnecessary as a directly-queried view, but keep it
-- so existing code can query it. Because we dropped the base-table row policy, the view
-- (security_invoker) will return no rows for non-owners. Re-add a narrow row policy that
-- exposes ONLY the safe columns — implemented via column grants: sensitive column grants
-- are already restricted so the only way to read email/phone is via the two owner-scoped
-- views. Add back the discovery row policy:
CREATE POLICY "Vendor profiles: discoverable rows only"
ON public.vendor_profiles FOR SELECT TO anon, authenticated
USING (onboarding_completed = true);


-- === Migration: 20260713055802_8f3612c1-8149-4754-aea6-8b1b794a8527.sql ===
DROP FUNCTION IF EXISTS public.list_public_vendors();

-- === Migration: 20260713060003_9e3ad22e-3763-4331-a2c6-5545d9d71f05.sql ===

-- Drop the broad discovery row policy — discovery goes through the safe view now.
DROP POLICY IF EXISTS "Vendor profiles: discoverable rows only" ON public.vendor_profiles;

-- Reset column-only grants and restore normal table-level SELECT for owner reads.
-- (Column grants without table grant were blocking .select("*") for the owner.)
GRANT SELECT ON public.vendor_profiles TO authenticated;
GRANT SELECT ON public.vendor_profiles TO service_role;
-- Anon should not touch the base table at all — discovery only via the view.
REVOKE ALL ON public.vendor_profiles FROM anon;

-- Public marketing view: SECURITY DEFINER (view owner's rights) so it can expose
-- onboarded, non-sensitive columns without the base table needing a broad row policy.
-- This is the pattern recommended by the finding itself.
ALTER VIEW public.vendor_profiles_public RESET (security_invoker);
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;

-- Clean up transitional views that are no longer needed
DROP VIEW IF EXISTS public.vendor_profiles_self;
DROP VIEW IF EXISTS public.vendor_profiles_for_event_owner;


-- === Migration: 20260713060211_fa223d34-329a-475a-9751-56c06641a571.sql ===

CREATE OR REPLACE FUNCTION public.wipe_test_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  n_events int;
BEGIN
  DELETE FROM public.messages          WHERE is_test_seed;
  DELETE FROM public.conversation_participants WHERE conversation_id IN (SELECT id FROM public.conversations WHERE is_test_seed);
  DELETE FROM public.conversations     WHERE is_test_seed;
  DELETE FROM public.notifications     WHERE is_test_seed;
  DELETE FROM public.event_files       WHERE is_test_seed;
  DELETE FROM public.budget_items      WHERE is_test_seed;
  DELETE FROM public.tasks             WHERE is_test_seed;
  DELETE FROM public.guests            WHERE is_test_seed;
  DELETE FROM public.event_members     WHERE event_id IN (SELECT id FROM public.events WHERE is_test_seed);
  DELETE FROM public.events            WHERE is_test_seed RETURNING 1 INTO n_events;
  DELETE FROM public.subscriptions     WHERE is_test_seed;
  UPDATE public.vendor_profiles SET onboarding_completed = false WHERE is_test_seed;
  DELETE FROM public.vendor_profiles   WHERE is_test_seed;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.seed_test_data(planner_id uuid, vendor_id uuid, attendee_id uuid, guest_id uuid, admin_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  event_draft     uuid := gen_random_uuid();
  event_upcoming  uuid := gen_random_uuid();
  event_completed uuid := gen_random_uuid();
  vendor_convo_id uuid := gen_random_uuid();
BEGIN
  -- Authorization is enforced at the API layer (service role only can invoke).
  PERFORM public.wipe_test_data();

  UPDATE public.profiles SET is_test_seed = true, account_type = 'planner',  display_name = 'Test Planner'  WHERE id = planner_id;
  UPDATE public.profiles SET is_test_seed = true, account_type = 'vendor',   display_name = 'Test Vendor'   WHERE id = vendor_id;
  UPDATE public.profiles SET is_test_seed = true, account_type = 'attendee', display_name = 'Test Attendee' WHERE id = attendee_id;
  UPDATE public.profiles SET is_test_seed = true, account_type = 'guest',    display_name = 'Test Guest'    WHERE id = guest_id;
  UPDATE public.profiles SET is_test_seed = true,                            display_name = 'Test Admin'    WHERE id = admin_id;

  INSERT INTO public.user_roles (user_id, role) VALUES
    (planner_id,'planner'), (vendor_id,'vendor'), (attendee_id,'attendee'),
    (guest_id,'guest'), (admin_id,'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.events (id, owner_id, name, event_type, description, event_date, event_time, location, budget_target, guest_target, status, is_test_seed) VALUES
    (event_draft,     planner_id, 'Priya & Arjun Sangeet',   'Sangeet',      'Draft plan for the sangeet night.',       (CURRENT_DATE + 90)::date, '18:00', 'Rosewood Hall, Atlanta GA',   15000, 120, 'draft',     true),
    (event_upcoming,  planner_id, 'The Patel Wedding',       'Wedding',      'Multi-day wedding celebration.',          (CURRENT_DATE + 30)::date, '16:00', 'Grand Palazzo, Miami FL',     85000, 350, 'confirmed', true),
    (event_completed, planner_id, 'Sharma Anniversary Gala', 'Anniversary',  '25th anniversary celebration.',           (CURRENT_DATE - 45)::date, '19:00', 'Ritz Carlton, Chicago IL',    42000, 180, 'completed', true);

  INSERT INTO public.event_members (event_id, user_id, role) VALUES
    (event_upcoming,  planner_id, 'owner'),
    (event_upcoming,  vendor_id,  'editor'),
    (event_completed, planner_id, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.guests (event_id, full_name, email, phone, household, rsvp_status, plus_ones, meal_choice, is_test_seed) VALUES
    (event_upcoming, 'Rajesh Kumar',     'rajesh.k@example.com',   '+1-555-0101', 'Kumar Family',    'yes',     2, 'Vegetarian', true),
    (event_upcoming, 'Anita Sharma',     'anita.s@example.com',    '+1-555-0102', 'Sharma Family',   'yes',     1, 'Vegan',      true),
    (event_upcoming, 'Vikram Singh',     'vikram.s@example.com',   '+1-555-0103', 'Singh Family',    'no',      0, NULL,         true),
    (event_upcoming, 'Meera Patel',      'meera.p@example.com',    '+1-555-0104', 'Patel Family',    'maybe',   1, 'Non-Veg',    true),
    (event_upcoming, 'Deepak Iyer',      'deepak.i@example.com',   '+1-555-0105', 'Iyer Family',     'yes',     0, 'Vegetarian', true),
    (event_upcoming, 'Kavya Reddy',      'kavya.r@example.com',    '+1-555-0106', 'Reddy Family',    'pending', 0, NULL,         true),
    (event_upcoming, 'Arjun Mehta',      'arjun.m@example.com',    '+1-555-0107', 'Mehta Family',    'yes',     2, 'Non-Veg',    true),
    (event_upcoming, 'Test Attendee',    'attendee@test.melabridge.com', NULL, 'Attendee Household','yes',   1, 'Vegetarian', true);

  INSERT INTO public.guests (event_id, full_name, email, rsvp_status, plus_ones, is_test_seed) VALUES
    (event_upcoming, 'Test Guest', 'guest@test.melabridge.com', 'pending', 0, true);

  INSERT INTO public.tasks (event_id, title, description, status, priority, due_date, assigned_to, created_by, is_test_seed) VALUES
    (event_upcoming, 'Finalize catering menu',      'Confirm final menu with Spice Route Caterers.', 'in_progress', 'high',   (CURRENT_DATE+7),  planner_id, planner_id, true),
    (event_upcoming, 'Confirm floral arrangements', 'Sign off on centerpieces and mandap decor.',    'todo',        'medium', (CURRENT_DATE+10), planner_id, planner_id, true),
    (event_upcoming, 'Send save-the-dates',         'All guests confirmed via email.',               'done',        'low',    (CURRENT_DATE-14), planner_id, planner_id, true),
    (event_upcoming, 'Book DJ',                     'Confirm DJ Ravi for reception.',                'todo',        'urgent', (CURRENT_DATE+3),  planner_id, planner_id, true),
    (event_upcoming, 'Order welcome bags',          'Include itinerary and local treats.',           'todo',        'low',    (CURRENT_DATE+21), planner_id, planner_id, true);

  INSERT INTO public.budget_items (event_id, category, label, estimated_amount, actual_amount, paid_amount, vendor_name, created_by, is_test_seed) VALUES
    (event_upcoming, 'Venue',      'Grand Palazzo rental',    25000, 25000, 12500, 'Grand Palazzo',        planner_id, true),
    (event_upcoming, 'Catering',   'Dinner + appetizers',     18000, 17500,  8000, 'Spice Route',          planner_id, true),
    (event_upcoming, 'Florals',    'Mandap + centerpieces',    8000,  7200,     0, 'Bloom & Petal',        planner_id, true),
    (event_upcoming, 'Photography','Full-day coverage',       12000, 12000,  6000, 'Lens Story Studio',    planner_id, true),
    (event_upcoming, 'Music',      'DJ + live musicians',      7000,     0,     0, NULL,                    planner_id, true),
    (event_upcoming, 'Attire',     'Bridal outfits',          15000, 14200, 14200, 'Anokhi Couture',        planner_id, true);

  INSERT INTO public.event_files (event_id, uploaded_by, category, storage_path, filename, mime_type, size_bytes, is_test_seed) VALUES
    (event_upcoming, planner_id, 'contracts', 'test-seed/venue-contract.pdf',    'venue-contract.pdf',      'application/pdf', 245000, true),
    (event_upcoming, planner_id, 'invoices',  'test-seed/catering-invoice.pdf',  'catering-invoice.pdf',    'application/pdf',  85000, true),
    (event_upcoming, planner_id, 'photos',    'test-seed/venue-preview.jpg',     'venue-preview.jpg',       'image/jpeg',      420000, true);

  INSERT INTO public.conversations (id, owner_id, title, type, labels, last_message_at, last_message_preview, is_test_seed) VALUES
    (vendor_convo_id, planner_id, 'Spice Route — catering thread', 'direct', ARRAY['vendor'], now(), 'Menu locked in — thanks!', true);
  INSERT INTO public.conversation_participants (conversation_id, user_id, participant_role) VALUES
    (vendor_convo_id, planner_id, 'owner'),
    (vendor_convo_id, vendor_id,  'member')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.messages (conversation_id, sender_id, body, attachments, status, is_test_seed) VALUES
    (vendor_convo_id, planner_id, 'Hi, sending over the guest count update — 350 confirmed.', '[]'::jsonb, 'delivered', true),
    (vendor_convo_id, vendor_id,  'Got it. I''ll update the menu proposal today.',            '[]'::jsonb, 'delivered', true),
    (vendor_convo_id, planner_id, 'Menu locked in — thanks!',                                 '[]'::jsonb, 'delivered', true);

  INSERT INTO public.notifications (user_id, category, title, body, href, is_test_seed) VALUES
    (planner_id, 'messages', 'New reply from Spice Route',      'Menu proposal updated.',         '/messaging',     true),
    (planner_id, 'team',     'Vendor accepted invite',          'Test Vendor joined your event.', '/events',        true);

  INSERT INTO public.subscriptions (user_id, stripe_subscription_id, stripe_customer_id, product_id, price_id, status, current_period_start, current_period_end, cancel_at_period_end, environment, is_test_seed) VALUES
    (planner_id, 'sub_test_seed_planner', 'cus_test_seed_planner', 'prod_test_planner_pro', 'planner_pro_monthly', 'active', now(), now() + interval '30 days', false, 'sandbox', true);

  INSERT INTO public.vendor_profiles (user_id, business_name, business_category, business_description, phone, email, website, city, state, starting_price, years_in_business, accepted_terms, onboarding_completed, is_test_seed)
  VALUES (vendor_id, 'Spice Route Caterers', 'Catering', 'Award-winning South Asian catering for weddings and events.', '+1-555-0200', 'vendor@test.melabridge.com', 'https://example.com/spice-route', 'Miami', 'FL', 85, 12, true, true, true)
  ON CONFLICT (user_id) DO UPDATE SET is_test_seed = true, onboarding_completed = true;

  INSERT INTO public.notifications (user_id, category, title, body, href, is_test_seed) VALUES
    (vendor_id,   'messages', 'New inquiry from Test Planner', 'Wants pricing for 350 guests.', '/messaging',      true),
    (vendor_id,   'payments', 'Deposit received',              '$8,000 deposit from Patel Wedding.', '/subscription', true),
    (attendee_id, 'system',   'Your ticket is confirmed',      'The Patel Wedding — 1 guest.', '/tickets',   true),
    (attendee_id, 'messages', 'Message from planner',          'Welcome bag details attached.', '/messaging', true),
    (guest_id,    'system',   'You have a new invite',         'The Patel Wedding — RSVP by next week.', '/guest-portal', true),
    (admin_id,    'system',   '3 vendor applications pending review', NULL, '/admin', true),
    (admin_id,    'system',   'Platform activity summary ready',      NULL, '/reports', true);

  RETURN jsonb_build_object('ok', true, 'events', 3, 'guests', 9, 'tasks', 5, 'budget_items', 6, 'files', 3, 'messages', 3, 'notifications', 9);
END;
$function$;

-- Re-apply grants after CREATE OR REPLACE resets them
REVOKE ALL ON FUNCTION public.seed_test_data(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wipe_test_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_test_data(uuid, uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.wipe_test_data() TO service_role;


-- === Migration: 20260713062824_a558bf8d-5d73-4887-8054-e293dc2cf547.sql ===
-- Recent searches / recently-opened items per user
CREATE TABLE public.search_recents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,                 -- 'query' | 'result'
  query text,                         -- when kind='query'
  entity_type text,                   -- when kind='result' (event, guest, vendor, task, file, message, module, ...)
  entity_id text,                     -- string to accommodate module ids like 'm-guests'
  title text NOT NULL,
  subtitle text,
  href text,                          -- destination path
  opened_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX search_recents_user_opened_idx ON public.search_recents (user_id, opened_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_recents TO authenticated;
GRANT ALL ON public.search_recents TO service_role;

ALTER TABLE public.search_recents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own recents"   ON public.search_recents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recents" ON public.search_recents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recents" ON public.search_recents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own recents" ON public.search_recents FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Pinned favorites per user
CREATE TABLE public.search_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  title text NOT NULL,
  subtitle text,
  href text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);

CREATE INDEX search_favorites_user_idx ON public.search_favorites (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_favorites TO authenticated;
GRANT ALL ON public.search_favorites TO service_role;

ALTER TABLE public.search_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own favorites"   ON public.search_favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own favorites" ON public.search_favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own favorites" ON public.search_favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- === Migration: 20260713071147_36657b34-ea33-40e7-aa22-5682df401945.sql ===

-- Extend event_status enum with new vendor lifecycle values
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'inquiry';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'consultation_scheduled';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'quote_sent';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'tentative';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'cancelled';


-- === Migration: 20260713071216_821243e7-0639-42fa-9965-1e94934e3b8c.sql ===

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


-- === Migration: 20260713071747_0141556c-adbd-4f64-bce8-385c6e8cf1e3.sql ===

CREATE TYPE public.event_draft_status AS ENUM ('pending', 'approved', 'edited', 'discarded');
CREATE TYPE public.event_draft_source AS ENUM ('email', 'message', 'voice', 'manual_paste', 'assistant');

CREATE TABLE public.event_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.event_draft_status NOT NULL DEFAULT 'pending',
  source public.event_draft_source NOT NULL DEFAULT 'assistant',
  source_reference TEXT,
  raw_input TEXT,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  field_confidences JSONB NOT NULL DEFAULT '{}'::jsonb,
  extracted JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  suggested_next_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  approved_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX event_drafts_owner_status_idx ON public.event_drafts(owner_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_drafts TO authenticated;
GRANT ALL ON public.event_drafts TO service_role;

ALTER TABLE public.event_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their drafts" ON public.event_drafts
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert their drafts" ON public.event_drafts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update their drafts" ON public.event_drafts
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete their drafts" ON public.event_drafts
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER trg_event_drafts_updated
  BEFORE UPDATE ON public.event_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_draft_id UUID REFERENCES public.event_drafts(id) ON DELETE SET NULL;


-- === Migration: 20260713072427_008f3249-18a6-47a8-b865-511f907169d4.sql ===

CREATE TYPE public.calendar_provider AS ENUM ('google', 'outlook');
CREATE TYPE public.calendar_sync_direction AS ENUM ('push', 'pull', 'two_way');

CREATE TABLE public.calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.calendar_provider NOT NULL,
  external_account_email TEXT,
  external_calendar_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,
  sync_direction public.calendar_sync_direction NOT NULL DEFAULT 'two_way',
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_connections TO authenticated;
GRANT ALL ON public.calendar_connections TO service_role;

ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view calendar connections" ON public.calendar_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert calendar connections" ON public.calendar_connections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update calendar connections" ON public.calendar_connections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete calendar connections" ON public.calendar_connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_calendar_connections_updated
  BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.calendar_sync_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  provider public.calendar_provider NOT NULL,
  external_event_id TEXT NOT NULL,
  external_etag TEXT,
  last_pushed_at TIMESTAMPTZ,
  last_pulled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, provider)
);

CREATE INDEX calendar_sync_map_user_idx ON public.calendar_sync_map(user_id, provider);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_sync_map TO authenticated;
GRANT ALL ON public.calendar_sync_map TO service_role;

ALTER TABLE public.calendar_sync_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view sync map" ON public.calendar_sync_map
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert sync map" ON public.calendar_sync_map
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update sync map" ON public.calendar_sync_map
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete sync map" ON public.calendar_sync_map
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_calendar_sync_map_updated
  BEFORE UPDATE ON public.calendar_sync_map
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ics_token TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS profiles_ics_token_idx ON public.profiles(ics_token) WHERE ics_token IS NOT NULL;


-- === Migration: 20260713162014_07962077-fb64-4ea9-875b-9c5d486d31a0.sql ===

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
  calendar_feed_token uuid UNIQUE,
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


-- === Migration: 20260713173020_3d7b511a-429d-4dea-9c79-bb923992008e.sql ===

-- Fix event creation: SELECT policy on events called is_event_member() which re-queries public.events.
-- On INSERT ... RETURNING the just-inserted row wasn't visible in that sub-select's snapshot,
-- so PostgREST return=representation always failed with 42501.
-- Short-circuit on owner_id = auth.uid() so owners can always read their own rows without a lookup.

DROP POLICY IF EXISTS "Events: members can view" ON public.events;
CREATE POLICY "Events: members can view"
ON public.events
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR app_private.is_event_member(id, auth.uid())
);

DROP POLICY IF EXISTS "Events: editors and above can update" ON public.events;
CREATE POLICY "Events: editors and above can update"
ON public.events
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR app_private.has_event_access(id, auth.uid(), 'editor'::event_role)
)
WITH CHECK (
  owner_id = auth.uid()
  OR app_private.has_event_access(id, auth.uid(), 'editor'::event_role)
);

-- Cleanup the QA probe rows created while diagnosing.
DELETE FROM public.events WHERE name IN ('probe-noReturn','probe-returnMin','MinTest','sql-rls-test');


-- === Migration: 20260713173052_1762b6e2-bf96-49b8-b2ed-079ba4fed9aa.sql ===

DROP VIEW IF EXISTS public.vendor_profiles_public;
CREATE VIEW public.vendor_profiles_public
WITH (security_invoker = true)
AS
SELECT id, user_id, business_name, business_category, business_description,
       website, logo_url, city, state, travel_radius, mobile_service,
       virtual_services, years_in_business, starting_price, business_hours,
       social_links, portfolio_urls, onboarding_completed, created_at, updated_at
FROM public.vendor_profiles
WHERE onboarding_completed = true;

GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;


-- === Migration: 20260713184233_536e4f64-8cd5-44d5-8f8b-66bb822f3ea3.sql ===

-- ============ ENUMS ============
CREATE TYPE public.booking_stage AS ENUM (
  'saved','contacted','consultation_scheduled','quote_sent',
  'quote_under_review','contract_sent','contract_signed',
  'deposit_paid','booked','completed','review_requested','reviewed'
);

CREATE TYPE public.booking_confirmation_rule AS ENUM (
  'contract_only','deposit_only','contract_and_deposit','manual'
);

-- ============ vendor_booking_settings ============
CREATE TABLE public.vendor_booking_settings (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  confirmation_rule public.booking_confirmation_rule NOT NULL DEFAULT 'contract_and_deposit',
  requires_deposit boolean NOT NULL DEFAULT true,
  auto_advance boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_booking_settings TO authenticated;
GRANT ALL ON public.vendor_booking_settings TO service_role;
ALTER TABLE public.vendor_booking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors manage own settings"
  ON public.vendor_booking_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid()));

CREATE POLICY "planners can read vendor settings"
  ON public.vendor_booking_settings FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_vbs_updated
  BEFORE UPDATE ON public.vendor_booking_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ vendor_bookings ============
CREATE TABLE public.vendor_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  title text NOT NULL,
  category text NOT NULL,
  current_stage public.booking_stage NOT NULL DEFAULT 'saved',
  quote_amount numeric(12,2),
  deposit_amount numeric(12,2),
  deposit_paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_paid numeric(12,2) NOT NULL DEFAULT 0,
  quote_sent_at timestamptz,
  contract_sent_at timestamptz,
  contract_signed_at timestamptz,
  deposit_paid_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vb_planner ON public.vendor_bookings(planner_id);
CREATE INDEX idx_vb_vendor  ON public.vendor_bookings(vendor_id);
CREATE INDEX idx_vb_event   ON public.vendor_bookings(event_id);
CREATE INDEX idx_vb_stage   ON public.vendor_bookings(current_stage);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_bookings TO authenticated;
GRANT ALL ON public.vendor_bookings TO service_role;
ALTER TABLE public.vendor_bookings ENABLE ROW LEVEL SECURITY;

-- helper: is caller party to this booking?
CREATE OR REPLACE FUNCTION public.is_booking_party(_booking_id uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_bookings b
    LEFT JOIN public.vendor_profiles vp ON vp.id = b.vendor_id
    WHERE b.id = _booking_id
      AND (b.planner_id = _user OR vp.user_id = _user)
  );
$$;

CREATE POLICY "booking parties select"
  ON public.vendor_bookings FOR SELECT TO authenticated
  USING (
    planner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid())
  );

CREATE POLICY "planner inserts booking"
  ON public.vendor_bookings FOR INSERT TO authenticated
  WITH CHECK (planner_id = auth.uid() AND created_by = auth.uid());

CREATE POLICY "booking parties update"
  ON public.vendor_bookings FOR UPDATE TO authenticated
  USING (
    planner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = vendor_id AND vp.user_id = auth.uid())
  );

CREATE POLICY "planner deletes booking"
  ON public.vendor_bookings FOR DELETE TO authenticated
  USING (planner_id = auth.uid());

CREATE TRIGGER trg_vb_updated
  BEFORE UPDATE ON public.vendor_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ vendor_booking_events ============
CREATE TABLE public.vendor_booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.vendor_bookings(id) ON DELETE CASCADE,
  stage public.booking_stage NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vbe_booking ON public.vendor_booking_events(booking_id, occurred_at DESC);

GRANT SELECT, INSERT ON public.vendor_booking_events TO authenticated;
GRANT ALL ON public.vendor_booking_events TO service_role;
ALTER TABLE public.vendor_booking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties read events"
  ON public.vendor_booking_events FOR SELECT TO authenticated
  USING (public.is_booking_party(booking_id, auth.uid()));

CREATE POLICY "parties insert events"
  ON public.vendor_booking_events FOR INSERT TO authenticated
  WITH CHECK (public.is_booking_party(booking_id, auth.uid()));

-- ============ Confirmation trigger ============
CREATE OR REPLACE FUNCTION public.fn_apply_confirmation_rule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.vendor_bookings%ROWTYPE;
  rule public.booking_confirmation_rule;
  requires_dep boolean;
  vendor_uid uuid;
  should_book boolean := false;
  preview text;
BEGIN
  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- update flags from stage
  IF NEW.stage = 'quote_sent'      AND b.quote_sent_at      IS NULL THEN UPDATE public.vendor_bookings SET quote_sent_at = NEW.occurred_at, current_stage = NEW.stage WHERE id = b.id; END IF;
  IF NEW.stage = 'contract_sent'   AND b.contract_sent_at   IS NULL THEN UPDATE public.vendor_bookings SET contract_sent_at = NEW.occurred_at, current_stage = NEW.stage WHERE id = b.id; END IF;
  IF NEW.stage = 'contract_signed' AND b.contract_signed_at IS NULL THEN UPDATE public.vendor_bookings SET contract_signed_at = NEW.occurred_at, current_stage = NEW.stage WHERE id = b.id; END IF;
  IF NEW.stage = 'deposit_paid'    AND b.deposit_paid_at    IS NULL THEN UPDATE public.vendor_bookings SET deposit_paid_at = NEW.occurred_at, current_stage = NEW.stage WHERE id = b.id; END IF;
  IF NEW.stage = 'completed'       AND b.completed_at       IS NULL THEN UPDATE public.vendor_bookings SET completed_at = NEW.occurred_at, current_stage = NEW.stage WHERE id = b.id; END IF;

  -- for non-book, non-flag stages just bump current_stage forward
  IF NEW.stage NOT IN ('booked') THEN
    UPDATE public.vendor_bookings
       SET current_stage = NEW.stage
     WHERE id = b.id
       AND public.event_role_rank IS NOT NULL -- placeholder to keep search_path aware
       AND (NEW.stage::text <> 'saved');
  END IF;

  -- refresh b
  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;

  -- Evaluate auto-book only when trigger event is contract_signed or deposit_paid
  IF NEW.stage IN ('contract_signed','deposit_paid') AND b.confirmed_at IS NULL THEN
    SELECT s.confirmation_rule, s.requires_deposit
      INTO rule, requires_dep
      FROM public.vendor_booking_settings s
      WHERE s.vendor_id = b.vendor_id;

    IF rule IS NULL THEN rule := 'contract_and_deposit'; requires_dep := true; END IF;

    IF rule = 'contract_only' AND b.contract_signed_at IS NOT NULL THEN
      should_book := true;
    ELSIF rule = 'deposit_only' AND b.deposit_paid_at IS NOT NULL THEN
      should_book := true;
    ELSIF rule = 'contract_and_deposit' THEN
      IF b.contract_signed_at IS NOT NULL AND (NOT requires_dep OR b.deposit_paid_at IS NOT NULL) THEN
        should_book := true;
      END IF;
    END IF;

    IF should_book THEN
      UPDATE public.vendor_bookings
         SET current_stage = 'booked', confirmed_at = now()
       WHERE id = b.id;
      INSERT INTO public.vendor_booking_events (booking_id, stage, actor_id, note)
      VALUES (b.id, 'booked', NULL, 'Auto-confirmed by rule: ' || rule::text);
    END IF;
  END IF;

  -- Notifications for both parties
  SELECT vp.user_id INTO vendor_uid FROM public.vendor_profiles vp WHERE vp.id = b.vendor_id;
  preview := 'Booking "' || b.title || '" moved to ' || NEW.stage::text;

  INSERT INTO public.notifications (user_id, category, title, body, href, entity_type, entity_id)
  VALUES (b.planner_id, 'booking', 'Booking update', preview, '/bookings/' || b.id::text, 'vendor_booking', b.id);

  IF vendor_uid IS NOT NULL AND vendor_uid <> b.planner_id THEN
    INSERT INTO public.notifications (user_id, category, title, body, href, entity_type, entity_id)
    VALUES (vendor_uid, 'booking', 'Booking update', preview, '/bookings/' || b.id::text, 'vendor_booking', b.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vbe_apply_rule
  AFTER INSERT ON public.vendor_booking_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_apply_confirmation_rule();

-- Backfill settings for existing vendor profiles
INSERT INTO public.vendor_booking_settings (vendor_id)
SELECT id FROM public.vendor_profiles
ON CONFLICT (vendor_id) DO NOTHING;


-- === Migration: 20260713184249_95bb824d-6021-481e-81c4-0563d09c12a0.sql ===

REVOKE ALL ON FUNCTION public.is_booking_party(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_apply_confirmation_rule() FROM PUBLIC, anon, authenticated;


-- === Migration: 20260713184604_43c153cc-933a-4c9e-adf9-5e1f62e0b125.sql ===

CREATE OR REPLACE FUNCTION public.fn_apply_confirmation_rule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.vendor_bookings%ROWTYPE;
  rule public.booking_confirmation_rule;
  requires_dep boolean;
  vendor_uid uuid;
  should_book boolean := false;
  preview text;
BEGIN
  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.stage = 'quote_sent'      AND b.quote_sent_at      IS NULL THEN UPDATE public.vendor_bookings SET quote_sent_at = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'contract_sent'   AND b.contract_sent_at   IS NULL THEN UPDATE public.vendor_bookings SET contract_sent_at = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'contract_signed' AND b.contract_signed_at IS NULL THEN UPDATE public.vendor_bookings SET contract_signed_at = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'deposit_paid'    AND b.deposit_paid_at    IS NULL THEN UPDATE public.vendor_bookings SET deposit_paid_at = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'completed'       AND b.completed_at       IS NULL THEN UPDATE public.vendor_bookings SET completed_at = NEW.occurred_at WHERE id = b.id; END IF;

  IF NEW.stage <> 'booked' THEN
    UPDATE public.vendor_bookings SET current_stage = NEW.stage WHERE id = b.id;
  END IF;

  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;

  IF NEW.stage IN ('contract_signed','deposit_paid') AND b.confirmed_at IS NULL THEN
    SELECT s.confirmation_rule, s.requires_deposit
      INTO rule, requires_dep
      FROM public.vendor_booking_settings s
      WHERE s.vendor_id = b.vendor_id;

    IF rule IS NULL THEN rule := 'contract_and_deposit'; requires_dep := true; END IF;

    IF rule = 'contract_only' AND b.contract_signed_at IS NOT NULL THEN
      should_book := true;
    ELSIF rule = 'deposit_only' AND b.deposit_paid_at IS NOT NULL THEN
      should_book := true;
    ELSIF rule = 'contract_and_deposit' THEN
      IF b.contract_signed_at IS NOT NULL AND (NOT requires_dep OR b.deposit_paid_at IS NOT NULL) THEN
        should_book := true;
      END IF;
    END IF;

    IF should_book THEN
      UPDATE public.vendor_bookings
         SET current_stage = 'booked', confirmed_at = now()
       WHERE id = b.id;
      INSERT INTO public.vendor_booking_events (booking_id, stage, actor_id, note)
      VALUES (b.id, 'booked', NULL, 'Auto-confirmed by rule: ' || rule::text);
    END IF;
  END IF;

  SELECT vp.user_id INTO vendor_uid FROM public.vendor_profiles vp WHERE vp.id = b.vendor_id;
  preview := 'Booking "' || b.title || '" moved to ' || NEW.stage::text;

  INSERT INTO public.notifications (user_id, category, title, body, href, entity_type, entity_id)
  VALUES (b.planner_id, 'booking', 'Booking update', preview, '/bookings/' || b.id::text, 'vendor_booking', b.id);

  IF vendor_uid IS NOT NULL AND vendor_uid <> b.planner_id THEN
    INSERT INTO public.notifications (user_id, category, title, body, href, entity_type, entity_id)
    VALUES (vendor_uid, 'booking', 'Booking update', preview, '/bookings/' || b.id::text, 'vendor_booking', b.id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_apply_confirmation_rule() FROM PUBLIC, anon, authenticated;


-- === Migration: 20260713184842_9afd0c60-4e27-4869-82b4-5f6ed8eee2e1.sql ===

GRANT EXECUTE ON FUNCTION public.is_booking_party(uuid, uuid) TO authenticated;


-- === Migration: 20260713221145_1547fa54-a138-4469-972e-fe9c62cbf011.sql ===
-- Add new stages to the enum (must be in its own txn per stage)
ALTER TYPE public.booking_stage ADD VALUE IF NOT EXISTS 'in_progress' AFTER 'booked';
ALTER TYPE public.booking_stage ADD VALUE IF NOT EXISTS 'cancelled' AFTER 'reviewed';

-- === Migration: 20260713221444_b8499197-3d6b-414d-a17d-cff90f0ca8ef.sql ===
-- Extend fn_apply_confirmation_rule to also create a calendar hold on booked
CREATE OR REPLACE FUNCTION public.fn_apply_confirmation_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  b public.vendor_bookings%ROWTYPE;
  rule public.booking_confirmation_rule;
  requires_dep boolean;
  vendor_uid uuid;
  should_book boolean := false;
  preview text;
  evt record;
  ev_start timestamptz;
  ev_end   timestamptz;
BEGIN
  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.stage = 'quote_sent'      AND b.quote_sent_at      IS NULL THEN UPDATE public.vendor_bookings SET quote_sent_at = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'contract_sent'   AND b.contract_sent_at   IS NULL THEN UPDATE public.vendor_bookings SET contract_sent_at = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'contract_signed' AND b.contract_signed_at IS NULL THEN UPDATE public.vendor_bookings SET contract_signed_at = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'deposit_paid'    AND b.deposit_paid_at    IS NULL THEN UPDATE public.vendor_bookings SET deposit_paid_at = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'completed'       AND b.completed_at       IS NULL THEN UPDATE public.vendor_bookings SET completed_at = NEW.occurred_at WHERE id = b.id; END IF;

  IF NEW.stage <> 'booked' THEN
    UPDATE public.vendor_bookings SET current_stage = NEW.stage WHERE id = b.id;
  END IF;

  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;

  IF NEW.stage IN ('contract_signed','deposit_paid') AND b.confirmed_at IS NULL THEN
    SELECT s.confirmation_rule, s.requires_deposit
      INTO rule, requires_dep
      FROM public.vendor_booking_settings s
      WHERE s.vendor_id = b.vendor_id;

    IF rule IS NULL THEN rule := 'contract_and_deposit'; requires_dep := true; END IF;

    IF rule = 'contract_only' AND b.contract_signed_at IS NOT NULL THEN
      should_book := true;
    ELSIF rule = 'deposit_only' AND b.deposit_paid_at IS NOT NULL THEN
      should_book := true;
    ELSIF rule = 'contract_and_deposit' THEN
      IF b.contract_signed_at IS NOT NULL AND (NOT requires_dep OR b.deposit_paid_at IS NOT NULL) THEN
        should_book := true;
      END IF;
    END IF;

    IF should_book THEN
      UPDATE public.vendor_bookings
         SET current_stage = 'booked', confirmed_at = now()
       WHERE id = b.id;
      INSERT INTO public.vendor_booking_events (booking_id, stage, actor_id, note)
      VALUES (b.id, 'booked', NULL, 'Auto-confirmed by rule: ' || rule::text);
      SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;
    END IF;
  END IF;

  SELECT vp.user_id INTO vendor_uid FROM public.vendor_profiles vp WHERE vp.id = b.vendor_id;

  -- Fan-out: create calendar hold when booking transitions to booked
  IF (NEW.stage = 'booked' OR (should_book AND b.current_stage = 'booked'))
     AND vendor_uid IS NOT NULL
     AND b.event_id IS NOT NULL THEN
    SELECT e.event_date, e.event_time, e.name, e.event_type, e.location
      INTO evt
      FROM public.events e WHERE e.id = b.event_id;
    IF FOUND AND evt.event_date IS NOT NULL THEN
      ev_start := (evt.event_date::text || ' ' || COALESCE(evt.event_time, '18:00'))::timestamptz;
      ev_end   := ev_start + interval '4 hours';
      -- Avoid duplicate holds for the same booking
      IF NOT EXISTS (
        SELECT 1 FROM public.calendar_events
         WHERE vendor_id = vendor_uid AND external_id = 'booking:' || b.id::text
      ) THEN
        INSERT INTO public.calendar_events
          (vendor_id, planner_id, event_id, event_name, event_type, venue_name,
           starts_at, ends_at, setup_minutes, breakdown_minutes, status,
           checklist, attachments, team_assignments, timeline, source, external_id, revenue_amount)
        VALUES
          (vendor_uid, b.planner_id, b.event_id, COALESCE(evt.name, b.title), evt.event_type, evt.location,
           ev_start, ev_end, 60, 60, 'confirmed'::calendar_event_status,
           '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'melabridge'::calendar_event_source,
           'booking:' || b.id::text, b.quote_amount);
      END IF;
    END IF;
  END IF;

  -- Release calendar hold on cancellation
  IF NEW.stage = 'cancelled' AND vendor_uid IS NOT NULL THEN
    DELETE FROM public.calendar_events
     WHERE vendor_id = vendor_uid AND external_id = 'booking:' || b.id::text;
    UPDATE public.vendor_bookings SET current_stage = 'cancelled' WHERE id = b.id;
  END IF;

  preview := 'Booking "' || b.title || '" moved to ' || NEW.stage::text;

  INSERT INTO public.notifications (user_id, category, title, body, href, entity_type, entity_id)
  VALUES (b.planner_id, 'booking', 'Booking update', preview, '/bookings/' || b.id::text, 'vendor_booking', b.id);

  IF vendor_uid IS NOT NULL AND vendor_uid <> b.planner_id THEN
    INSERT INTO public.notifications (user_id, category, title, body, href, entity_type, entity_id)
    VALUES (vendor_uid, 'booking', 'Booking update', preview, '/bookings/' || b.id::text, 'vendor_booking', b.id);
  END IF;

  RETURN NEW;
END;
$function$;

-- === Migration: 20260713225238_5397b506-3138-44cd-9b7a-75ad8d4cb39e.sql ===

-- Overlap prevention on calendar_events for a vendor
CREATE OR REPLACE FUNCTION public.fn_prevent_calendar_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  IF NEW.vendor_id IS NULL OR NEW.starts_at IS NULL OR NEW.ends_at IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.calendar_events c
    WHERE c.vendor_id = NEW.vendor_id
      AND c.id <> NEW.id
      AND c.status <> 'cancelled'
      AND tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'calendar_overlap: vendor % already has an event overlapping % - %', NEW.vendor_id, NEW.starts_at, NEW.ends_at
      USING ERRCODE = 'exclusion_violation';
  END IF;

  -- Respect blocked dates
  IF EXISTS (
    SELECT 1 FROM public.calendar_blocked_dates b
    WHERE b.vendor_id = NEW.vendor_id
      AND daterange(b.start_date, b.end_date, '[]') && daterange(NEW.starts_at::date, NEW.ends_at::date, '[]')
  ) THEN
    RAISE EXCEPTION 'calendar_blocked: vendor % has blocked dates in this range', NEW.vendor_id
      USING ERRCODE = 'exclusion_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_calendar_overlap ON public.calendar_events;
CREATE TRIGGER trg_prevent_calendar_overlap
BEFORE INSERT OR UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_calendar_overlap();

-- Enable realtime for calendar_events, vendor_bookings, vendor_booking_events, notifications
ALTER TABLE public.calendar_events REPLICA IDENTITY FULL;
ALTER TABLE public.vendor_bookings REPLICA IDENTITY FULL;
ALTER TABLE public.vendor_booking_events REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_bookings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_booking_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


-- === Migration: 20260713225257_950c5b66-1af6-4910-b69a-a298070dd4a8.sql ===

REVOKE EXECUTE ON FUNCTION public.fn_prevent_calendar_overlap() FROM PUBLIC, anon, authenticated;


-- === Migration: 20260713225657_c6d67249-19a8-4812-b801-82e335c58d1d.sql ===

-- Enums
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft','sent','partial','paid','overdue','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_schedule_status AS ENUM ('pending','paid','overdue','waived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Invoices
CREATE TABLE IF NOT EXISTS public.booking_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.vendor_bookings(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  amount numeric(12,2) NOT NULL,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  due_date date,
  issued_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, invoice_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_invoices TO authenticated;
GRANT ALL ON public.booking_invoices TO service_role;
ALTER TABLE public.booking_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking parties can view invoices"
  ON public.booking_invoices FOR SELECT TO authenticated
  USING (public.is_booking_party(booking_id, auth.uid()));
CREATE POLICY "Booking parties can insert invoices"
  ON public.booking_invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_booking_party(booking_id, auth.uid()));
CREATE POLICY "Booking parties can update invoices"
  ON public.booking_invoices FOR UPDATE TO authenticated
  USING (public.is_booking_party(booking_id, auth.uid()));
CREATE POLICY "Booking parties can delete invoices"
  ON public.booking_invoices FOR DELETE TO authenticated
  USING (public.is_booking_party(booking_id, auth.uid()));

CREATE TRIGGER trg_booking_invoices_updated_at
BEFORE UPDATE ON public.booking_invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Payment schedule
CREATE TABLE IF NOT EXISTS public.booking_payment_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.vendor_bookings(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric(12,2) NOT NULL,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date,
  status public.payment_schedule_status NOT NULL DEFAULT 'pending',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_payment_schedule TO authenticated;
GRANT ALL ON public.booking_payment_schedule TO service_role;
ALTER TABLE public.booking_payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking parties can view schedule"
  ON public.booking_payment_schedule FOR SELECT TO authenticated
  USING (public.is_booking_party(booking_id, auth.uid()));
CREATE POLICY "Booking parties can insert schedule"
  ON public.booking_payment_schedule FOR INSERT TO authenticated
  WITH CHECK (public.is_booking_party(booking_id, auth.uid()));
CREATE POLICY "Booking parties can update schedule"
  ON public.booking_payment_schedule FOR UPDATE TO authenticated
  USING (public.is_booking_party(booking_id, auth.uid()));
CREATE POLICY "Booking parties can delete schedule"
  ON public.booking_payment_schedule FOR DELETE TO authenticated
  USING (public.is_booking_party(booking_id, auth.uid()));

CREATE TRIGGER trg_booking_payment_schedule_updated_at
BEFORE UPDATE ON public.booking_payment_schedule
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-generate invoice + schedule on booked
CREATE OR REPLACE FUNCTION public.fn_generate_booking_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev_date date;
  dep numeric(12,2);
  bal numeric(12,2);
  inv_no text;
BEGIN
  IF NEW.current_stage = 'booked' AND (OLD.current_stage IS DISTINCT FROM 'booked') THEN
    IF EXISTS (SELECT 1 FROM public.booking_invoices WHERE booking_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    inv_no := 'INV-' || to_char(now(), 'YYYYMM') || '-' || substr(NEW.id::text, 1, 6);
    SELECT event_date INTO ev_date FROM public.events WHERE id = NEW.event_id;

    INSERT INTO public.booking_invoices (booking_id, invoice_number, amount, status, due_date, notes)
    VALUES (NEW.id, inv_no, COALESCE(NEW.quote_amount, 0), 'sent',
            COALESCE(ev_date - INTERVAL '14 days', now() + INTERVAL '7 days')::date,
            'Auto-generated on booking confirmation.');

    dep := COALESCE(NEW.deposit_amount, ROUND(COALESCE(NEW.quote_amount, 0) * 0.25, 2));
    bal := GREATEST(COALESCE(NEW.quote_amount, 0) - dep, 0);

    IF dep > 0 THEN
      INSERT INTO public.booking_payment_schedule (booking_id, label, amount, paid_amount, due_date, status, sort_order)
      VALUES (NEW.id, 'Deposit', dep,
              LEAST(COALESCE(NEW.deposit_paid_amount, 0), dep),
              CURRENT_DATE,
              CASE WHEN COALESCE(NEW.deposit_paid_amount, 0) >= dep THEN 'paid'::payment_schedule_status ELSE 'pending'::payment_schedule_status END,
              1);
    END IF;
    IF bal > 0 THEN
      INSERT INTO public.booking_payment_schedule (booking_id, label, amount, due_date, status, sort_order)
      VALUES (NEW.id, 'Final balance', bal,
              COALESCE(ev_date - INTERVAL '14 days', now() + INTERVAL '30 days')::date,
              'pending', 2);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_generate_booking_invoice() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_generate_booking_invoice ON public.vendor_bookings;
CREATE TRIGGER trg_generate_booking_invoice
AFTER UPDATE OF current_stage ON public.vendor_bookings
FOR EACH ROW EXECUTE FUNCTION public.fn_generate_booking_invoice();

-- Realtime
ALTER TABLE public.booking_invoices REPLICA IDENTITY FULL;
ALTER TABLE public.booking_payment_schedule REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_invoices; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_payment_schedule; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


-- === Migration: 20260713235205_6e5afd84-c3e3-40f3-8f2a-b91067b5bada.sql ===
CREATE POLICY "Vendor profiles: public read of completed listings"
ON public.vendor_profiles
FOR SELECT
TO anon, authenticated
USING (onboarding_completed = true);

-- === Migration: 20260713235252_39845d86-66c9-4f1a-a33c-78abc900b0c0.sql ===
GRANT SELECT ON public.vendor_profiles TO anon;

-- === Migration: 20260714002058_2245913b-97c0-4cb1-a4f9-16ed167bba05.sql ===
-- 1) vendor_booking_settings: restrict SELECT to the vendor themselves or a planner
--    with an actual booking relationship. Replaces USING (true).
DROP POLICY IF EXISTS "planners can read vendor settings" ON public.vendor_booking_settings;

CREATE POLICY "vendor or related planner can read settings"
ON public.vendor_booking_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.id = vendor_booking_settings.vendor_id
      AND vp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.vendor_bookings vb
    WHERE vb.vendor_id = vendor_booking_settings.vendor_id
      AND vb.planner_id = auth.uid()
  )
);

-- 2) vendor_profiles: stop exposing email/phone to anonymous visitors.
--    The public directory already reads from the sanitized view
--    public.vendor_profiles_public (which excludes email/phone). Switch the
--    view to run with owner privileges so anon can keep using it, then close
--    anon access to the base table entirely.
DROP POLICY IF EXISTS "Vendor profiles: public read of completed listings" ON public.vendor_profiles;

CREATE POLICY "Vendor profiles: authenticated read of completed listings"
ON public.vendor_profiles
FOR SELECT
TO authenticated
USING (onboarding_completed = true);

ALTER VIEW public.vendor_profiles_public SET (security_invoker = false);
REVOKE SELECT ON public.vendor_profiles FROM anon;
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;

-- 3) SECURITY DEFINER functions should not be executable by end-users.
--    Triggers still run under the table owner regardless of EXECUTE grants,
--    and privileged maintenance helpers must be service_role only.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_role_from_profile()                           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_message_participants()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_generate_booking_invoice()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_prevent_calendar_overlap()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_apply_confirmation_rule()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_test_data(uuid, uuid, uuid, uuid, uuid)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wipe_test_data()                                   FROM PUBLIC, anon, authenticated;

-- Safe read-only helpers may remain callable by signed-in users:
--   has_active_subscription(uuid, text) and is_booking_party(uuid, uuid)
-- are used from app code paths; leave their default grants intact.


-- === Migration: 20260714002145_451d8b10-f51c-424d-ac14-f6ff83f73501.sql ===
-- Restore invoker semantics on the public directory view.
ALTER VIEW public.vendor_profiles_public SET (security_invoker = true);

-- Re-allow anon to satisfy the view's row-level check, but only for
-- completed listings. Column-level grants below keep contact fields hidden.
DROP POLICY IF EXISTS "Vendor profiles: public read of completed listings" ON public.vendor_profiles;
CREATE POLICY "Vendor profiles: public read of completed listings"
ON public.vendor_profiles
FOR SELECT
TO anon, authenticated
USING (onboarding_completed = true);

-- Column-level lock-down for anon: revoke blanket SELECT, grant only the
-- non-contact columns the public view exposes. Signed-in users keep full
-- access via the authenticated grant already on the table.
REVOKE SELECT ON public.vendor_profiles FROM anon;
GRANT SELECT (
  id, user_id, business_name, business_category, business_description,
  website, logo_url, city, state, travel_radius, mobile_service,
  virtual_services, years_in_business, starting_price, business_hours,
  social_links, portfolio_urls, onboarding_completed,
  created_at, updated_at
) ON public.vendor_profiles TO anon;


-- === Migration: 20260714002209_f9afa2f5-5145-409b-b23e-e396fded8535.sql ===
-- has_active_subscription: safe as invoker — RLS on subscriptions already
-- restricts each user to their own rows, which is exactly the intended scope.
CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live'::text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND (
        (status IN ('active', 'trialing', 'past_due') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;

-- is_booking_party: safe as invoker — vendor_bookings RLS already only
-- surfaces rows to the planner or vendor tied to the booking.
CREATE OR REPLACE FUNCTION public.is_booking_party(_booking_id uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_bookings b
    LEFT JOIN public.vendor_profiles vp ON vp.id = b.vendor_id
    WHERE b.id = _booking_id
      AND (b.planner_id = _user OR vp.user_id = _user)
  );
$$;


-- === Migration: 20260714005200_7150f0fd-637c-4330-acf0-9cf1a2495d6a.sql ===
DROP POLICY IF EXISTS "Vendor profiles: public read of completed listings" ON public.vendor_profiles;
REVOKE SELECT ON public.vendor_profiles FROM anon;

-- === Migration: 20260714005518_6af77b32-7cb2-493c-82e4-3c9742847d7c.sql ===
-- New enum values must be committed before they can be used
ALTER TYPE public.booking_stage ADD VALUE IF NOT EXISTS 'quote_viewed';
ALTER TYPE public.booking_stage ADD VALUE IF NOT EXISTS 'quote_accepted';
ALTER TYPE public.booking_stage ADD VALUE IF NOT EXISTS 'no_response';
ALTER TYPE public.booking_stage ADD VALUE IF NOT EXISTS 'lost';

ALTER TABLE public.vendor_bookings
  ADD COLUMN IF NOT EXISTS quote_viewed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS quote_accepted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS review_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS no_response_at     timestamptz,
  ADD COLUMN IF NOT EXISTS lost_at            timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at       timestamptz,
  ADD COLUMN IF NOT EXISTS in_progress_at     timestamptz;

-- === Migration: 20260714005913_bb103fb5-71b5-47e0-b88f-4b988cdebd34.sql ===
-- 1) Deterministic stage computation from timestamps + event window + confirmation rule.
CREATE OR REPLACE FUNCTION public.fn_compute_booking_stage(_booking_id uuid)
RETURNS public.booking_stage
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  b public.vendor_bookings%ROWTYPE;
  rule public.booking_confirmation_rule;
  requires_dep boolean;
  ev_start timestamptz;
  ev_end   timestamptz;
  ev record;
  is_booked boolean := false;
BEGIN
  SELECT * INTO b FROM public.vendor_bookings WHERE id = _booking_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Terminal / exception states win.
  IF b.cancelled_at IS NOT NULL THEN RETURN 'cancelled'; END IF;
  IF b.lost_at IS NOT NULL THEN RETURN 'lost'; END IF;
  IF b.no_response_at IS NOT NULL THEN RETURN 'no_response'; END IF;

  -- Post-delivery states.
  IF b.reviewed_at IS NOT NULL THEN RETURN 'reviewed'; END IF;
  IF b.review_requested_at IS NOT NULL THEN RETURN 'review_requested'; END IF;

  -- Compute confirmation ("booked") based on the vendor's rule.
  SELECT s.confirmation_rule, s.requires_deposit INTO rule, requires_dep
    FROM public.vendor_booking_settings s WHERE s.vendor_id = b.vendor_id;
  IF rule IS NULL THEN rule := 'contract_and_deposit'; requires_dep := true; END IF;

  IF b.confirmed_at IS NOT NULL THEN
    is_booked := true;
  ELSIF rule = 'contract_only' AND b.contract_signed_at IS NOT NULL THEN
    is_booked := true;
  ELSIF rule = 'deposit_only' AND b.deposit_paid_at IS NOT NULL THEN
    is_booked := true;
  ELSIF rule = 'contract_and_deposit'
        AND b.contract_signed_at IS NOT NULL
        AND (NOT requires_dep OR b.deposit_paid_at IS NOT NULL) THEN
    is_booked := true;
  END IF;

  -- Time-based transitions after booked: in_progress / completed.
  IF b.event_id IS NOT NULL THEN
    SELECT e.event_date, e.event_time, e.end_time INTO ev
      FROM public.events e WHERE e.id = b.event_id;
    IF FOUND AND ev.event_date IS NOT NULL THEN
      ev_start := (ev.event_date::text || ' ' || COALESCE(ev.event_time, '00:00'))::timestamptz;
      ev_end   := (ev.event_date::text || ' ' || COALESCE(ev.end_time, ev.event_time, '23:59'))::timestamptz;
      IF ev.end_time IS NULL AND ev.event_time IS NOT NULL THEN
        ev_end := ev_start + interval '4 hours';
      END IF;
    END IF;
  END IF;

  IF b.completed_at IS NOT NULL OR (ev_end IS NOT NULL AND now() >= ev_end AND is_booked) THEN
    RETURN 'completed';
  END IF;
  IF is_booked AND ev_start IS NOT NULL AND now() >= ev_start THEN
    RETURN 'in_progress';
  END IF;
  IF is_booked THEN RETURN 'booked'; END IF;

  IF b.deposit_paid_at IS NOT NULL THEN RETURN 'deposit_paid'; END IF;
  IF b.contract_signed_at IS NOT NULL THEN RETURN 'contract_signed'; END IF;
  IF b.contract_sent_at IS NOT NULL THEN RETURN 'contract_sent'; END IF;
  IF b.quote_accepted_at IS NOT NULL THEN RETURN 'quote_accepted'; END IF;
  IF b.quote_viewed_at IS NOT NULL THEN RETURN 'quote_viewed'; END IF;
  IF b.quote_sent_at IS NOT NULL THEN RETURN 'quote_sent'; END IF;

  -- Any activity at all means at least "contacted"; otherwise keep the initial "saved".
  IF EXISTS (SELECT 1 FROM public.vendor_booking_events WHERE booking_id = b.id) THEN
    RETURN 'contacted';
  END IF;
  RETURN COALESCE(b.current_stage, 'saved');
END;
$$;

-- 2) Recompute + log-on-change helper.
CREATE OR REPLACE FUNCTION public.fn_recompute_booking_stage(_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur public.booking_stage;
  next public.booking_stage;
BEGIN
  SELECT current_stage INTO cur FROM public.vendor_bookings WHERE id = _booking_id;
  IF cur IS NULL THEN RETURN; END IF;

  next := public.fn_compute_booking_stage(_booking_id);
  IF next IS NOT NULL AND next <> cur THEN
    UPDATE public.vendor_bookings SET current_stage = next WHERE id = _booking_id;
    -- Log the transition unless the identical stage was just logged (avoid noise from cascading triggers).
    IF NOT EXISTS (
      SELECT 1 FROM public.vendor_booking_events
      WHERE booking_id = _booking_id
        AND stage = next
        AND occurred_at > now() - interval '5 seconds'
    ) THEN
      INSERT INTO public.vendor_booking_events (booking_id, stage, actor_id, note)
      VALUES (_booking_id, next, NULL, 'Auto: stage recomputed from actions');
    END IF;
  END IF;
END;
$$;

-- 3) Extend the existing per-event handler to stamp every timestamp column,
--    then hand off to recompute. Fan-out (calendar/notifications) is preserved.
CREATE OR REPLACE FUNCTION public.fn_apply_confirmation_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.vendor_bookings%ROWTYPE;
  rule public.booking_confirmation_rule;
  requires_dep boolean;
  vendor_uid uuid;
  should_book boolean := false;
  preview text;
  evt record;
  ev_start timestamptz;
  ev_end   timestamptz;
BEGIN
  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Stamp per-stage timestamps (idempotent).
  IF NEW.stage = 'quote_sent'         AND b.quote_sent_at         IS NULL THEN UPDATE public.vendor_bookings SET quote_sent_at         = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'quote_viewed'       AND b.quote_viewed_at       IS NULL THEN UPDATE public.vendor_bookings SET quote_viewed_at       = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'quote_accepted'     AND b.quote_accepted_at     IS NULL THEN UPDATE public.vendor_bookings SET quote_accepted_at     = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'contract_sent'      AND b.contract_sent_at      IS NULL THEN UPDATE public.vendor_bookings SET contract_sent_at      = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'contract_signed'    AND b.contract_signed_at    IS NULL THEN UPDATE public.vendor_bookings SET contract_signed_at    = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'deposit_paid'       AND b.deposit_paid_at       IS NULL THEN UPDATE public.vendor_bookings SET deposit_paid_at       = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'in_progress'        AND b.in_progress_at        IS NULL THEN UPDATE public.vendor_bookings SET in_progress_at        = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'completed'          AND b.completed_at          IS NULL THEN UPDATE public.vendor_bookings SET completed_at          = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'review_requested'   AND b.review_requested_at   IS NULL THEN UPDATE public.vendor_bookings SET review_requested_at   = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'reviewed'           AND b.reviewed_at           IS NULL THEN UPDATE public.vendor_bookings SET reviewed_at           = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'no_response'        AND b.no_response_at        IS NULL THEN UPDATE public.vendor_bookings SET no_response_at        = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'lost'               AND b.lost_at               IS NULL THEN UPDATE public.vendor_bookings SET lost_at                = NEW.occurred_at WHERE id = b.id; END IF;
  IF NEW.stage = 'cancelled'          AND b.cancelled_at          IS NULL THEN UPDATE public.vendor_bookings SET cancelled_at          = NEW.occurred_at WHERE id = b.id; END IF;

  -- Refresh the local copy after stamping.
  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;

  -- Legacy: still mirror confirmed_at when the rule fires.
  IF NEW.stage IN ('contract_signed','deposit_paid') AND b.confirmed_at IS NULL THEN
    SELECT s.confirmation_rule, s.requires_deposit INTO rule, requires_dep
      FROM public.vendor_booking_settings s WHERE s.vendor_id = b.vendor_id;
    IF rule IS NULL THEN rule := 'contract_and_deposit'; requires_dep := true; END IF;

    IF rule = 'contract_only' AND b.contract_signed_at IS NOT NULL THEN
      should_book := true;
    ELSIF rule = 'deposit_only' AND b.deposit_paid_at IS NOT NULL THEN
      should_book := true;
    ELSIF rule = 'contract_and_deposit'
          AND b.contract_signed_at IS NOT NULL
          AND (NOT requires_dep OR b.deposit_paid_at IS NOT NULL) THEN
      should_book := true;
    END IF;

    IF should_book THEN
      UPDATE public.vendor_bookings SET confirmed_at = now() WHERE id = b.id;
    END IF;
  END IF;

  -- Deterministic stage from all the stamps + rule + event time.
  PERFORM public.fn_recompute_booking_stage(b.id);
  SELECT * INTO b FROM public.vendor_bookings WHERE id = NEW.booking_id;

  SELECT vp.user_id INTO vendor_uid FROM public.vendor_profiles vp WHERE vp.id = b.vendor_id;

  -- Calendar hold on booked (unchanged).
  IF b.current_stage = 'booked' AND vendor_uid IS NOT NULL AND b.event_id IS NOT NULL THEN
    SELECT e.event_date, e.event_time, e.name, e.event_type, e.location INTO evt
      FROM public.events e WHERE e.id = b.event_id;
    IF FOUND AND evt.event_date IS NOT NULL THEN
      ev_start := (evt.event_date::text || ' ' || COALESCE(evt.event_time, '18:00'))::timestamptz;
      ev_end   := ev_start + interval '4 hours';
      IF NOT EXISTS (
        SELECT 1 FROM public.calendar_events
         WHERE vendor_id = vendor_uid AND external_id = 'booking:' || b.id::text
      ) THEN
        INSERT INTO public.calendar_events
          (vendor_id, planner_id, event_id, event_name, event_type, venue_name,
           starts_at, ends_at, setup_minutes, breakdown_minutes, status,
           checklist, attachments, team_assignments, timeline, source, external_id, revenue_amount)
        VALUES
          (vendor_uid, b.planner_id, b.event_id, COALESCE(evt.name, b.title), evt.event_type, evt.location,
           ev_start, ev_end, 60, 60, 'confirmed'::calendar_event_status,
           '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'melabridge'::calendar_event_source,
           'booking:' || b.id::text, b.quote_amount);
      END IF;
    END IF;
  END IF;

  IF NEW.stage = 'cancelled' AND vendor_uid IS NOT NULL THEN
    DELETE FROM public.calendar_events WHERE vendor_id = vendor_uid AND external_id = 'booking:' || b.id::text;
  END IF;

  preview := 'Booking "' || b.title || '" moved to ' || NEW.stage::text;

  INSERT INTO public.notifications (user_id, category, title, body, href, entity_type, entity_id)
  VALUES (b.planner_id, 'booking', 'Booking update', preview, '/bookings/' || b.id::text, 'vendor_booking', b.id);

  IF vendor_uid IS NOT NULL AND vendor_uid <> b.planner_id THEN
    INSERT INTO public.notifications (user_id, category, title, body, href, entity_type, entity_id)
    VALUES (vendor_uid, 'booking', 'Booking update', preview, '/bookings/' || b.id::text, 'vendor_booking', b.id);
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Trigger that recomputes when timestamps on the booking itself change
--    (e.g. writes coming from server code paths that update timestamps directly).
CREATE OR REPLACE FUNCTION public.fn_booking_stage_watcher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when a relevant timestamp actually changed; avoid recursion from current_stage updates.
  IF (NEW.quote_sent_at        IS DISTINCT FROM OLD.quote_sent_at)
     OR (NEW.quote_viewed_at    IS DISTINCT FROM OLD.quote_viewed_at)
     OR (NEW.quote_accepted_at  IS DISTINCT FROM OLD.quote_accepted_at)
     OR (NEW.contract_sent_at   IS DISTINCT FROM OLD.contract_sent_at)
     OR (NEW.contract_signed_at IS DISTINCT FROM OLD.contract_signed_at)
     OR (NEW.deposit_paid_at    IS DISTINCT FROM OLD.deposit_paid_at)
     OR (NEW.confirmed_at       IS DISTINCT FROM OLD.confirmed_at)
     OR (NEW.in_progress_at     IS DISTINCT FROM OLD.in_progress_at)
     OR (NEW.completed_at       IS DISTINCT FROM OLD.completed_at)
     OR (NEW.review_requested_at IS DISTINCT FROM OLD.review_requested_at)
     OR (NEW.reviewed_at        IS DISTINCT FROM OLD.reviewed_at)
     OR (NEW.cancelled_at       IS DISTINCT FROM OLD.cancelled_at)
     OR (NEW.no_response_at     IS DISTINCT FROM OLD.no_response_at)
     OR (NEW.lost_at            IS DISTINCT FROM OLD.lost_at) THEN
    PERFORM public.fn_recompute_booking_stage(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_bookings_stage_watcher ON public.vendor_bookings;
CREATE TRIGGER trg_vendor_bookings_stage_watcher
AFTER UPDATE ON public.vendor_bookings
FOR EACH ROW EXECUTE FUNCTION public.fn_booking_stage_watcher();

-- Ensure the event-driven trigger is bound (it may already exist under this name).
DROP TRIGGER IF EXISTS trg_vendor_booking_events_apply_rule ON public.vendor_booking_events;
CREATE TRIGGER trg_vendor_booking_events_apply_rule
AFTER INSERT ON public.vendor_booking_events
FOR EACH ROW EXECUTE FUNCTION public.fn_apply_confirmation_rule();

REVOKE EXECUTE ON FUNCTION public.fn_compute_booking_stage(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_recompute_booking_stage(uuid) FROM anon, authenticated;

-- 5) Scheduled recompute for time-based transitions (in_progress / completed).
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.fn_recompute_time_based_stages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT b.id
    FROM public.vendor_bookings b
    LEFT JOIN public.events e ON e.id = b.event_id
    WHERE b.cancelled_at IS NULL
      AND b.lost_at IS NULL
      AND b.no_response_at IS NULL
      AND b.current_stage NOT IN ('reviewed','review_requested','completed','saved','cancelled','lost','no_response')
      AND (
        e.event_date IS NULL
        OR e.event_date BETWEEN (CURRENT_DATE - INTERVAL '3 days') AND (CURRENT_DATE + INTERVAL '1 day')
      )
  LOOP
    PERFORM public.fn_recompute_booking_stage(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_recompute_time_based_stages() FROM anon, authenticated;

SELECT cron.unschedule('recompute-booking-stages')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recompute-booking-stages');

SELECT cron.schedule(
  'recompute-booking-stages',
  '*/15 * * * *',
  $cron$ SELECT public.fn_recompute_time_based_stages(); $cron$
);

-- === Migration: 20260714005928_c124c70e-7b2c-4c5e-a383-0b7820d5c092.sql ===
REVOKE EXECUTE ON FUNCTION public.fn_compute_booking_stage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_recompute_booking_stage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_apply_confirmation_rule() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_booking_stage_watcher() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_recompute_time_based_stages() FROM PUBLIC, anon, authenticated;

-- === Migration: 20260714183144_a2e027b4-2557-4be7-b3cf-21b46f9b9a1f.sql ===

-- Drop policies and role-checking functions that depend on the old enum
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP FUNCTION IF EXISTS app_private.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- New enum
CREATE TYPE public.app_role_new AS ENUM ('personal', 'organization', 'vendor', 'admin');

-- Migrate user_roles.role to new enum with mapping; drop default first
ALTER TABLE public.user_roles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.app_role_new
  USING (
    CASE role::text
      WHEN 'planner'  THEN 'personal'
      WHEN 'guest'    THEN 'personal'
      WHEN 'attendee' THEN 'personal'
      WHEN 'vendor'   THEN 'vendor'
      WHEN 'admin'    THEN 'admin'
      ELSE 'personal'
    END
  )::public.app_role_new;

-- Swap enum names
DROP TYPE public.app_role;
ALTER TYPE public.app_role_new RENAME TO app_role;

-- Recreate role-check functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Recreate admin policies on user_roles
CREATE POLICY "Admins can delete user roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert user roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update user roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

-- Collapse duplicate rows after mapping
DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.role = b.role;

-- Migrate profiles.account_type text values
UPDATE public.profiles
   SET account_type = CASE account_type
     WHEN 'planner'  THEN 'personal'
     WHEN 'guest'    THEN 'personal'
     WHEN 'attendee' THEN 'personal'
     ELSE account_type
   END
 WHERE account_type IN ('planner','guest','attendee');

-- Refresh sync_role_from_profile to use the new role set
CREATE OR REPLACE FUNCTION public.sync_role_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_type IS NOT NULL AND NEW.account_type IN ('personal','organization','vendor') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, NEW.account_type::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Defensive grants
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;


-- === Migration: 20260714183330_d30a0247-b376-464c-8312-0939af9a6967.sql ===

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;


-- === Migration: 20260714183959_a7fee514-87a3-435a-b450-245956b73472.sql ===

DROP FUNCTION IF EXISTS public.seed_test_data(uuid, uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.seed_test_data(planner_id uuid, vendor_id uuid, admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_draft     uuid := gen_random_uuid();
  event_upcoming  uuid := gen_random_uuid();
  event_completed uuid := gen_random_uuid();
  vendor_convo_id uuid := gen_random_uuid();
BEGIN
  PERFORM public.wipe_test_data();

  UPDATE public.profiles SET is_test_seed = true, account_type = 'personal', display_name = 'Test Planner' WHERE id = planner_id;
  UPDATE public.profiles SET is_test_seed = true, account_type = 'vendor',   display_name = 'Test Vendor'  WHERE id = vendor_id;
  UPDATE public.profiles SET is_test_seed = true,                            display_name = 'Test Admin'   WHERE id = admin_id;

  INSERT INTO public.user_roles (user_id, role) VALUES
    (planner_id, 'personal'),
    (vendor_id,  'vendor'),
    (admin_id,   'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.events (id, owner_id, name, event_type, description, event_date, event_time, location, budget_target, guest_target, status, is_test_seed) VALUES
    (event_draft,     planner_id, 'Priya & Arjun Sangeet',   'Sangeet',      'Draft plan for the sangeet night.', (CURRENT_DATE + 90)::date, '18:00', 'Rosewood Hall, Atlanta GA',   15000, 120, 'draft',     true),
    (event_upcoming,  planner_id, 'The Patel Wedding',       'Wedding',      'Multi-day wedding celebration.',    (CURRENT_DATE + 30)::date, '16:00', 'Grand Palazzo, Miami FL',     85000, 350, 'confirmed', true),
    (event_completed, planner_id, 'Sharma Anniversary Gala', 'Anniversary',  '25th anniversary celebration.',     (CURRENT_DATE - 45)::date, '19:00', 'Ritz Carlton, Chicago IL',    42000, 180, 'completed', true);

  INSERT INTO public.event_members (event_id, user_id, role) VALUES
    (event_upcoming,  planner_id, 'owner'),
    (event_upcoming,  vendor_id,  'editor'),
    (event_completed, planner_id, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.guests (event_id, full_name, email, phone, household, rsvp_status, plus_ones, meal_choice, is_test_seed) VALUES
    (event_upcoming, 'Rajesh Kumar', 'rajesh.k@example.com', '+1-555-0101', 'Kumar Family',  'yes',     2, 'Vegetarian', true),
    (event_upcoming, 'Anita Sharma', 'anita.s@example.com',  '+1-555-0102', 'Sharma Family', 'yes',     1, 'Vegan',      true),
    (event_upcoming, 'Vikram Singh', 'vikram.s@example.com', '+1-555-0103', 'Singh Family',  'no',      0, NULL,         true),
    (event_upcoming, 'Meera Patel',  'meera.p@example.com',  '+1-555-0104', 'Patel Family',  'maybe',   1, 'Non-Veg',    true),
    (event_upcoming, 'Deepak Iyer',  'deepak.i@example.com', '+1-555-0105', 'Iyer Family',   'yes',     0, 'Vegetarian', true),
    (event_upcoming, 'Kavya Reddy',  'kavya.r@example.com',  '+1-555-0106', 'Reddy Family',  'pending', 0, NULL,         true),
    (event_upcoming, 'Arjun Mehta',  'arjun.m@example.com',  '+1-555-0107', 'Mehta Family',  'yes',     2, 'Non-Veg',    true);

  INSERT INTO public.tasks (event_id, title, description, status, priority, due_date, assigned_to, created_by, is_test_seed) VALUES
    (event_upcoming, 'Finalize catering menu',      'Confirm final menu with Spice Route Caterers.', 'in_progress', 'high',   (CURRENT_DATE+7),  planner_id, planner_id, true),
    (event_upcoming, 'Confirm floral arrangements', 'Sign off on centerpieces and mandap decor.',    'todo',        'medium', (CURRENT_DATE+10), planner_id, planner_id, true),
    (event_upcoming, 'Send save-the-dates',         'All guests confirmed via email.',               'done',        'low',    (CURRENT_DATE-14), planner_id, planner_id, true),
    (event_upcoming, 'Book DJ',                     'Confirm DJ Ravi for reception.',                'todo',        'urgent', (CURRENT_DATE+3),  planner_id, planner_id, true),
    (event_upcoming, 'Order welcome bags',          'Include itinerary and local treats.',           'todo',        'low',    (CURRENT_DATE+21), planner_id, planner_id, true);

  INSERT INTO public.budget_items (event_id, category, label, estimated_amount, actual_amount, paid_amount, vendor_name, created_by, is_test_seed) VALUES
    (event_upcoming, 'Venue',       'Grand Palazzo rental', 25000, 25000, 12500, 'Grand Palazzo',     planner_id, true),
    (event_upcoming, 'Catering',    'Dinner + appetizers',  18000, 17500,  8000, 'Spice Route',       planner_id, true),
    (event_upcoming, 'Florals',     'Mandap + centerpieces', 8000,  7200,     0, 'Bloom & Petal',     planner_id, true),
    (event_upcoming, 'Photography', 'Full-day coverage',    12000, 12000,  6000, 'Lens Story Studio', planner_id, true),
    (event_upcoming, 'Music',       'DJ + live musicians',   7000,     0,     0, NULL,                planner_id, true),
    (event_upcoming, 'Attire',      'Bridal outfits',       15000, 14200, 14200, 'Anokhi Couture',    planner_id, true);

  INSERT INTO public.event_files (event_id, uploaded_by, category, storage_path, filename, mime_type, size_bytes, is_test_seed) VALUES
    (event_upcoming, planner_id, 'contracts', 'test-seed/venue-contract.pdf',   'venue-contract.pdf',   'application/pdf', 245000, true),
    (event_upcoming, planner_id, 'invoices',  'test-seed/catering-invoice.pdf', 'catering-invoice.pdf', 'application/pdf',  85000, true),
    (event_upcoming, planner_id, 'photos',    'test-seed/venue-preview.jpg',    'venue-preview.jpg',    'image/jpeg',      420000, true);

  INSERT INTO public.conversations (id, owner_id, title, type, labels, last_message_at, last_message_preview, is_test_seed) VALUES
    (vendor_convo_id, planner_id, 'Spice Route — catering thread', 'direct', ARRAY['vendor'], now(), 'Menu locked in — thanks!', true);
  INSERT INTO public.conversation_participants (conversation_id, user_id, participant_role) VALUES
    (vendor_convo_id, planner_id, 'owner'),
    (vendor_convo_id, vendor_id,  'member')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.messages (conversation_id, sender_id, body, attachments, status, is_test_seed) VALUES
    (vendor_convo_id, planner_id, 'Hi, sending over the guest count update — 350 confirmed.', '[]'::jsonb, 'delivered', true),
    (vendor_convo_id, vendor_id,  'Got it. I''ll update the menu proposal today.',            '[]'::jsonb, 'delivered', true),
    (vendor_convo_id, planner_id, 'Menu locked in — thanks!',                                 '[]'::jsonb, 'delivered', true);

  INSERT INTO public.notifications (user_id, category, title, body, href, is_test_seed) VALUES
    (planner_id, 'messages', 'New reply from Spice Route', 'Menu proposal updated.',         '/messaging', true),
    (planner_id, 'team',     'Vendor accepted invite',     'Test Vendor joined your event.', '/events',    true),
    (vendor_id,  'messages', 'New inquiry from Test Planner', 'Wants pricing for 350 guests.', '/messaging',   true),
    (vendor_id,  'payments', 'Deposit received',              '$8,000 deposit from Patel Wedding.', '/subscription', true),
    (admin_id,   'system',   '3 vendor applications pending review', NULL, '/admin',   true),
    (admin_id,   'system',   'Platform activity summary ready',       NULL, '/reports', true);

  INSERT INTO public.subscriptions (user_id, stripe_subscription_id, stripe_customer_id, product_id, price_id, status, current_period_start, current_period_end, cancel_at_period_end, environment, is_test_seed) VALUES
    (planner_id, 'sub_test_seed_planner', 'cus_test_seed_planner', 'prod_test_planner_pro', 'planner_pro_monthly', 'active', now(), now() + interval '30 days', false, 'sandbox', true);

  INSERT INTO public.vendor_profiles (user_id, business_name, business_category, business_description, phone, email, website, city, state, starting_price, years_in_business, accepted_terms, onboarding_completed, is_test_seed)
  VALUES (vendor_id, 'Spice Route Caterers', 'Catering', 'Award-winning South Asian catering for weddings and events.', '+1-555-0200', 'vendor@test.melabridge.com', 'https://example.com/spice-route', 'Miami', 'FL', 85, 12, true, true, true)
  ON CONFLICT (user_id) DO UPDATE SET is_test_seed = true, onboarding_completed = true;

  RETURN jsonb_build_object('ok', true, 'events', 3, 'guests', 7, 'tasks', 5, 'budget_items', 6, 'files', 3, 'messages', 3, 'notifications', 6);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_test_data(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_test_data(uuid, uuid, uuid) TO service_role;


-- === Migration: 20260714190107_c99ef642-f322-4a57-a303-46174bc1662d.sql ===
-- Restrict calendar RLS policies to authenticated role for defense in depth
DROP POLICY IF EXISTS avail_owner_all ON public.calendar_availability;
CREATE POLICY avail_owner_all ON public.calendar_availability
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS blocked_owner_all ON public.calendar_blocked_dates;
CREATE POLICY blocked_owner_all ON public.calendar_blocked_dates
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS settings_owner_all ON public.calendar_settings;
CREATE POLICY settings_owner_all ON public.calendar_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- calendar_booking_requests: scope to authenticated
DROP POLICY IF EXISTS req_planner_insert ON public.calendar_booking_requests;
CREATE POLICY req_planner_insert ON public.calendar_booking_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = planner_id);

DROP POLICY IF EXISTS req_planner_read ON public.calendar_booking_requests;
CREATE POLICY req_planner_read ON public.calendar_booking_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = planner_id);

DROP POLICY IF EXISTS req_planner_update_own ON public.calendar_booking_requests;
CREATE POLICY req_planner_update_own ON public.calendar_booking_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = planner_id AND status = ANY (ARRAY['pending'::calendar_request_status, 'alternate_proposed'::calendar_request_status]))
  WITH CHECK (auth.uid() = planner_id);

DROP POLICY IF EXISTS req_vendor_all ON public.calendar_booking_requests;
CREATE POLICY req_vendor_all ON public.calendar_booking_requests
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = calendar_booking_requests.vendor_id AND vp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = calendar_booking_requests.vendor_id AND vp.user_id = auth.uid()));

-- calendar_events: vendor policy via vendor_profiles link (consistent with vendor_bookings)
DROP POLICY IF EXISTS cal_events_planner_read ON public.calendar_events;
CREATE POLICY cal_events_planner_read ON public.calendar_events
  FOR SELECT TO authenticated
  USING (auth.uid() = planner_id);

DROP POLICY IF EXISTS cal_events_vendor_all ON public.calendar_events;
CREATE POLICY cal_events_vendor_all ON public.calendar_events
  FOR ALL TO authenticated
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);

-- === Migration: 20260714190140_f403fdfc-d649-40a4-af62-d029835b6318.sql ===
DROP POLICY IF EXISTS req_vendor_all ON public.calendar_booking_requests;
CREATE POLICY req_vendor_all ON public.calendar_booking_requests
  FOR ALL TO authenticated
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);

-- === Migration: 20260714201758_32f56447-1873-46a8-bf16-884bd1002271.sql ===

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


-- === Migration: 20260714205715_f40e16cb-f5e4-47e7-8388-876a1520f03e.sql ===

CREATE TABLE public.event_runsheet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  start_time time,
  duration_min integer NOT NULL DEFAULT 15,
  title text NOT NULL,
  owner text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  is_sample boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_runsheet_items TO authenticated;
GRANT ALL ON public.event_runsheet_items TO service_role;
ALTER TABLE public.event_runsheet_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Runsheet: members read" ON public.event_runsheet_items FOR SELECT USING (app_private.is_event_member(event_id, auth.uid()));
CREATE POLICY "Runsheet: editors insert" ON public.event_runsheet_items FOR INSERT WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "Runsheet: editors update" ON public.event_runsheet_items FOR UPDATE USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role)) WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "Runsheet: editors delete" ON public.event_runsheet_items FOR DELETE USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE TRIGGER trg_runsheet_updated_at BEFORE UPDATE ON public.event_runsheet_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_runsheet_event ON public.event_runsheet_items(event_id, sort_order);

DO $$ BEGIN
  CREATE TYPE public.vendor_need_status AS ENUM ('required','recommended','optional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.event_vendor_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category text NOT NULL,
  status public.vendor_need_status NOT NULL DEFAULT 'recommended',
  priority integer NOT NULL DEFAULT 3,
  notes text,
  booked_vendor_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  is_sample boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_vendor_needs TO authenticated;
GRANT ALL ON public.event_vendor_needs TO service_role;
ALTER TABLE public.event_vendor_needs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "VendorNeeds: members read" ON public.event_vendor_needs FOR SELECT USING (app_private.is_event_member(event_id, auth.uid()));
CREATE POLICY "VendorNeeds: editors insert" ON public.event_vendor_needs FOR INSERT WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "VendorNeeds: editors update" ON public.event_vendor_needs FOR UPDATE USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role)) WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "VendorNeeds: editors delete" ON public.event_vendor_needs FOR DELETE USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE TRIGGER trg_vendor_needs_updated_at BEFORE UPDATE ON public.event_vendor_needs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_vendor_needs_event ON public.event_vendor_needs(event_id, sort_order);


-- === Migration: 20260714211930_0b38a853-c58b-4010-b103-8666a5885af1.sql ===

-- 1) Vendor profiles: drop broad authenticated SELECT on base table.
-- Public marketplace reads use the vendor_profiles_public view (safe columns only).
DROP POLICY IF EXISTS "Vendor profiles: authenticated read of completed listings" ON public.vendor_profiles;

-- Make the public view run with definer rights so it can read the base table
-- after the broad RLS policy is removed, exposing only safe marketing columns.
ALTER VIEW public.vendor_profiles_public SET (security_invoker = false);

GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;

-- 2) event_members: remove email-existence probe from insert/update policies.
DROP POLICY IF EXISTS "Members: admins can add" ON public.event_members;
DROP POLICY IF EXISTS "Members: admins can update" ON public.event_members;

CREATE POLICY "Members: admins can add"
  ON public.event_members
  FOR INSERT
  WITH CHECK (
    app_private.has_event_access(event_id, auth.uid(), 'admin'::event_role)
    AND (
      invited_email IS NULL
      OR invited_email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
    )
  );

CREATE POLICY "Members: admins can update"
  ON public.event_members
  FOR UPDATE
  USING (app_private.has_event_access(event_id, auth.uid(), 'admin'::event_role))
  WITH CHECK (
    app_private.has_event_access(event_id, auth.uid(), 'admin'::event_role)
    AND (
      invited_email IS NULL
      OR invited_email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
    )
  );


-- === Migration: 20260714211954_6ceb3e88-785c-4f64-9d6d-2e549b093d82.sql ===

-- Revert view to invoker semantics so it respects RLS.
ALTER VIEW public.vendor_profiles_public SET (security_invoker = true);

-- Revoke direct column access on the base table from anon/authenticated,
-- then grant SELECT only on the safe marketing columns. Sensitive columns
-- (phone, email, business_address) are only reachable by the owner or
-- via server-side (service_role) code.
REVOKE SELECT ON public.vendor_profiles FROM anon, authenticated;

GRANT SELECT
  (id, user_id, business_name, business_category, business_description,
   website, logo_url, city, state, travel_radius, mobile_service,
   virtual_services, years_in_business, starting_price, business_hours,
   social_links, portfolio_urls, onboarding_completed, created_at, updated_at)
  ON public.vendor_profiles TO anon, authenticated;

-- Restore a limited row-level SELECT policy so the public view returns rows
-- of completed listings, but only the safe columns granted above are readable.
DROP POLICY IF EXISTS "Vendor profiles: public marketing read" ON public.vendor_profiles;
CREATE POLICY "Vendor profiles: public marketing read"
  ON public.vendor_profiles
  FOR SELECT
  TO anon, authenticated
  USING (onboarding_completed = true);


-- === Migration: 20260714212013_9b58e437-e6d1-4566-9fbc-4ab49b0f0405.sql ===

-- Restore full column SELECT on base table; RLS policies scope who can see rows.
REVOKE SELECT ON public.vendor_profiles FROM anon, authenticated;
GRANT SELECT ON public.vendor_profiles TO authenticated;

-- Drop the row-level marketing policy so only owners / event-owners can select
-- from the base table. Public marketplace reads go through vendor_profiles_public.
DROP POLICY IF EXISTS "Vendor profiles: public marketing read" ON public.vendor_profiles;

-- Public view runs with definer rights and exposes only safe marketing columns.
ALTER VIEW public.vendor_profiles_public SET (security_invoker = false);
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;


-- === Migration: 20260714214216_cd3c30ab-48ba-48d2-985f-5db95b487a36.sql ===

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


-- === Migration: 20260714214639_4bb883f1-c9aa-4e40-8725-82a85cc9b034.sql ===

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


-- === Migration: 20260714220343_1c73aba1-ceb9-4c51-ae28-7c29c74fc5ac.sql ===
ALTER VIEW public.vendor_profiles_public SET (security_invoker = true);

-- === Migration: 20260715021800_cd21a7fa-aa8e-4c09-a917-c8bc2911b7c8.sql ===
-- 1. Add tickets_enabled to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tickets_enabled boolean NOT NULL DEFAULT false;

-- Auto-enable for ticketed event types
UPDATE public.events
SET tickets_enabled = true
WHERE tickets_enabled = false
  AND event_type IN ('Conference','Festival','Fundraiser','Community','Gala','Concert','Workshop');

-- 2. ticket_types
CREATE TABLE public.ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  quantity integer,
  sold_count integer NOT NULL DEFAULT 0,
  sales_start timestamptz,
  sales_end timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_types_event ON public.ticket_types(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_types TO authenticated;
GRANT SELECT ON public.ticket_types TO anon;
GRANT ALL ON public.ticket_types TO service_role;

ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;

-- Anyone can read active types for events with ticketing enabled (public buy page)
CREATE POLICY "Public can view active ticket types"
  ON public.ticket_types FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.tickets_enabled = true AND e.deleted_at IS NULL
    )
  );

-- Owners/editors can manage
CREATE POLICY "Event members can view all ticket types"
  ON public.ticket_types FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_members m
      WHERE m.event_id = ticket_types.event_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Event owners can insert ticket types"
  ON public.ticket_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid())
  );

CREATE POLICY "Event owners can update ticket types"
  ON public.ticket_types FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()));

CREATE POLICY "Event owners can delete ticket types"
  ON public.ticket_types FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()));

CREATE TRIGGER tg_ticket_types_updated_at
  BEFORE UPDATE ON public.ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. ticket_orders
CREATE TABLE public.ticket_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id) ON DELETE RESTRICT,
  buyer_name text,
  buyer_email text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending',
  stripe_session_id text,
  stripe_payment_intent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_orders_event ON public.ticket_orders(event_id);
CREATE INDEX idx_ticket_orders_type ON public.ticket_orders(ticket_type_id);
CREATE INDEX idx_ticket_orders_session ON public.ticket_orders(stripe_session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_orders TO authenticated;
GRANT ALL ON public.ticket_orders TO service_role;

ALTER TABLE public.ticket_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event owners can view orders"
  ON public.ticket_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_members m
      WHERE m.event_id = ticket_orders.event_id AND m.user_id = auth.uid()
    )
  );

-- Inserts/updates come from server-side (service_role) via Stripe webhook / checkout server fn.

CREATE TRIGGER tg_ticket_orders_updated_at
  BEFORE UPDATE ON public.ticket_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. ticket_attendees
CREATE TABLE public.ticket_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.ticket_orders(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  full_name text,
  email text,
  qr_code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_attendees_order ON public.ticket_attendees(order_id);
CREATE INDEX idx_ticket_attendees_event ON public.ticket_attendees(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_attendees TO authenticated;
GRANT ALL ON public.ticket_attendees TO service_role;

ALTER TABLE public.ticket_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event owners can view attendees"
  ON public.ticket_attendees FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_members m
      WHERE m.event_id = ticket_attendees.event_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Event owners can check in attendees"
  ON public.ticket_attendees FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()));

-- === Migration: 20260715022738_c1ca8a24-01d8-4fe5-b8c4-b469e3c0ddcc.sql ===
ALTER TABLE public.ticket_types
  ADD COLUMN IF NOT EXISTS max_per_order integer NOT NULL DEFAULT 10 CHECK (max_per_order BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','unlisted')),
  ADD COLUMN IF NOT EXISTS promo_code text;

CREATE INDEX IF NOT EXISTS idx_ticket_attendees_qr ON public.ticket_attendees (qr_code);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_event ON public.ticket_orders (event_id, status);

-- === Migration: 20260715023624_1c987cb4-b411-40f5-99f6-4accad267402.sql ===

ALTER TABLE public.ticket_orders
  ADD COLUMN IF NOT EXISTS refund_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text;

CREATE INDEX IF NOT EXISTS idx_ticket_orders_pi ON public.ticket_orders (stripe_payment_intent);


-- === Migration: 20260715024858_be5f23ed-2dd4-45f4-9f35-768ca3ad5f0e.sql ===
CREATE TABLE public.ticket_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES public.ticket_types(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 20),
  note TEXT,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_type_id, email)
);

CREATE INDEX ticket_waitlist_event_idx ON public.ticket_waitlist(event_id, created_at DESC);
CREATE INDEX ticket_waitlist_type_idx ON public.ticket_waitlist(ticket_type_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_waitlist TO authenticated;
GRANT INSERT ON public.ticket_waitlist TO anon;
GRANT ALL ON public.ticket_waitlist TO service_role;

ALTER TABLE public.ticket_waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can add themselves to the waitlist (public form).
CREATE POLICY "Anyone can join waitlist"
  ON public.ticket_waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Event owners can view/manage their waitlist.
CREATE POLICY "Event owners can read waitlist"
  ON public.ticket_waitlist FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = ticket_waitlist.event_id AND e.owner_id = auth.uid()));

CREATE POLICY "Event owners can update waitlist"
  ON public.ticket_waitlist FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = ticket_waitlist.event_id AND e.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = ticket_waitlist.event_id AND e.owner_id = auth.uid()));

CREATE POLICY "Event owners can delete waitlist"
  ON public.ticket_waitlist FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = ticket_waitlist.event_id AND e.owner_id = auth.uid()));

CREATE TRIGGER update_ticket_waitlist_updated_at
  BEFORE UPDATE ON public.ticket_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- === Migration: 20260715024920_84276925-0463-4a0d-8265-25404a69332b.sql ===
DROP POLICY "Anyone can join waitlist" ON public.ticket_waitlist;

CREATE POLICY "Anyone can join waitlist for public tickets"
  ON public.ticket_waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ticket_types t
      WHERE t.id = ticket_waitlist.ticket_type_id
        AND t.event_id = ticket_waitlist.event_id
        AND t.is_active = true
        AND t.visibility = 'public'
    )
    AND length(trim(full_name)) BETWEEN 1 AND 120
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(email) <= 200
    AND notified_at IS NULL
  );


-- === Migration: 20260715030907_02c43e4b-72ef-455e-950a-8ef83677659c.sql ===

-- Add invitation guidance column to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS invitation_guidance TEXT;

-- Shopping list per event
CREATE TABLE IF NOT EXISTS public.event_shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'General',
  item TEXT NOT NULL,
  quantity TEXT,
  notes TEXT,
  purchased BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_test_seed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_shopping_event ON public.event_shopping_items(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_shopping_items TO authenticated;
GRANT ALL ON public.event_shopping_items TO service_role;

ALTER TABLE public.event_shopping_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event members can view shopping items"
  ON public.event_shopping_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_shopping_items.event_id
        AND (e.owner_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.event_members m
                        WHERE m.event_id = e.id AND m.user_id = auth.uid()))
    )
  );

CREATE POLICY "Event members can insert shopping items"
  ON public.event_shopping_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_shopping_items.event_id
        AND (e.owner_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.event_members m
                        WHERE m.event_id = e.id AND m.user_id = auth.uid()))
    )
  );

CREATE POLICY "Event members can update shopping items"
  ON public.event_shopping_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_shopping_items.event_id
        AND (e.owner_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.event_members m
                        WHERE m.event_id = e.id AND m.user_id = auth.uid()))
    )
  );

CREATE POLICY "Event members can delete shopping items"
  ON public.event_shopping_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_shopping_items.event_id
        AND (e.owner_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.event_members m
                        WHERE m.event_id = e.id AND m.user_id = auth.uid()))
    )
  );

DROP TRIGGER IF EXISTS trg_event_shopping_updated_at ON public.event_shopping_items;
CREATE TRIGGER trg_event_shopping_updated_at
  BEFORE UPDATE ON public.event_shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- === Migration: 20260715221719_0a85d09c-f67f-4797-888e-6bfbb0e040c0.sql ===
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;

-- === Migration: 20260715221914_a611368f-4026-4d68-925a-deabde799b8f.sql ===
ALTER VIEW public.vendor_profiles_public SET (security_invoker = false);
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;

-- === Migration: 20260715221934_8b617066-048a-4f2f-a707-1fe69cd75d80.sql ===
ALTER VIEW public.vendor_profiles_public SET (security_invoker = true);

CREATE POLICY "Vendor profiles: public read onboarded"
  ON public.vendor_profiles
  FOR SELECT
  TO anon, authenticated
  USING (onboarding_completed = true);

GRANT SELECT ON public.vendor_profiles TO anon;


-- === Migration: 20260715231041_953bf5c7-684d-4e32-adf9-4e20bb8693e8.sql ===

-- Atomic free-ticket claim: locks the ticket type, validates capacity/window,
-- creates the order + attendees, and bumps sold_count in one transaction.
CREATE OR REPLACE FUNCTION public.claim_free_tickets(
  _ticket_type_id uuid,
  _buyer_name text,
  _buyer_email text,
  _quantity int,
  _promo_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.ticket_types%ROWTYPE;
  new_order_id uuid;
BEGIN
  IF _quantity IS NULL OR _quantity < 1 THEN
    RAISE EXCEPTION 'Invalid quantity' USING ERRCODE = '22023';
  END IF;
  IF _buyer_email IS NULL OR length(btrim(_buyer_email)) = 0 THEN
    RAISE EXCEPTION 'Buyer email required' USING ERRCODE = '22023';
  END IF;

  -- Row-lock the ticket type to serialize concurrent claims.
  SELECT * INTO t
  FROM public.ticket_types
  WHERE id = _ticket_type_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket type not found' USING ERRCODE = 'P0002';
  END IF;
  IF t.price_cents <> 0 THEN
    RAISE EXCEPTION 'Not a free ticket type' USING ERRCODE = '22023';
  END IF;
  IF NOT t.is_active THEN
    RAISE EXCEPTION 'This ticket is no longer available.' USING ERRCODE = '22023';
  END IF;
  IF t.sales_start IS NOT NULL AND t.sales_start > now() THEN
    RAISE EXCEPTION 'Sales have not started yet.' USING ERRCODE = '22023';
  END IF;
  IF t.sales_end IS NOT NULL AND t.sales_end < now() THEN
    RAISE EXCEPTION 'Sales have ended.' USING ERRCODE = '22023';
  END IF;
  IF _quantity > COALESCE(t.max_per_order, 10) THEN
    RAISE EXCEPTION 'Over per-order limit' USING ERRCODE = '22023';
  END IF;
  IF t.quantity IS NOT NULL AND (t.sold_count + _quantity) > t.quantity THEN
    RAISE EXCEPTION 'Not enough tickets remaining.' USING ERRCODE = '22023';
  END IF;
  IF t.promo_code IS NOT NULL
     AND upper(coalesce(btrim(_promo_code), '')) <> upper(t.promo_code) THEN
    RAISE EXCEPTION 'Promo code required.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ticket_orders
    (event_id, ticket_type_id, buyer_name, buyer_email, quantity,
     amount_cents, currency, status, finalized_at)
  VALUES
    (t.event_id, t.id, _buyer_name, lower(btrim(_buyer_email)), _quantity,
     0, t.currency, 'paid', now())
  RETURNING id INTO new_order_id;

  INSERT INTO public.ticket_attendees (order_id, event_id, full_name, email)
  SELECT new_order_id, t.event_id,
         CASE WHEN i = 1 THEN _buyer_name ELSE NULL END,
         CASE WHEN i = 1 THEN lower(btrim(_buyer_email)) ELSE NULL END
  FROM generate_series(1, _quantity) AS i;

  UPDATE public.ticket_types
     SET sold_count = sold_count + _quantity
   WHERE id = t.id;

  RETURN new_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_free_tickets(uuid, text, text, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_free_tickets(uuid, text, text, int, text) TO service_role;

-- Atomic refund apply: locks the order + type, updates refund state,
-- and on full refund decrements inventory + clears non-checked-in attendees.
-- Called AFTER a successful Stripe refund (or immediately for free orders).
CREATE OR REPLACE FUNCTION public.apply_ticket_refund(
  _order_id uuid,
  _refund_delta_cents int,
  _reason text DEFAULT NULL
)
RETURNS TABLE(refund_amount_cents int, status text, released boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.ticket_orders%ROWTYPE;
  new_refunded int;
  is_full boolean;
BEGIN
  IF _refund_delta_cents IS NULL OR _refund_delta_cents < 1 THEN
    RAISE EXCEPTION 'Refund amount must be positive' USING ERRCODE = '22023';
  END IF;

  -- Lock the order row for the duration of the transaction.
  SELECT * INTO o
  FROM public.ticket_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;
  IF o.status NOT IN ('paid', 'partially_refunded') THEN
    RAISE EXCEPTION 'Only paid orders can be refunded' USING ERRCODE = '22023';
  END IF;

  new_refunded := COALESCE(o.refund_amount_cents, 0) + _refund_delta_cents;
  IF new_refunded > COALESCE(o.amount_cents, 0) AND COALESCE(o.amount_cents, 0) > 0 THEN
    RAISE EXCEPTION 'Refund exceeds order amount' USING ERRCODE = '22023';
  END IF;
  is_full := new_refunded >= COALESCE(o.amount_cents, 0);

  UPDATE public.ticket_orders
     SET refund_amount_cents = new_refunded,
         refund_reason = COALESCE(_reason, refund_reason),
         refunded_at = now(),
         status = CASE WHEN is_full THEN 'refunded' ELSE 'partially_refunded' END
   WHERE id = o.id;

  IF is_full THEN
    -- Lock the type row before touching inventory.
    PERFORM 1 FROM public.ticket_types WHERE id = o.ticket_type_id FOR UPDATE;
    UPDATE public.ticket_types
       SET sold_count = GREATEST(0, sold_count - o.quantity)
     WHERE id = o.ticket_type_id;
    DELETE FROM public.ticket_attendees
     WHERE order_id = o.id AND checked_in_at IS NULL;
  END IF;

  RETURN QUERY SELECT new_refunded,
    (CASE WHEN is_full THEN 'refunded' ELSE 'partially_refunded' END)::text,
    is_full;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_ticket_refund(uuid, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_ticket_refund(uuid, int, text) TO service_role;


-- === Migration: 20260715231102_8eb20450-6120-4bb9-a06a-4bbf568dee10.sql ===

REVOKE EXECUTE ON FUNCTION public.claim_free_tickets(uuid, text, text, int, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_ticket_refund(uuid, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_free_tickets(uuid, text, text, int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_ticket_refund(uuid, int, text) TO service_role;


-- === Migration: 20260715231725_c684b971-d317-4f9e-a141-08c08801434e.sql ===
-- RPC concurrency test seed — guarded so it is safe on a fresh project where
-- the dev user does not exist in auth.users.
DO $$
DECLARE
  owner_uid uuid := '102072e4-b1ef-4e8d-8ab4-bfe6d35f929d';
  ev_id uuid := '00000000-0000-0000-0000-0000cafe0002';
  free_type uuid := '00000000-0000-0000-0000-0000cafe0003';
  paid_type uuid := '00000000-0000-0000-0000-0000cafe0004';
  paid_order uuid := '00000000-0000-0000-0000-0000cafe0005';
BEGIN
  -- Always clean up first (idempotent)
  DELETE FROM public.ticket_attendees WHERE event_id = ev_id;
  DELETE FROM public.ticket_orders    WHERE event_id = ev_id;
  DELETE FROM public.ticket_types     WHERE event_id = ev_id;
  DELETE FROM public.events           WHERE id       = ev_id;

  -- Only seed test data when the dev user exists in this project
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = owner_uid) THEN
    RETURN;
  END IF;

  INSERT INTO public.events (id, owner_id, name, event_type, event_date, tickets_enabled, status)
  VALUES (ev_id, owner_uid, 'RPC concurrency test', 'Test', CURRENT_DATE + 30, true, 'draft');

  INSERT INTO public.ticket_types (id, event_id, name, price_cents, quantity, max_per_order, is_active)
  VALUES (free_type, ev_id, 'Free capped', 0, 5, 1, true);

  INSERT INTO public.ticket_types (id, event_id, name, price_cents, quantity, max_per_order, is_active)
  VALUES (paid_type, ev_id, 'Paid', 10000, 100, 5, true);

  INSERT INTO public.ticket_orders (id, event_id, ticket_type_id, buyer_name, buyer_email,
                                    quantity, amount_cents, currency, status,
                                    stripe_payment_intent, finalized_at)
  VALUES (paid_order, ev_id, paid_type, 'Buyer', 'buyer@test.local',
          1, 10000, 'usd', 'paid', 'pi_test_concurrency', now());
END $$;


-- === Migration: 20260715231817_03c7703f-0a4c-45bb-9f06-a7c5e09acd15.sql ===

DELETE FROM public.ticket_attendees WHERE event_id = '00000000-0000-0000-0000-0000cafe0002';
DELETE FROM public.ticket_orders    WHERE event_id = '00000000-0000-0000-0000-0000cafe0002';
DELETE FROM public.ticket_types     WHERE event_id = '00000000-0000-0000-0000-0000cafe0002';
DELETE FROM public.events           WHERE id       = '00000000-0000-0000-0000-0000cafe0002';


-- === Migration: 20260715233530_904ae381-4714-45b8-a0e3-55f700fd8e42.sql ===

-- 1) vendor_profiles: stop exposing PII (phone, email, business_address) to anon/authenticated.
--    Public marketplace already reads via public.vendor_profiles_public view.
--    Flip the view to security_invoker=false so it can run with owner privileges
--    (bypassing base-table RLS), then drop the base-table public read policy.
ALTER VIEW public.vendor_profiles_public SET (security_invoker = false);
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;
DROP POLICY IF EXISTS "Vendor profiles: public read onboarded" ON public.vendor_profiles;

-- 2) event_members: restrict admin write policies to the authenticated role.
DROP POLICY IF EXISTS "Members: admins can add" ON public.event_members;
CREATE POLICY "Members: admins can add"
  ON public.event_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    app_private.has_event_access(event_id, auth.uid(), 'admin'::event_role)
    AND ((invited_email IS NULL) OR (invited_email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'))
  );

DROP POLICY IF EXISTS "Members: admins can update" ON public.event_members;
CREATE POLICY "Members: admins can update"
  ON public.event_members
  FOR UPDATE
  TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'admin'::event_role))
  WITH CHECK (
    app_private.has_event_access(event_id, auth.uid(), 'admin'::event_role)
    AND ((invited_email IS NULL) OR (invited_email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'))
  );

-- 3) event_runsheet_items: scope every policy to authenticated.
DROP POLICY IF EXISTS "Runsheet: members read"   ON public.event_runsheet_items;
DROP POLICY IF EXISTS "Runsheet: editors insert" ON public.event_runsheet_items;
DROP POLICY IF EXISTS "Runsheet: editors update" ON public.event_runsheet_items;
DROP POLICY IF EXISTS "Runsheet: editors delete" ON public.event_runsheet_items;
CREATE POLICY "Runsheet: members read"   ON public.event_runsheet_items FOR SELECT TO authenticated
  USING (app_private.is_event_member(event_id, auth.uid()));
CREATE POLICY "Runsheet: editors insert" ON public.event_runsheet_items FOR INSERT TO authenticated
  WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "Runsheet: editors update" ON public.event_runsheet_items FOR UPDATE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role))
  WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "Runsheet: editors delete" ON public.event_runsheet_items FOR DELETE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));

-- 4) event_vendor_needs: scope every policy to authenticated.
DROP POLICY IF EXISTS "VendorNeeds: members read"   ON public.event_vendor_needs;
DROP POLICY IF EXISTS "VendorNeeds: editors insert" ON public.event_vendor_needs;
DROP POLICY IF EXISTS "VendorNeeds: editors update" ON public.event_vendor_needs;
DROP POLICY IF EXISTS "VendorNeeds: editors delete" ON public.event_vendor_needs;
CREATE POLICY "VendorNeeds: members read"   ON public.event_vendor_needs FOR SELECT TO authenticated
  USING (app_private.is_event_member(event_id, auth.uid()));
CREATE POLICY "VendorNeeds: editors insert" ON public.event_vendor_needs FOR INSERT TO authenticated
  WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "VendorNeeds: editors update" ON public.event_vendor_needs FOR UPDATE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role))
  WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "VendorNeeds: editors delete" ON public.event_vendor_needs FOR DELETE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));

-- 5) event_shopping_items: scope every policy to authenticated (preserve existing membership checks).
DROP POLICY IF EXISTS "Event members can view shopping items"   ON public.event_shopping_items;
DROP POLICY IF EXISTS "Event members can insert shopping items" ON public.event_shopping_items;
DROP POLICY IF EXISTS "Event members can update shopping items" ON public.event_shopping_items;
DROP POLICY IF EXISTS "Event members can delete shopping items" ON public.event_shopping_items;

CREATE POLICY "Event members can view shopping items"
  ON public.event_shopping_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_shopping_items.event_id
      AND (e.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.event_members m
                    WHERE m.event_id = e.id AND m.user_id = auth.uid()))
  ));

CREATE POLICY "Event members can insert shopping items"
  ON public.event_shopping_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_shopping_items.event_id
      AND (e.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.event_members m
                    WHERE m.event_id = e.id AND m.user_id = auth.uid()))
  ));

CREATE POLICY "Event members can update shopping items"
  ON public.event_shopping_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_shopping_items.event_id
      AND (e.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.event_members m
                    WHERE m.event_id = e.id AND m.user_id = auth.uid()))
  ));

CREATE POLICY "Event members can delete shopping items"
  ON public.event_shopping_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_shopping_items.event_id
      AND (e.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.event_members m
                    WHERE m.event_id = e.id AND m.user_id = auth.uid()))
  ));


-- === Migration: 20260724175423_619bc47b-946e-48c6-ad69-50445c701cc7.sql ===
-- Fix scanner finding: SECURITY DEFINER view bypasses RLS.
-- Switch the public marketplace view to security_invoker so RLS on the
-- underlying table is enforced, then add a narrow public SELECT policy
-- on vendor_profiles matching the view's existing filter.

ALTER VIEW public.vendor_profiles_public SET (security_invoker = on);

-- Only expose completed vendor profiles to anonymous/authenticated readers.
-- Column exposure is already narrowed by the view definition.
DROP POLICY IF EXISTS "Vendor profiles: public read onboarded" ON public.vendor_profiles;
CREATE POLICY "Vendor profiles: public read onboarded"
  ON public.vendor_profiles
  FOR SELECT
  TO anon, authenticated
  USING (onboarding_completed = true);

GRANT SELECT ON public.vendor_profiles TO anon;
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;

-- === Migration: 20260724175538_5c7d1b41-6391-4c46-ba78-45862b8b6a7d.sql ===
-- Follow-up: the previous migration correctly moved the view to security_invoker,
-- but the anon SELECT policy on vendor_profiles then exposed sensitive columns
-- (email, phone, address) via direct table queries. RLS is row-level, not
-- column-level, so we restrict anon access at the GRANT layer instead.

REVOKE SELECT ON public.vendor_profiles FROM anon;

-- Grant anon SELECT only on the columns exposed by public.vendor_profiles_public.
GRANT SELECT (
  id,
  user_id,
  business_name,
  business_category,
  business_description,
  website,
  logo_url,
  city,
  state,
  travel_radius,
  mobile_service,
  virtual_services,
  years_in_business,
  starting_price,
  business_hours,
  social_links,
  portfolio_urls,
  onboarding_completed,
  created_at,
  updated_at
) ON public.vendor_profiles TO anon;

-- Keep the row-level filter: only onboarded vendors are publicly visible.
-- (Policy 'Vendor profiles: public read onboarded' from prior migration stays.)

-- === Migration: 20260724175649_ff1477ea-ba23-44ce-be71-0af48de9a3ee.sql ===
-- Correct pattern: keep vendor_profiles fully private from anon; expose only
-- the curated projection via the view (view runs as owner = postgres).

DROP POLICY IF EXISTS "Vendor profiles: public read onboarded" ON public.vendor_profiles;

REVOKE SELECT ON public.vendor_profiles FROM anon;
REVOKE SELECT (
  id, user_id, business_name, business_category, business_description,
  website, logo_url, city, state, travel_radius, mobile_service,
  virtual_services, years_in_business, starting_price, business_hours,
  social_links, portfolio_urls, onboarding_completed, created_at, updated_at
) ON public.vendor_profiles FROM anon;

-- Run the public view as its owner so it can read the curated columns without
-- needing an anon policy on the base table. security_barrier prevents
-- predicate pushdown that could leak filtered rows via side channels.
ALTER VIEW public.vendor_profiles_public SET (security_invoker = off, security_barrier = on);

-- Only the view is reachable by anon / authenticated public callers.
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;

-- === Migration: 20260728000001_vendor_verification.sql ===
-- Add admin verification columns to vendor_profiles
-- Allows admins to mark vendor profiles as verified (BridgeCheck™ badge)

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for fast lookups of verified vendors
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_is_verified
  ON public.vendor_profiles (is_verified)
  WHERE is_verified = true;

-- Admin policy: only service_role may update is_verified
-- (enforced at application level via server functions with assertAdmin)


-- === Migration: 20260729000001_event_visibility.sql ===
-- Add event-level visibility for ticket page access control
-- 'public'    = event appears in discovery + shareable link works
-- 'link_only' = shareable link works but not in discovery (default)

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_visibility text NOT NULL DEFAULT 'public'
  CHECK (event_visibility IN ('public', 'link_only'));


-- === Migration: 20260729000003_vendor_packages.sql ===
-- vendor_packages: structured package offerings stored against a vendor profile
-- Vendors create/edit/reorder their own packages; anyone can read them for the marketplace.

CREATE TABLE IF NOT EXISTS public.vendor_packages (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id   UUID        NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT '',
  price_type  TEXT        NOT NULL DEFAULT 'fixed'
              CHECK (price_type IN ('fixed', 'starting_at', 'contact')),
  price_cents INTEGER,                         -- NULL when price_type = 'contact'
  description TEXT        NOT NULL DEFAULT '',
  inclusions  TEXT[]      NOT NULL DEFAULT '{}',
  duration    TEXT        NOT NULL DEFAULT '',
  add_ons     TEXT[]      NOT NULL DEFAULT '{}',
  is_featured BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_packages ENABLE ROW LEVEL SECURITY;

-- Vendors can manage their own packages
CREATE POLICY "vendor_packages_owner_all" ON public.vendor_packages
  FOR ALL TO authenticated
  USING (
    vendor_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    vendor_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid())
  );

-- Anyone (anon + authenticated) can read packages for marketplace display
CREATE POLICY "vendor_packages_public_read" ON public.vendor_packages
  FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT                              ON public.vendor_packages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE      ON public.vendor_packages TO authenticated;
GRANT ALL                                 ON public.vendor_packages TO service_role;

-- Index for fast vendor lookups
CREATE INDEX IF NOT EXISTS vendor_packages_vendor_id_sort
  ON public.vendor_packages (vendor_id, sort_order, created_at);


-- === Migration: 20260730000001_notification_preferences_category_constraint.sql ===
-- Fix notification_preferences unique constraint to include category.
-- The original constraint was (user_id, channel) which meant all category
-- rows for a user shared the same key, causing later upserts to overwrite
-- earlier ones. The correct key is (user_id, category, channel) so each
-- notification type can be independently toggled.

-- Drop the old constraint (may be named differently depending on Postgres auto-naming)
ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_user_id_channel_key;

-- Also drop by the common auto-generated pattern in case the name differs
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'notification_preferences'
    AND c.contype = 'u'
    AND array_to_string(ARRAY(
      SELECT a.attname
      FROM pg_attribute a
      WHERE a.attrelid = c.conrelid
        AND a.attnum = ANY(c.conkey)
      ORDER BY a.attnum
    ), ',') IN ('channel,user_id', 'user_id,channel');
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notification_preferences DROP CONSTRAINT IF EXISTS %I', cname);
  END IF;
END $$;

-- Add the category column if it doesn't already have a NOT NULL default
-- (it was added by a later migration — just ensure it exists before indexing)
ALTER TABLE public.notification_preferences
  ALTER COLUMN category SET DEFAULT 'general';

UPDATE public.notification_preferences
  SET category = 'event_updates'
  WHERE category IS NULL OR category = '';

ALTER TABLE public.notification_preferences
  ALTER COLUMN category SET NOT NULL;

-- Add the new composite unique constraint
ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_user_category_channel_key
  UNIQUE (user_id, category, channel);


-- === Migration: 20260730000002_event_public_page.sql ===
-- Public event page fields
-- Adds publish toggle, public description, FAQs, and gift registry to events.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_published         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_description   TEXT,
  ADD COLUMN IF NOT EXISTS public_faqs          JSONB    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gift_registry_url    TEXT,
  ADD COLUMN IF NOT EXISTS show_schedule_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_rsvp_public     BOOLEAN NOT NULL DEFAULT true;

-- Index for public lookups (only published events need fast lookups)
CREATE INDEX IF NOT EXISTS idx_events_is_published ON public.events (id) WHERE is_published = true;

-- ─── Security-definer RPC: public event page ──────────────────────────────────
-- Exposes ONLY the safe public-facing columns for a single published event.
-- Runs as the DB owner (SECURITY DEFINER), so it can read the base table without
-- granting SELECT on the full events table to the anon role.
-- The anon role gets EXECUTE on this function and nothing else.
CREATE OR REPLACE FUNCTION public.get_public_event_page(p_event_id uuid)
RETURNS TABLE (
  id                   uuid,
  name                 text,
  event_type           text,
  event_date           date,
  event_time           time,
  location             text,
  description          text,
  public_description   text,
  public_faqs          jsonb,
  gift_registry_url    text,
  show_schedule_public boolean,
  show_rsvp_public     boolean,
  cover_image_url      text,
  tickets_enabled      boolean
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT
    e.id,
    e.name,
    e.event_type,
    e.event_date,
    e.event_time,
    e.location,
    e.description,
    e.public_description,
    e.public_faqs,
    e.gift_registry_url,
    e.show_schedule_public,
    e.show_rsvp_public,
    e.cover_image_url,
    e.tickets_enabled
  FROM public.events e
  WHERE e.id = p_event_id
    AND e.is_published = true
    AND e.deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_event_page(uuid) TO anon;

-- ─── Security-definer RPC: public runsheet ────────────────────────────────────
-- Returns runsheet items only for published events.
-- Joins back to events to enforce the is_published check — so a caller who
-- knows a runsheet item ID cannot bypass the publication gate.
CREATE OR REPLACE FUNCTION public.get_public_runsheet(p_event_id uuid)
RETURNS TABLE (
  id           uuid,
  title        text,
  start_time   time,
  duration_min integer,
  owner        text,
  status       text,
  sort_order   integer
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT
    r.id,
    r.title,
    r.start_time,
    r.duration_min,
    r.owner,
    r.status,
    r.sort_order
  FROM public.event_runsheet_items r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.event_id = p_event_id
    AND e.is_published = true
    AND e.deleted_at IS NULL
  ORDER BY r.sort_order NULLS LAST, r.start_time NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_runsheet(uuid) TO anon;

-- NOTE: No SELECT grants on the base tables are added here.
-- The anon role accesses public event data exclusively through the two
-- SECURITY DEFINER functions above, which enforce the publication gate and
-- expose only the intended columns. Planner writes go through the authenticated
-- server function (updatePublicPageSettings) which uses requireSupabaseAuth
-- and the user's JWT, so RLS owner checks are enforced normally.


-- === Migration: 20260731000001_event_communications.sql ===
-- Event communications log
-- Stores messages that organizers have sent (or scheduled) to guest segments.

CREATE TABLE IF NOT EXISTS public.event_communications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject          TEXT        NOT NULL,
  body             TEXT        NOT NULL,
  recipient_group  TEXT        NOT NULL, -- 'all_guests' | 'confirmed' | 'pending' | 'declined' | 'ticket_holders' | 'checked_in'
  recipient_count  INT         NOT NULL DEFAULT 0,
  scheduled_for    TIMESTAMPTZ,          -- NULL = immediate send
  sent_at          TIMESTAMPTZ,
  status           TEXT        NOT NULL DEFAULT 'sent', -- 'sent' | 'scheduled' | 'failed'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_communications ENABLE ROW LEVEL SECURITY;

-- Organizer can see and insert communications for their own events.
CREATE POLICY "Event owner manages communications"
  ON public.event_communications
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT id FROM public.events WHERE owner_id = auth.uid()
    )
  );

-- Index for listing recent communications per event efficiently.
CREATE INDEX IF NOT EXISTS idx_event_comms_event_id_created
  ON public.event_communications (event_id, created_at DESC);


-- === Migration: 20260731000002_studio_designs.sql ===
-- BridgeStudio design persistence
CREATE TABLE IF NOT EXISTS public.studio_designs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id      uuid REFERENCES public.events(id) ON DELETE SET NULL,
  title         text NOT NULL DEFAULT 'Untitled Design',
  template_id   text,
  canvas_json   jsonb,
  thumbnail_url text,
  width         integer NOT NULL DEFAULT 480,
  height        integer NOT NULL DEFAULT 672,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_designs_owner" ON public.studio_designs;
-- Owners can CRUD their own designs only
CREATE POLICY "studio_designs_owner"
  ON public.studio_designs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS studio_designs_user_id_idx    ON public.studio_designs(user_id);
CREATE INDEX IF NOT EXISTS studio_designs_event_id_idx   ON public.studio_designs(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS studio_designs_updated_at_idx ON public.studio_designs(updated_at DESC);

-- === Migration: 20260911000001_vendor_package_photos.sql ===
ALTER TABLE public.vendor_packages
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.vendor_packages
  DROP CONSTRAINT IF EXISTS vendor_packages_photos_max_three;
ALTER TABLE public.vendor_packages
  ADD CONSTRAINT vendor_packages_photos_max_three
  CHECK (cardinality(photos) <= 3);

CREATE OR REPLACE FUNCTION public.validate_vendor_package_photos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  photo_url text;
  expected_prefix text;
BEGIN
  expected_prefix := 'https://fawkzsyuiduzjnlaxssd.supabase.co/storage/v1/object/public/vendor-assets/package-photos/'
    || NEW.vendor_id::text || '/' || NEW.id::text || '/';
  FOREACH photo_url IN ARRAY NEW.photos LOOP
    IF photo_url NOT LIKE expected_prefix || '%' THEN
      RAISE EXCEPTION 'Package photos must belong to this package';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_vendor_package_photos_trigger ON public.vendor_packages;
CREATE TRIGGER validate_vendor_package_photos_trigger
  BEFORE INSERT OR UPDATE OF photos, vendor_id ON public.vendor_packages
  FOR EACH ROW EXECUTE FUNCTION public.validate_vendor_package_photos();

CREATE TABLE IF NOT EXISTS public.package_photo_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  package_id uuid,
  storage_path text NOT NULL,
  photo_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, storage_path)
);

ALTER TABLE public.package_photo_cleanup_jobs
  DROP CONSTRAINT IF EXISTS package_photo_cleanup_path_matches_vendor;
ALTER TABLE public.package_photo_cleanup_jobs
  ADD CONSTRAINT package_photo_cleanup_path_matches_vendor
  CHECK (storage_path LIKE 'package-photos/' || vendor_id::text || '/%');
ALTER TABLE public.package_photo_cleanup_jobs
  DROP CONSTRAINT IF EXISTS package_photo_cleanup_url_matches_vendor;
ALTER TABLE public.package_photo_cleanup_jobs
  ADD CONSTRAINT package_photo_cleanup_url_matches_vendor
  CHECK (
    photo_url LIKE 'https://fawkzsyuiduzjnlaxssd.supabase.co/storage/v1/object/public/vendor-assets/package-photos/'
      || vendor_id::text || '/%'
  );

ALTER TABLE public.package_photo_cleanup_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "package photo cleanup owner" ON public.package_photo_cleanup_jobs;
CREATE POLICY "package photo cleanup owner"
  ON public.package_photo_cleanup_jobs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vendor
      WHERE vendor.id = package_photo_cleanup_jobs.vendor_id
        AND vendor.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vendor
      WHERE vendor.id = package_photo_cleanup_jobs.vendor_id
        AND vendor.user_id = auth.uid()
    )
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_photo_cleanup_jobs TO authenticated;

DROP POLICY IF EXISTS "vendor-assets: package photo upload" ON storage.objects;
CREATE POLICY "vendor-assets: package photo upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(name))[1] = 'package-photos'
    AND EXISTS (
      SELECT 1 FROM public.vendor_packages package
      JOIN public.vendor_profiles vendor ON vendor.id = package.vendor_id
      WHERE vendor.user_id = auth.uid()
        AND vendor.id::text = (storage.foldername(name))[2]
        AND package.id::text = (storage.foldername(name))[3]
    )
  );

DROP POLICY IF EXISTS "vendor-assets: package photo update" ON storage.objects;
CREATE POLICY "vendor-assets: package photo update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(name))[1] = 'package-photos'
    AND EXISTS (
      SELECT 1 FROM public.vendor_packages package
      JOIN public.vendor_profiles vendor ON vendor.id = package.vendor_id
      WHERE vendor.user_id = auth.uid()
        AND vendor.id::text = (storage.foldername(name))[2]
        AND package.id::text = (storage.foldername(name))[3]
    )
  )
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(name))[1] = 'package-photos'
    AND EXISTS (
      SELECT 1 FROM public.vendor_packages package
      JOIN public.vendor_profiles vendor ON vendor.id = package.vendor_id
      WHERE vendor.user_id = auth.uid()
        AND vendor.id::text = (storage.foldername(name))[2]
        AND package.id::text = (storage.foldername(name))[3]
    )
  );

DROP POLICY IF EXISTS "vendor-assets: package photo delete" ON storage.objects;
CREATE POLICY "vendor-assets: package photo delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(name))[1] = 'package-photos'
    AND (
      EXISTS (
        SELECT 1 FROM public.vendor_packages package
        JOIN public.vendor_profiles vendor ON vendor.id = package.vendor_id
        WHERE vendor.user_id = auth.uid()
          AND vendor.id::text = (storage.foldername(name))[2]
          AND package.id::text = (storage.foldername(name))[3]
      )
      OR EXISTS (
        SELECT 1 FROM public.package_photo_cleanup_jobs job
        JOIN public.vendor_profiles vendor ON vendor.id = job.vendor_id
        WHERE vendor.user_id = auth.uid()
          AND job.storage_path = name
          AND job.vendor_id::text = (storage.foldername(name))[2]
      )
    )
  );

