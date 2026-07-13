ALTER VIEW public.vendor_profiles_public SET (security_invoker = true);
-- Ensure the invoker (anon / authenticated) can pass RLS for the underlying rows.
-- Add a narrow row-visibility policy on the base table so the view returns onboarded rows
-- without exposing contact columns (columns not selected by the view are never read).
DROP POLICY IF EXISTS "Vendor profiles: view can read onboarded" ON public.vendor_profiles;
CREATE POLICY "Vendor profiles: view can read onboarded"
ON public.vendor_profiles FOR SELECT TO authenticated, anon
USING (onboarding_completed = true);