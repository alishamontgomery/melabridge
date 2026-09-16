-- Allow one vendor profile to represent multiple services while retaining
-- business_category as the stable primary/legacy category.
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS business_categories TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.vendor_profiles
SET business_categories = ARRAY[business_category]
WHERE COALESCE(cardinality(business_categories), 0) = 0
  AND business_category IS NOT NULL
  AND btrim(business_category) <> '';

CREATE INDEX IF NOT EXISTS vendor_profiles_business_categories_gin_idx
  ON public.vendor_profiles USING gin (business_categories);

DROP VIEW IF EXISTS public.vendor_profiles_public;
CREATE VIEW public.vendor_profiles_public
WITH (security_invoker = true)
AS
SELECT
  id, user_id, business_name, business_category, business_categories,
  business_description, phone, email, website, logo_url, city, state,
  zip_code, business_address, travel_radius, mobile_service,
  virtual_services, years_in_business, starting_price, business_hours,
  social_links, portfolio_urls, vendor_photos, faqs, onboarding_completed,
  is_verified, verified_at, verified_by, created_at, updated_at
FROM public.vendor_profiles
WHERE onboarding_completed = true;

GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;