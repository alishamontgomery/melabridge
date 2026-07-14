
-- Restore full column SELECT on base table; RLS policies scope who can see rows.
REVOKE SELECT ON public.vendor_profiles FROM anon, authenticated;
GRANT SELECT ON public.vendor_profiles TO authenticated;

-- Drop the row-level marketing policy so only owners / event-owners can select
-- from the base table. Public marketplace reads go through vendor_profiles_public.
DROP POLICY IF EXISTS "Vendor profiles: public marketing read" ON public.vendor_profiles;

-- Public view runs with definer rights and exposes only safe marketing columns.
ALTER VIEW public.vendor_profiles_public SET (security_invoker = false);
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;
