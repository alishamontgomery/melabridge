-- Correct pattern: keep vendor_profiles fully private from anon; expose only
-- the curated projection via the view (view runs as owner = postgres).

DROP POLICY IF EXISTS "Vendor profiles: public read onboarded" ON public.vendor_profiles;

REVOKE SELECT ON public.vendor_profiles FROM anon;
REVOKE SELECT (
  id, user_id, business_name, business_category, business_description,
  website, logo_url, city, state, travel_radius, mobile_service,
  virtual_services, years_in_business, starting_price, business_hours,
  social_links, portfolio_urls, onboarding_completed, created_at, updated_at
) ON public.vendor_profiles FROM anon;

-- Run the public view as its owner so it can read the curated columns without
-- needing an anon policy on the base table. security_barrier prevents
-- predicate pushdown that could leak filtered rows via side channels.
ALTER VIEW public.vendor_profiles_public SET (security_invoker = off, security_barrier = on);

-- Only the view is reachable by anon / authenticated public callers.
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;