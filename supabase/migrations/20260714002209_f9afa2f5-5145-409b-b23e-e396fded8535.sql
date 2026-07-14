-- has_active_subscription: safe as invoker — RLS on subscriptions already
-- restricts each user to their own rows, which is exactly the intended scope.
CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live'::text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND (
        (status IN ('active', 'trialing', 'past_due') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;

-- is_booking_party: safe as invoker — vendor_bookings RLS already only
-- surfaces rows to the planner or vendor tied to the booking.
CREATE OR REPLACE FUNCTION public.is_booking_party(_booking_id uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_bookings b
    LEFT JOIN public.vendor_profiles vp ON vp.id = b.vendor_id
    WHERE b.id = _booking_id
      AND (b.planner_id = _user OR vp.user_id = _user)
  );
$$;
