-- Let vendors decide which direct contact fields appear on their public listing.
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS contact_visibility JSONB NOT NULL DEFAULT
    '{"phone":"private","email":"private","website":"public"}'::jsonb;

UPDATE public.vendor_profiles
SET contact_visibility = '{"phone":"private","email":"private","website":"public"}'::jsonb
WHERE contact_visibility IS NULL;

DROP VIEW IF EXISTS public.vendor_profiles_public;
CREATE VIEW public.vendor_profiles_public
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  business_name,
  business_category,
  business_categories,
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
WHERE onboarding_completed = true;

GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;