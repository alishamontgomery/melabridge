
-- Fix 1: Vendor profiles public read exposure
DROP POLICY IF EXISTS "Vendor profiles: public read" ON public.vendor_profiles;

CREATE POLICY "Vendor profiles: owner read"
ON public.vendor_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

REVOKE SELECT ON public.vendor_profiles FROM anon;

-- Fix 2: Restrict SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_event_access(uuid, uuid, public.event_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_event_member(uuid, uuid) FROM PUBLIC, anon;
