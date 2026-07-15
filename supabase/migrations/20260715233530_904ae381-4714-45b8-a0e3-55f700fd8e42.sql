
-- 1) vendor_profiles: stop exposing PII (phone, email, business_address) to anon/authenticated.
--    Public marketplace already reads via public.vendor_profiles_public view.
--    Flip the view to security_invoker=false so it can run with owner privileges
--    (bypassing base-table RLS), then drop the base-table public read policy.
ALTER VIEW public.vendor_profiles_public SET (security_invoker = false);
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;
DROP POLICY IF EXISTS "Vendor profiles: public read onboarded" ON public.vendor_profiles;

-- 2) event_members: restrict admin write policies to the authenticated role.
DROP POLICY IF EXISTS "Members: admins can add" ON public.event_members;
CREATE POLICY "Members: admins can add"
  ON public.event_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    app_private.has_event_access(event_id, auth.uid(), 'admin'::event_role)
    AND ((invited_email IS NULL) OR (invited_email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'))
  );

DROP POLICY IF EXISTS "Members: admins can update" ON public.event_members;
CREATE POLICY "Members: admins can update"
  ON public.event_members
  FOR UPDATE
  TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'admin'::event_role))
  WITH CHECK (
    app_private.has_event_access(event_id, auth.uid(), 'admin'::event_role)
    AND ((invited_email IS NULL) OR (invited_email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'))
  );

-- 3) event_runsheet_items: scope every policy to authenticated.
DROP POLICY IF EXISTS "Runsheet: members read"   ON public.event_runsheet_items;
DROP POLICY IF EXISTS "Runsheet: editors insert" ON public.event_runsheet_items;
DROP POLICY IF EXISTS "Runsheet: editors update" ON public.event_runsheet_items;
DROP POLICY IF EXISTS "Runsheet: editors delete" ON public.event_runsheet_items;
CREATE POLICY "Runsheet: members read"   ON public.event_runsheet_items FOR SELECT TO authenticated
  USING (app_private.is_event_member(event_id, auth.uid()));
CREATE POLICY "Runsheet: editors insert" ON public.event_runsheet_items FOR INSERT TO authenticated
  WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "Runsheet: editors update" ON public.event_runsheet_items FOR UPDATE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role))
  WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "Runsheet: editors delete" ON public.event_runsheet_items FOR DELETE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));

-- 4) event_vendor_needs: scope every policy to authenticated.
DROP POLICY IF EXISTS "VendorNeeds: members read"   ON public.event_vendor_needs;
DROP POLICY IF EXISTS "VendorNeeds: editors insert" ON public.event_vendor_needs;
DROP POLICY IF EXISTS "VendorNeeds: editors update" ON public.event_vendor_needs;
DROP POLICY IF EXISTS "VendorNeeds: editors delete" ON public.event_vendor_needs;
CREATE POLICY "VendorNeeds: members read"   ON public.event_vendor_needs FOR SELECT TO authenticated
  USING (app_private.is_event_member(event_id, auth.uid()));
CREATE POLICY "VendorNeeds: editors insert" ON public.event_vendor_needs FOR INSERT TO authenticated
  WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "VendorNeeds: editors update" ON public.event_vendor_needs FOR UPDATE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role))
  WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "VendorNeeds: editors delete" ON public.event_vendor_needs FOR DELETE TO authenticated
  USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));

-- 5) event_shopping_items: scope every policy to authenticated (preserve existing membership checks).
DROP POLICY IF EXISTS "Event members can view shopping items"   ON public.event_shopping_items;
DROP POLICY IF EXISTS "Event members can insert shopping items" ON public.event_shopping_items;
DROP POLICY IF EXISTS "Event members can update shopping items" ON public.event_shopping_items;
DROP POLICY IF EXISTS "Event members can delete shopping items" ON public.event_shopping_items;

CREATE POLICY "Event members can view shopping items"
  ON public.event_shopping_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_shopping_items.event_id
      AND (e.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.event_members m
                    WHERE m.event_id = e.id AND m.user_id = auth.uid()))
  ));

CREATE POLICY "Event members can insert shopping items"
  ON public.event_shopping_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_shopping_items.event_id
      AND (e.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.event_members m
                    WHERE m.event_id = e.id AND m.user_id = auth.uid()))
  ));

CREATE POLICY "Event members can update shopping items"
  ON public.event_shopping_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_shopping_items.event_id
      AND (e.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.event_members m
                    WHERE m.event_id = e.id AND m.user_id = auth.uid()))
  ));

CREATE POLICY "Event members can delete shopping items"
  ON public.event_shopping_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_shopping_items.event_id
      AND (e.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.event_members m
                    WHERE m.event_id = e.id AND m.user_id = auth.uid()))
  ));
