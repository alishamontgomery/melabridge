
-- Fix event creation: SELECT policy on events called is_event_member() which re-queries public.events.
-- On INSERT ... RETURNING the just-inserted row wasn't visible in that sub-select's snapshot,
-- so PostgREST return=representation always failed with 42501.
-- Short-circuit on owner_id = auth.uid() so owners can always read their own rows without a lookup.

DROP POLICY IF EXISTS "Events: members can view" ON public.events;
CREATE POLICY "Events: members can view"
ON public.events
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR app_private.is_event_member(id, auth.uid())
);

DROP POLICY IF EXISTS "Events: editors and above can update" ON public.events;
CREATE POLICY "Events: editors and above can update"
ON public.events
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR app_private.has_event_access(id, auth.uid(), 'editor'::event_role)
)
WITH CHECK (
  owner_id = auth.uid()
  OR app_private.has_event_access(id, auth.uid(), 'editor'::event_role)
);

-- Cleanup the QA probe rows created while diagnosing.
DELETE FROM public.events WHERE name IN ('probe-noReturn','probe-returnMin','MinTest','sql-rls-test');
