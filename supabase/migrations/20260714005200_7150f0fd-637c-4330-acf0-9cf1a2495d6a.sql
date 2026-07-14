DROP POLICY IF EXISTS "Vendor profiles: public read of completed listings" ON public.vendor_profiles;
REVOKE SELECT ON public.vendor_profiles FROM anon;