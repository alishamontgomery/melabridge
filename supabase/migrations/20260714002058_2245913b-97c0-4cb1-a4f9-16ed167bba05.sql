-- 1) vendor_booking_settings: restrict SELECT to the vendor themselves or a planner
--    with an actual booking relationship. Replaces USING (true).
DROP POLICY IF EXISTS "planners can read vendor settings" ON public.vendor_booking_settings;

CREATE POLICY "vendor or related planner can read settings"
ON public.vendor_booking_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.id = vendor_booking_settings.vendor_id
      AND vp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.vendor_bookings vb
    WHERE vb.vendor_id = vendor_booking_settings.vendor_id
      AND vb.planner_id = auth.uid()
  )
);

-- 2) vendor_profiles: stop exposing email/phone to anonymous visitors.
--    The public directory already reads from the sanitized view
--    public.vendor_profiles_public (which excludes email/phone). Switch the
--    view to run with owner privileges so anon can keep using it, then close
--    anon access to the base table entirely.
DROP POLICY IF EXISTS "Vendor profiles: public read of completed listings" ON public.vendor_profiles;

CREATE POLICY "Vendor profiles: authenticated read of completed listings"
ON public.vendor_profiles
FOR SELECT
TO authenticated
USING (onboarding_completed = true);

ALTER VIEW public.vendor_profiles_public SET (security_invoker = false);
REVOKE SELECT ON public.vendor_profiles FROM anon;
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;

-- 3) SECURITY DEFINER functions should not be executable by end-users.
--    Triggers still run under the table owner regardless of EXECUTE grants,
--    and privileged maintenance helpers must be service_role only.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_role_from_profile()                           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_message_participants()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_generate_booking_invoice()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_prevent_calendar_overlap()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_apply_confirmation_rule()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_test_data(uuid, uuid, uuid, uuid, uuid)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wipe_test_data()                                   FROM PUBLIC, anon, authenticated;

-- Safe read-only helpers may remain callable by signed-in users:
--   has_active_subscription(uuid, text) and is_booking_party(uuid, uuid)
-- are used from app code paths; leave their default grants intact.
