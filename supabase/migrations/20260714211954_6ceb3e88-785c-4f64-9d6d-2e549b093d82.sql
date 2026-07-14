
-- Revert view to invoker semantics so it respects RLS.
ALTER VIEW public.vendor_profiles_public SET (security_invoker = true);

-- Revoke direct column access on the base table from anon/authenticated,
-- then grant SELECT only on the safe marketing columns. Sensitive columns
-- (phone, email, business_address) are only reachable by the owner or
-- via server-side (service_role) code.
REVOKE SELECT ON public.vendor_profiles FROM anon, authenticated;

GRANT SELECT
  (id, user_id, business_name, business_category, business_description,
   website, logo_url, city, state, travel_radius, mobile_service,
   virtual_services, years_in_business, starting_price, business_hours,
   social_links, portfolio_urls, onboarding_completed, created_at, updated_at)
  ON public.vendor_profiles TO anon, authenticated;

-- Restore a limited row-level SELECT policy so the public view returns rows
-- of completed listings, but only the safe columns granted above are readable.
DROP POLICY IF EXISTS "Vendor profiles: public marketing read" ON public.vendor_profiles;
CREATE POLICY "Vendor profiles: public marketing read"
  ON public.vendor_profiles
  FOR SELECT
  TO anon, authenticated
  USING (onboarding_completed = true);
