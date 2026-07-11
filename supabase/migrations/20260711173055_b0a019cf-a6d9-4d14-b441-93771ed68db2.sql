
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
