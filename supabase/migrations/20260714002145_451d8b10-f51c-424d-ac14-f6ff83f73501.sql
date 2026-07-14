-- Restore invoker semantics on the public directory view.
ALTER VIEW public.vendor_profiles_public SET (security_invoker = true);

-- Re-allow anon to satisfy the view's row-level check, but only for
-- completed listings. Column-level grants below keep contact fields hidden.
DROP POLICY IF EXISTS "Vendor profiles: public read of completed listings" ON public.vendor_profiles;
CREATE POLICY "Vendor profiles: public read of completed listings"
ON public.vendor_profiles
FOR SELECT
TO anon, authenticated
USING (onboarding_completed = true);

-- Column-level lock-down for anon: revoke blanket SELECT, grant only the
-- non-contact columns the public view exposes. Signed-in users keep full
-- access via the authenticated grant already on the table.
REVOKE SELECT ON public.vendor_profiles FROM anon;
GRANT SELECT (
  id, user_id, business_name, business_category, business_description,
  website, logo_url, city, state, travel_radius, mobile_service,
  virtual_services, years_in_business, starting_price, business_hours,
  social_links, portfolio_urls, onboarding_completed,
  created_at, updated_at
) ON public.vendor_profiles TO anon;
