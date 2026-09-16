-- Let any event-related business describe and be found by the services it
-- actually offers, even when no predefined category is a good fit.
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS custom_service_types TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS vendor_profiles_custom_service_types_gin_idx
  ON public.vendor_profiles USING gin (custom_service_types);

DROP VIEW IF EXISTS public.vendor_profiles_public;
CREATE VIEW public.vendor_profiles_public
WITH (security_invoker = false)
AS
SELECT
  id,
  business_name,
  business_category,
  business_categories,
  custom_service_types,
  business_description,
  CASE WHEN contact_visibility->>'phone' = 'public' THEN phone ELSE NULL END AS phone,
  CASE WHEN contact_visibility->>'email' = 'public' THEN email ELSE NULL END AS email,
  CASE WHEN contact_visibility->>'website' = 'public' THEN website ELSE NULL END AS website,
  logo_url,
  city,
  state,
  zip_code,
  travel_radius,
  mobile_service,
  virtual_services,
  years_in_business,
  starting_price,
  business_hours,
  social_links,
  portfolio_urls,
  vendor_photos,
  faqs,
  onboarding_completed,
  is_verified,
  verified_at,
  verified_by,
  created_at,
  updated_at
FROM public.vendor_profiles
WHERE onboarding_completed = true
  AND COALESCE(is_test_seed, false) = false;

GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;