-- Prevent a normal authenticated client from promoting its own profile to admin.
-- Admin role changes remain available to the service-role-backed admin paths.

CREATE OR REPLACE FUNCTION public.prevent_client_admin_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_type = 'admin'
     AND OLD.account_type IS DISTINCT FROM 'admin'
     AND COALESCE(auth.role(), 'anon') <> 'service_role' THEN
    RAISE EXCEPTION 'Only an administrator can assign the admin role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_client_admin_promotion ON public.profiles;

CREATE TRIGGER prevent_client_admin_promotion
BEFORE UPDATE OF account_type ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_client_admin_promotion();