
-- 1) Vendor profiles: drop broad authenticated SELECT on base table.
-- Public marketplace reads use the vendor_profiles_public view (safe columns only).
DROP POLICY IF EXISTS "Vendor profiles: authenticated read of completed listings" ON public.vendor_profiles;

-- Make the public view run with definer rights so it can read the base table
-- after the broad RLS policy is removed, exposing only safe marketing columns.
ALTER VIEW public.vendor_profiles_public SET (security_invoker = false);

GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;

-- 2) event_members: remove email-existence probe from insert/update policies.
DROP POLICY IF EXISTS "Members: admins can add" ON public.event_members;
DROP POLICY IF EXISTS "Members: admins can update" ON public.event_members;

CREATE POLICY "Members: admins can add"
  ON public.event_members
  FOR INSERT
  WITH CHECK (
    app_private.has_event_access(event_id, auth.uid(), 'admin'::event_role)
    AND (
      invited_email IS NULL
      OR invited_email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
    )
  );

CREATE POLICY "Members: admins can update"
  ON public.event_members
  FOR UPDATE
  USING (app_private.has_event_access(event_id, auth.uid(), 'admin'::event_role))
  WITH CHECK (
    app_private.has_event_access(event_id, auth.uid(), 'admin'::event_role)
    AND (
      invited_email IS NULL
      OR invited_email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
    )
  );
