
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
