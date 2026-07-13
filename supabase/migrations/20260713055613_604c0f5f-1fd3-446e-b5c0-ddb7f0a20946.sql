
-- 1) Fix broken INSERT policy on event_files
DROP POLICY IF EXISTS "Members can upload files" ON public.event_files;
CREATE POLICY "Members can upload files" ON public.event_files
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_files.event_id AND e.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_members m WHERE m.event_id = event_files.event_id AND m.user_id = auth.uid())
  )
);

-- 2) Vendor profiles: remove broad discoverability policy so contact fields are owner-only.
--    Expose a curated view with only safe marketing columns for discovery.
DROP POLICY IF EXISTS "Vendor profiles: discoverable when onboarded" ON public.vendor_profiles;

-- Also allow event owners to read vendor contact info when the vendor is a member of their event
CREATE POLICY "Vendor profiles: event owner read for their vendors"
ON public.vendor_profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.event_members m
    JOIN public.events e ON e.id = m.event_id
    WHERE m.user_id = vendor_profiles.user_id AND e.owner_id = auth.uid()
  )
);

-- Public marketing view — no email, phone, or business_address
CREATE OR REPLACE VIEW public.vendor_profiles_public AS
SELECT
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
FROM public.vendor_profiles
WHERE onboarding_completed = true;

GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;

-- 3) Lock down SECURITY DEFINER seed/wipe functions to service_role only
REVOKE ALL ON FUNCTION public.seed_test_data(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wipe_test_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_test_data(uuid, uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.wipe_test_data() TO service_role;
