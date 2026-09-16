-- Launch-gate repair:
-- 1) restore the service-only role replacement RPC that profile switching and
--    admin role management already call;
-- 2) keep public profile writes and user_roles aligned without ever demoting
--    the private Admin role through a public profile update; and
-- 3) backfill only missing non-admin role rows. Existing user/event data is
--    retained and existing admin rows are never removed.

CREATE OR REPLACE FUNCTION public.replace_user_primary_role(
  _user_id uuid,
  _new_role public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  other_admin_count integer;
  target_is_admin boolean;
BEGIN
  IF _user_id IS NULL OR _new_role IS NULL THEN
    RAISE EXCEPTION 'user_id and new_role are required';
  END IF;

  PERFORM pg_advisory_xact_lock(4820193, 1);

  IF _new_role <> 'admin'::public.app_role THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = 'admin'::public.app_role
    )
    INTO target_is_admin;

    IF target_is_admin THEN
      SELECT COUNT(*)
      INTO other_admin_count
      FROM public.user_roles
      WHERE role = 'admin'::public.app_role
        AND user_id <> _user_id;

      IF other_admin_count < 1 THEN
        RAISE EXCEPTION 'Cannot demote the last remaining admin account.';
      END IF;
    END IF;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _new_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_admin_deletable(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  other_admin_count integer;
  target_is_admin boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  PERFORM pg_advisory_xact_lock(4820193, 1);

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'::public.app_role
  )
  INTO target_is_admin;

  IF target_is_admin THEN
    SELECT COUNT(*)
    INTO other_admin_count
    FROM public.user_roles
    WHERE role = 'admin'::public.app_role
      AND user_id <> _user_id;

    IF other_admin_count < 1 THEN
      RAISE EXCEPTION 'Cannot delete the last remaining admin account.';
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_role_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Public profile writes must never remove the private Admin role.
  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = NEW.id
      AND role = 'admin'::public.app_role
  ) AND NEW.account_type::text <> 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.account_type IS NOT NULL
     AND NEW.account_type IN ('personal', 'organization', 'vendor', 'admin') THEN
    IF NEW.account_type <> 'admin'::public.app_role THEN
      DELETE FROM public.user_roles
      WHERE user_id = NEW.id
        AND role <> NEW.account_type::public.app_role;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, NEW.account_type::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_user_primary_role(uuid, public.app_role)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_user_primary_role(uuid, public.app_role)
  TO service_role;

REVOKE ALL ON FUNCTION public.assert_admin_deletable(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_admin_deletable(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.sync_role_from_profile()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_role_from_profile()
  TO service_role;

-- The existing trigger name is stable in the prior migrations. Recreate it so
-- partially migrated environments receive the hardened function as well.
DROP TRIGGER IF EXISTS sync_role_after_profile_upsert ON public.profiles;
CREATE TRIGGER sync_role_after_profile_upsert
AFTER INSERT OR UPDATE OF account_type ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_role_from_profile();

-- Fill only roleless profiles. Do not rewrite existing role choices or admin
-- rows; this preserves existing account access and user-owned data.
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, p.account_type::public.app_role
FROM public.profiles AS p
WHERE p.account_type IN ('personal', 'organization', 'vendor')
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    WHERE ur.user_id = p.id
  )
ON CONFLICT (user_id, role) DO NOTHING;