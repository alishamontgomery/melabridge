-- =========================================================
-- Race-safe admin role mutation (last-admin TOCTOU fix).
--
-- The application previously did check-then-act sequences for role
-- changes (count admins -> delete role rows -> insert new role) across
-- multiple round trips. Two concurrent admin requests could each observe
-- "2 admins remain" and both proceed, demoting/deleting every admin and
-- leaving the system with zero admins. The delete-then-insert also left a
-- window where a user could end up roleless if the insert failed.
--
-- The authoritative fix lives in the DB triggers on user_roles: every real
-- DELETE and every role-changing UPDATE (including the cascade deletion that
-- runs inside auth.admin.deleteUser's own transaction) acquires a shared
-- transaction-scoped advisory lock (pg_advisory_xact_lock) BEFORE counting
-- admins. Because the lock is held for the lifetime of the mutating
-- transaction, the count-and-block decision is serialized against every other
-- admin-role mutation and evaluated atomically. The lock releases
-- automatically on COMMIT/ROLLBACK.
--
-- replace_user_primary_role takes the same lock so a role replacement cannot
-- interleave with a deletion cascade or another replacement.
--
-- assert_admin_deletable remains a UX-only precheck. Its advisory lock is
-- released when the RPC returns (well before auth.admin.deleteUser starts),
-- so it does NOT make the auth deletion itself race-safe; the trigger inside
-- the cascade transaction is what actually enforces the invariant.
-- =========================================================

-- Shared lock key for every admin-role mutation. Chosen constant; the second
-- argument namespaces this from other advisory locks in the codebase.
-- key1 = 4820193 ("admin roles"), key2 = 1 (mutation domain).

-- ---------------------------------------------------------
-- guard_last_admin (BEFORE DELETE on user_roles): CREATE OR REPLACE of the
-- function from 20260815000001_protect_last_admin.sql. Now acquires the shared
-- advisory lock before counting, so a cascade delete of an admin's role row
-- (triggered by auth.admin.deleteUser) is serialized with concurrent role
-- replacements and cannot race past the last-admin check.
-- ---------------------------------------------------------
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

  -- Serialize this DELETE against every other admin-role mutation for the
  -- lifetime of the surrounding transaction (covers the auth-delete cascade).
  PERFORM pg_advisory_xact_lock(4820193, 1);

  SELECT COUNT(*) INTO admin_count
  FROM public.user_roles
  WHERE role = 'admin'::public.app_role;

  IF admin_count <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last remaining admin account.';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_last_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_last_admin() TO service_role;

-- ---------------------------------------------------------
-- guard_last_admin_update (BEFORE UPDATE OF role on user_roles): CREATE OR
-- REPLACE of the function from 20260815000001_protect_last_admin.sql. Also
-- acquires the shared advisory lock before counting.
-- ---------------------------------------------------------
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

  -- Serialize this UPDATE against every other admin-role mutation.
  PERFORM pg_advisory_xact_lock(4820193, 1);

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

-- ---------------------------------------------------------
-- replace_user_primary_role: atomically replace a user's single primary role.
--
-- Runs entirely inside one transaction:
--   1. Acquire the shared advisory lock (serializes with all other callers,
--      including the DELETE/UPDATE triggers above).
--   2. If the target is currently an admin and the new role is not admin,
--      ensure at least one OTHER admin will remain.
--   3. Delete the user's existing role rows, insert the new role.
-- If the insert fails, the whole transaction rolls back, so the user is
-- never left roleless. On COMMIT the advisory lock is released.
--
-- (The BEFORE DELETE trigger also acquires the same lock; re-acquiring an
-- advisory lock already held by the same transaction is a cheap no-op.)
-- ---------------------------------------------------------
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
  other_admin_count INTEGER;
  target_is_admin BOOLEAN;
BEGIN
  IF _user_id IS NULL OR _new_role IS NULL THEN
    RAISE EXCEPTION 'user_id and new_role are required';
  END IF;

  -- Serialize all admin-role mutations for the lifetime of this transaction.
  PERFORM pg_advisory_xact_lock(4820193, 1);

  -- Under the lock, evaluate the last-admin invariant atomically.
  IF _new_role <> 'admin'::public.app_role THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = 'admin'::public.app_role
    ) INTO target_is_admin;

    IF target_is_admin THEN
      SELECT COUNT(*) INTO other_admin_count
      FROM public.user_roles
      WHERE role = 'admin'::public.app_role
        AND user_id <> _user_id;

      IF other_admin_count < 1 THEN
        RAISE EXCEPTION 'Cannot demote the last remaining admin account.'
          USING ERRCODE = 'raise_exception';
      END IF;
    END IF;
  END IF;

  -- Atomic replace: delete then insert within the same transaction.
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _new_role);
END;
$$;

-- ---------------------------------------------------------
-- assert_admin_deletable: UX-ONLY precheck invoked before an auth user is
-- deleted via the admin API, so the UI can show a friendly last-admin message
-- instead of a raw cascade failure. Its transaction-scoped advisory lock is
-- released when this RPC returns -- BEFORE auth.admin.deleteUser runs -- so it
-- does NOT make the deletion race-safe. The BEFORE DELETE trigger, which fires
-- inside the auth-delete cascade transaction while holding the same lock, is
-- the actual enforcement point.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_admin_deletable(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  other_admin_count INTEGER;
  target_is_admin BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  PERFORM pg_advisory_xact_lock(4820193, 1);

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'::public.app_role
  ) INTO target_is_admin;

  IF target_is_admin THEN
    SELECT COUNT(*) INTO other_admin_count
    FROM public.user_roles
    WHERE role = 'admin'::public.app_role
      AND user_id <> _user_id;

    IF other_admin_count < 1 THEN
      RAISE EXCEPTION 'Cannot delete the last remaining admin account.'
        USING ERRCODE = 'raise_exception';
    END IF;
  END IF;
END;
$$;

-- ---------------------------------------------------------
-- Grants: these mutate roles with elevated privileges, so restrict execution
-- to the service role only. The application calls them from the server-side
-- service-role client after assertAdmin, preserving the existing boundary.
-- ---------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.replace_user_primary_role(uuid, public.app_role)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_user_primary_role(uuid, public.app_role)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.assert_admin_deletable(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_admin_deletable(uuid)
  TO service_role;
