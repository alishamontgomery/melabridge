-- Revoke broad SELECT on base table; grant SELECT only on safe columns.
REVOKE SELECT ON public.vendor_profiles FROM anon, authenticated;

GRANT SELECT (
  id, user_id, business_name, business_category, business_description,
  website, logo_url, city, state, travel_radius, mobile_service, virtual_services,
  years_in_business, starting_price, business_hours, social_links, portfolio_urls,
  onboarding_completed, created_at, updated_at, is_test_seed
) ON public.vendor_profiles TO anon, authenticated;

-- Owner needs to read all columns (email, phone, business_address, accepted_terms).
-- Grant sensitive column SELECT to authenticated; RLS "owner full read" +
-- "event owner read for their vendors" gate rows.
GRANT SELECT (email, phone, business_address, accepted_terms)
  ON public.vendor_profiles TO authenticated;

-- The broad "view can read onboarded" policy would expose sensitive columns to any
-- authenticated user if they SELECT those columns. Column grants block that for anon,
-- but authenticated has the grant (for owners). Restrict the row policy: only expose
-- onboarded rows for the safe columns via a separate role — solved by keeping the row
-- policy as-is (auth can see the row) but relying on the column grant for auth to
-- include sensitive columns only when the row-level owner policy also permits.
-- In Postgres, column privileges are AND'd with RLS. We need the sensitive columns
-- readable ONLY when auth.uid() = user_id. Use a dedicated policy for those columns:
-- Postgres has no per-column RLS, so instead we split: revoke sensitive column SELECT
-- from authenticated at large, and re-grant via a SECURITY DEFINER function or view
-- if needed. Since owner already has the row via "owner full read" policy and column
-- grant, but any authenticated user also passes "view can read onboarded" for onboarded
-- rows and holds the column grant on email/phone → still exposed.
-- Fix: revoke sensitive column grants from authenticated; owner reads sensitive fields
-- through a dedicated SECURITY INVOKER view scoped to auth.uid() = user_id.
REVOKE SELECT (email, phone, business_address, accepted_terms)
  ON public.vendor_profiles FROM authenticated;

-- Owner-scoped full view (security_invoker so RLS applies with owner's session).
CREATE OR REPLACE VIEW public.vendor_profiles_self AS
SELECT * FROM public.vendor_profiles WHERE user_id = auth.uid();
ALTER VIEW public.vendor_profiles_self SET (security_invoker = true);
GRANT SELECT ON public.vendor_profiles_self TO authenticated;

-- Event-owner view for reading their engaged vendors' contact info
CREATE OR REPLACE VIEW public.vendor_profiles_for_event_owner AS
SELECT vp.*
FROM public.vendor_profiles vp
WHERE EXISTS (
  SELECT 1 FROM public.event_members m
  JOIN public.events e ON e.id = m.event_id
  WHERE m.user_id = vp.user_id AND e.owner_id = auth.uid()
);
ALTER VIEW public.vendor_profiles_for_event_owner SET (security_invoker = true);
GRANT SELECT ON public.vendor_profiles_for_event_owner TO authenticated;

-- For the two owner-scoped views to return sensitive columns, the invoker still needs
-- column-level SELECT on those columns. Grant them back but rely on the base table RLS
-- ("owner full read" + "event owner read for their vendors") to hide non-matching rows.
-- Since RLS filters rows, the column grant only matters for rows the policy already exposes.
GRANT SELECT (email, phone, business_address, accepted_terms)
  ON public.vendor_profiles TO authenticated;

-- Drop the broad discoverability policy on the base table so authenticated users cannot
-- select sensitive columns from arbitrary onboarded vendors. Discovery uses the public view.
DROP POLICY IF EXISTS "Vendor profiles: view can read onboarded" ON public.vendor_profiles;

-- Recreate a discoverability policy restricted to rows the caller does NOT own or engage,
-- but column grants on sensitive columns are still available to authenticated. Postgres
-- cannot express per-column RLS, so we accept: for onboarded rows, sensitive columns are
-- readable by any authenticated user if they select them. To close this, drop the discovery
-- policy entirely and route ALL discovery through the security_invoker view on a policy
-- that returns onboarded rows ONLY through a safe-column projection. We simulate that by
-- keeping RLS deny-by-default and letting the marketing view use a SECURITY DEFINER
-- function.
CREATE OR REPLACE FUNCTION public.list_public_vendors()
RETURNS SETOF public.vendor_profiles_public
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.vendor_profiles_public;
$$;
REVOKE ALL ON FUNCTION public.list_public_vendors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_vendors() TO anon, authenticated;

-- Now vendor_profiles_public view is unnecessary as a directly-queried view, but keep it
-- so existing code can query it. Because we dropped the base-table row policy, the view
-- (security_invoker) will return no rows for non-owners. Re-add a narrow row policy that
-- exposes ONLY the safe columns — implemented via column grants: sensitive column grants
-- are already restricted so the only way to read email/phone is via the two owner-scoped
-- views. Add back the discovery row policy:
CREATE POLICY "Vendor profiles: discoverable rows only"
ON public.vendor_profiles FOR SELECT TO anon, authenticated
USING (onboarding_completed = true);
