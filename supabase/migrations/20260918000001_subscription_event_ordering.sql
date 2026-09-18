ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_event_created_at bigint,
  ADD COLUMN IF NOT EXISTS stripe_event_priority integer,
  ADD COLUMN IF NOT EXISTS stripe_event_id text;

CREATE OR REPLACE FUNCTION public.sync_subscription_stripe_event(
  _user_id uuid,
  _stripe_subscription_id text,
  _stripe_customer_id text,
  _product_id text,
  _price_id text,
  _status text,
  _current_period_start timestamptz,
  _current_period_end timestamptz,
  _cancel_at_period_end boolean,
  _environment text,
  _event_created_at bigint,
  _event_priority integer,
  _event_id text,
  _user_email text,
  _plan_name text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _affected integer;
BEGIN
  INSERT INTO public.subscriptions (
    user_id, stripe_subscription_id, stripe_customer_id, product_id, price_id,
    status, current_period_start, current_period_end, cancel_at_period_end,
    environment, stripe_event_created_at, stripe_event_priority, stripe_event_id, updated_at
  ) VALUES (
    _user_id, _stripe_subscription_id, _stripe_customer_id, _product_id, _price_id,
    _status, _current_period_start, _current_period_end, _cancel_at_period_end,
    _environment, _event_created_at, _event_priority, _event_id, now()
  )
  ON CONFLICT (stripe_subscription_id) DO UPDATE SET
    user_id = EXCLUDED.user_id, stripe_customer_id = EXCLUDED.stripe_customer_id,
    product_id = EXCLUDED.product_id, price_id = EXCLUDED.price_id, status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end, environment = EXCLUDED.environment,
    stripe_event_created_at = EXCLUDED.stripe_event_created_at,
    stripe_event_priority = EXCLUDED.stripe_event_priority,
    stripe_event_id = EXCLUDED.stripe_event_id, updated_at = now()
  WHERE subscriptions.stripe_event_created_at IS NULL
     OR (subscriptions.stripe_event_created_at, COALESCE(subscriptions.stripe_event_priority, 0), COALESCE(subscriptions.stripe_event_id, ''))
        <= (EXCLUDED.stripe_event_created_at, EXCLUDED.stripe_event_priority, EXCLUDED.stripe_event_id);

  GET DIAGNOSTICS _affected = ROW_COUNT;
  IF _affected = 0 THEN RETURN false; END IF;

  IF _status = 'past_due' THEN
    INSERT INTO public.subscription_admin_alerts (
      stripe_subscription_id, environment, user_id, user_email, plan_name,
      stripe_customer_id, event_id
    ) VALUES (
      _stripe_subscription_id, _environment, _user_id::text, _user_email, _plan_name,
      _stripe_customer_id, _event_id
    )
    ON CONFLICT (stripe_subscription_id, environment) DO UPDATE SET
      user_id = EXCLUDED.user_id, user_email = EXCLUDED.user_email,
      plan_name = EXCLUDED.plan_name, stripe_customer_id = EXCLUDED.stripe_customer_id,
      event_id = EXCLUDED.event_id,
      created_at = CASE WHEN subscription_admin_alerts.resolved_at IS NOT NULL THEN now() ELSE subscription_admin_alerts.created_at END,
      resolved_at = NULL;
  ELSE
    UPDATE public.subscription_admin_alerts SET resolved_at = now()
    WHERE stripe_subscription_id = _stripe_subscription_id AND environment = _environment AND resolved_at IS NULL;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_subscription_status_event(
  _stripe_subscription_id text,
  _environment text,
  _status text,
  _event_created_at bigint,
  _event_priority integer,
  _event_id text,
  _user_email text DEFAULT NULL,
  _plan_name text DEFAULT 'Unknown plan'
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _subscription public.subscriptions%ROWTYPE;
BEGIN
  UPDATE public.subscriptions SET
    status = _status, stripe_event_created_at = _event_created_at,
    stripe_event_priority = _event_priority, stripe_event_id = _event_id, updated_at = now()
  WHERE stripe_subscription_id = _stripe_subscription_id AND environment = _environment
    AND (
      stripe_event_created_at IS NULL
      OR (stripe_event_created_at, COALESCE(stripe_event_priority, 0), COALESCE(stripe_event_id, ''))
         <= (_event_created_at, _event_priority, _event_id)
    )
  RETURNING * INTO _subscription;
  IF NOT FOUND THEN RETURN false; END IF;

  IF _status = 'past_due' THEN
    INSERT INTO public.subscription_admin_alerts (
      stripe_subscription_id, environment, user_id, user_email, plan_name,
      stripe_customer_id, event_id
    ) VALUES (
      _stripe_subscription_id, _environment, _subscription.user_id::text, _user_email,
      _plan_name, _subscription.stripe_customer_id, _event_id
    )
    ON CONFLICT (stripe_subscription_id, environment) DO UPDATE SET
      user_id = EXCLUDED.user_id, user_email = EXCLUDED.user_email,
      plan_name = EXCLUDED.plan_name, stripe_customer_id = EXCLUDED.stripe_customer_id,
      event_id = EXCLUDED.event_id,
      created_at = CASE WHEN subscription_admin_alerts.resolved_at IS NOT NULL THEN now() ELSE subscription_admin_alerts.created_at END,
      resolved_at = NULL;
  ELSE
    UPDATE public.subscription_admin_alerts SET resolved_at = now()
    WHERE stripe_subscription_id = _stripe_subscription_id AND environment = _environment AND resolved_at IS NULL;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_subscription_stripe_event(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,text,bigint,integer,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_subscription_status_event(text,text,text,bigint,integer,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_subscription_stripe_event(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,text,bigint,integer,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_subscription_status_event(text,text,text,bigint,integer,text,text,text) TO service_role;