
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.sync_role_from_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_role_from_profile() TO service_role;
