-- The view exposes only explicitly selected, redacted public columns. It must
-- not inherit vendor_profiles owner RLS, otherwise logged-out Marketplace and
-- public profile visitors receive 401 responses.
ALTER VIEW public.vendor_profiles_public SET (security_invoker = false);
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;