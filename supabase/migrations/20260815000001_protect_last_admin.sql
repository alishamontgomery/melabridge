-- =========================================================
-- Protect the last admin account at the database level.
--
-- A BEFORE DELETE trigger on user_roles prevents deleting the
-- last admin role row via any path (admin UI, direct SQL, service role).
-- A BEFORE UPDATE trigger blocks changing the role away from admin
-- when only one admin row exists.
--
-- These complement the application-layer guards in admin-users.functions.ts.
-- =========================================================

CREATE OR REPLACE FUNCTION public.guard_last_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- Only applies when the affected row is an admin role.
  IF OLD.role::text <> 'admin' THEN
    RETURN OLD; -- not an admin row; allow
  END IF;

  SELECT COUNT(*) INTO admin_count
  FROM public.user_roles
  WHERE role = 'admin'::public.app_role;

  IF admin_count <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last remaining admin account.';
  END IF;

  RETURN OLD;
END;
$$;

-- Restrict execution to service_role only (trigger fires internally).
REVOKE EXECUTE ON FUNCTION public.guard_last_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_last_admin() TO service_role;

-- Protect against DELETE of the last admin role row.
DROP TRIGGER IF EXISTS trg_guard_last_admin_delete ON public.user_roles;
CREATE TRIGGER trg_guard_last_admin_delete
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_last_admin();

-- Protect against UPDATE that changes the last admin row to a different role.
CREATE OR REPLACE FUNCTION public.guard_last_admin_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- Only applies when we are changing FROM admin to something else.
  IF OLD.role::text <> 'admin' OR NEW.role::text = 'admin' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO admin_count
  FROM public.user_roles
  WHERE role = 'admin'::public.app_role;

  IF admin_count <= 1 THEN
    RAISE EXCEPTION 'Cannot demote the last remaining admin account.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_last_admin_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_last_admin_update() TO service_role;

DROP TRIGGER IF EXISTS trg_guard_last_admin_update ON public.user_roles;
CREATE TRIGGER trg_guard_last_admin_update
  BEFORE UPDATE OF role ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_last_admin_update();
