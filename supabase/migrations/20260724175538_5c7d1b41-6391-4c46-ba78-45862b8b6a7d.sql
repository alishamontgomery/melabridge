-- Follow-up: the previous migration correctly moved the view to security_invoker,
-- but the anon SELECT policy on vendor_profiles then exposed sensitive columns
-- (email, phone, address) via direct table queries. RLS is row-level, not
-- column-level, so we restrict anon access at the GRANT layer instead.

REVOKE SELECT ON public.vendor_profiles FROM anon;

-- Grant anon SELECT only on the columns exposed by public.vendor_profiles_public.
GRANT SELECT (
  id,
  user_id,
  business_name,
  business_category,
  business_description,
  website,
  logo_url,
  city,
  state,
  travel_radius,
  mobile_service,
  virtual_services,
  years_in_business,
  starting_price,
  business_hours,
  social_links,
  portfolio_urls,
  onboarding_completed,
  created_at,
  updated_at
) ON public.vendor_profiles TO anon;

-- Keep the row-level filter: only onboarded vendors are publicly visible.
-- (Policy 'Vendor profiles: public read onboarded' from prior migration stays.)