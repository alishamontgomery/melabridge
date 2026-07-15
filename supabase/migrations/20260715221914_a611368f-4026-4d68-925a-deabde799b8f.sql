ALTER VIEW public.vendor_profiles_public SET (security_invoker = false);
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;