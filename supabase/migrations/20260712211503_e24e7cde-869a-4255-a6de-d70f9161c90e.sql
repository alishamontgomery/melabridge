
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
