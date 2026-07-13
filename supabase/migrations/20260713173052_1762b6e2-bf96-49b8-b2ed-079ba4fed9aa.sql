
DROP VIEW IF EXISTS public.vendor_profiles_public;
CREATE VIEW public.vendor_profiles_public
WITH (security_invoker = true)
AS
SELECT id, user_id, business_name, business_category, business_description,
       website, logo_url, city, state, travel_radius, mobile_service,
       virtual_services, years_in_business, starting_price, business_hours,
       social_links, portfolio_urls, onboarding_completed, created_at, updated_at
FROM public.vendor_profiles
WHERE onboarding_completed = true;

GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;
