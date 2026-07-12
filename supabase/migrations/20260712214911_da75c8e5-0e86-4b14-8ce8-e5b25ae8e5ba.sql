-- Revoke broad execute from trigger-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_role_from_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Tighten RLS helper functions: no anon execution, keep authenticated for RLS policy usage
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_event_access(uuid, uuid, public.event_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_event_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.event_role_rank(public.event_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_event_access(uuid, uuid, public.event_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.event_role_rank(public.event_role) TO authenticated;