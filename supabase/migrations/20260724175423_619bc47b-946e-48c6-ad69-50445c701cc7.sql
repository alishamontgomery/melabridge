-- Fix scanner finding: SECURITY DEFINER view bypasses RLS.
-- Switch the public marketplace view to security_invoker so RLS on the
-- underlying table is enforced, then add a narrow public SELECT policy
-- on vendor_profiles matching the view's existing filter.

ALTER VIEW public.vendor_profiles_public SET (security_invoker = on);

-- Only expose completed vendor profiles to anonymous/authenticated readers.
-- Column exposure is already narrowed by the view definition.
DROP POLICY IF EXISTS "Vendor profiles: public read onboarded" ON public.vendor_profiles;
CREATE POLICY "Vendor profiles: public read onboarded"
  ON public.vendor_profiles
  FOR SELECT
  TO anon, authenticated
  USING (onboarding_completed = true);

GRANT SELECT ON public.vendor_profiles TO anon;
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;