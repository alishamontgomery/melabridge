CREATE POLICY "Vendor profiles: public read of completed listings"
ON public.vendor_profiles
FOR SELECT
TO anon, authenticated
USING (onboarding_completed = true);