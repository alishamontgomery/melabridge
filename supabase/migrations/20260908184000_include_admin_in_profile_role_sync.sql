-- Keep profile.account_type and user_roles aligned for every current app role.
CREATE OR REPLACE FUNCTION public.sync_role_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_type IS NOT NULL
     AND NEW.account_type IN ('personal', 'organization', 'vendor', 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, NEW.account_type::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_role_from_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_role_from_profile() TO service_role;