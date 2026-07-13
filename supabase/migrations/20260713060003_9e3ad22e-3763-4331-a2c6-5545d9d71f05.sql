
-- Drop the broad discovery row policy — discovery goes through the safe view now.
DROP POLICY IF EXISTS "Vendor profiles: discoverable rows only" ON public.vendor_profiles;

-- Reset column-only grants and restore normal table-level SELECT for owner reads.
-- (Column grants without table grant were blocking .select("*") for the owner.)
GRANT SELECT ON public.vendor_profiles TO authenticated;
GRANT SELECT ON public.vendor_profiles TO service_role;
-- Anon should not touch the base table at all — discovery only via the view.
REVOKE ALL ON public.vendor_profiles FROM anon;

-- Public marketing view: SECURITY DEFINER (view owner's rights) so it can expose
-- onboarded, non-sensitive columns without the base table needing a broad row policy.
-- This is the pattern recommended by the finding itself.
ALTER VIEW public.vendor_profiles_public RESET (security_invoker);
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;

-- Clean up transitional views that are no longer needed
DROP VIEW IF EXISTS public.vendor_profiles_self;
DROP VIEW IF EXISTS public.vendor_profiles_for_event_owner;
