ALTER VIEW public.vendor_profiles_public SET (security_invoker = true);

CREATE POLICY "Vendor profiles: public read onboarded"
  ON public.vendor_profiles
  FOR SELECT
  TO anon, authenticated
  USING (onboarding_completed = true);

GRANT SELECT ON public.vendor_profiles TO anon;
