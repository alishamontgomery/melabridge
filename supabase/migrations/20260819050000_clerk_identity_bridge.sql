-- Clerk external identity bridge.
--
-- This migration deliberately does not create, replace, or delete auth.users
-- records.  Clerk identities must be linked to the UUID already referenced by
-- the application's ownership columns before they receive application access.

CREATE TABLE IF NOT EXISTS public.clerk_identity_links (
  clerk_user_id TEXT PRIMARY KEY,
  legacy_user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clerk_identity_links'::regclass
      AND conname = 'clerk_identity_links_legacy_user_id_key'
  ) THEN
    ALTER TABLE public.clerk_identity_links
      ADD CONSTRAINT clerk_identity_links_legacy_user_id_key
      UNIQUE (legacy_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clerk_identity_links'::regclass
      AND conname = 'clerk_identity_links_status_check'
  ) THEN
    ALTER TABLE public.clerk_identity_links
      ADD CONSTRAINT clerk_identity_links_status_check
      CHECK (status IN ('active', 'pending', 'suspended'));
  END IF;
END;
$$;

ALTER TABLE public.clerk_identity_links ENABLE ROW LEVEL SECURITY;

-- Links are identity-administration data.  There are intentionally no client
-- policies: the SECURITY DEFINER resolver below is the only client-facing use.
REVOKE ALL ON TABLE public.clerk_identity_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.clerk_identity_links TO service_role;

CREATE OR REPLACE FUNCTION public.set_clerk_identity_link_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.status_updated_at := now();
    IF NEW.status = 'active' AND NEW.activated_at IS NULL THEN
      NEW.activated_at := now();
    ELSIF NEW.status = 'suspended' AND NEW.suspended_at IS NULL THEN
      NEW.suspended_at := now();
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at := now();
    IF NEW.status = 'active' AND NEW.activated_at IS NULL THEN
      NEW.activated_at := now();
    ELSIF NEW.status = 'suspended' AND NEW.suspended_at IS NULL THEN
      NEW.suspended_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.clerk_identity_links'::regclass
      AND tgname = 'trg_clerk_identity_links_timestamps'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_clerk_identity_links_timestamps
      BEFORE INSERT OR UPDATE ON public.clerk_identity_links
      FOR EACH ROW EXECUTE FUNCTION public.set_clerk_identity_link_timestamps();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_clerk_identity_link_timestamps() FROM PUBLIC, anon, authenticated;

-- Only an active Clerk identity link grants application access. Legacy
-- Supabase UUID subjects intentionally fail closed after the Clerk cutover.
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  jwt_subject TEXT := NULLIF(auth.jwt() ->> 'sub', '');
  resolved_user_id UUID;
BEGIN
  IF jwt_subject IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT link.legacy_user_id
    INTO resolved_user_id
  FROM public.clerk_identity_links AS link
  WHERE link.clerk_user_id = jwt_subject
    AND link.status = 'active';

  IF FOUND THEN
    RETURN resolved_user_id;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC;
-- anon needs execution where an existing public/storage policy evaluates this
-- resolver; it receives NULL unless a valid JWT identity resolves.
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO anon, authenticated, service_role;

-- Rebuild only affected policies. pg_policy is used rather than a hand-written
-- list so command (SELECT/INSERT/UPDATE/DELETE/ALL), roles, and permissive vs.
-- restrictive semantics are retained exactly. auth schema policies are excluded.
DO $$
DECLARE
  policy_record RECORD;
  policy_roles TEXT;
  policy_command TEXT;
  policy_qual TEXT;
  policy_with_check TEXT;
BEGIN
  FOR policy_record IN
    SELECT
      policy.polname,
      policy.polrelid,
      namespace.nspname,
      relation.relname,
      policy.polcmd,
      policy.polpermissive,
      policy.polroles,
      pg_get_expr(policy.polqual, policy.polrelid) AS qual,
      pg_get_expr(policy.polwithcheck, policy.polrelid) AS with_check
    FROM pg_policy AS policy
    JOIN pg_class AS relation ON relation.oid = policy.polrelid
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname IN ('public', 'storage')
      AND (
        COALESCE(pg_get_expr(policy.polqual, policy.polrelid), '') ~ 'auth\.uid\(\)'
        OR COALESCE(pg_get_expr(policy.polwithcheck, policy.polrelid), '') ~ 'auth\.uid\(\)'
      )
  LOOP
    SELECT CASE
      WHEN count(*) FILTER (WHERE role_oid = 0) > 0 THEN 'PUBLIC'
      ELSE string_agg(quote_ident(role_name), ', ' ORDER BY role_name)
    END
    INTO policy_roles
    FROM (
      SELECT role_oid, role.rolname AS role_name
      FROM unnest(policy_record.polroles) AS roles(role_oid)
      LEFT JOIN pg_roles AS role ON role.oid = roles.role_oid
    ) AS resolved_roles;

    policy_command := CASE policy_record.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
    END;
    policy_qual := regexp_replace(
      policy_record.qual, 'auth\.uid\(\)', 'public.current_app_user_id()', 'g'
    );
    policy_with_check := regexp_replace(
      policy_record.with_check, 'auth\.uid\(\)', 'public.current_app_user_id()', 'g'
    );

    EXECUTE format('DROP POLICY %I ON %I.%I',
      policy_record.polname, policy_record.nspname, policy_record.relname);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      policy_record.polname,
      policy_record.nspname,
      policy_record.relname,
      CASE WHEN policy_record.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      policy_command,
      COALESCE(policy_roles, 'PUBLIC'),
      CASE WHEN policy_qual IS NULL THEN '' ELSE ' USING (' || policy_qual || ')' END,
      CASE WHEN policy_with_check IS NULL THEN '' ELSE ' WITH CHECK (' || policy_with_check || ')' END
    );
  END LOOP;
END;
$$;

-- Preserve each existing public function's signature,
-- ownership, grants, volatility, and configuration while changing only auth.uid
-- calls in its generated definition. auth schema functions are never considered.
DO $$
DECLARE
  function_record RECORD;
BEGIN
  FOR function_record IN
    SELECT pg_get_functiondef(procedure.oid) AS definition
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.prokind = 'f'
      AND procedure.oid NOT IN (
        'public.current_app_user_id()'::regprocedure,
        'public.set_clerk_identity_link_timestamps()'::regprocedure
      )
      AND procedure.prosrc ~ 'auth\.uid\(\)'
  LOOP
    EXECUTE regexp_replace(
      function_record.definition,
      'auth\.uid\(\)',
      'public.current_app_user_id()',
      'g'
    );
  END LOOP;
END;
$$;

-- Validation after deployment (run as an administrator):
--   SELECT clerk_user_id, legacy_user_id, status FROM public.clerk_identity_links;
--   SELECT * FROM pg_policies
--     WHERE schemaname IN ('public', 'storage')
--       AND (COALESCE(qual, '') || COALESCE(with_check, '')) ~ 'auth\.uid\(\)';
--   SELECT public.current_app_user_id(); -- Clerk JWT: active link only; legacy UUID JWT: matching auth.users UUID.