
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
