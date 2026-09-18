CREATE TABLE IF NOT EXISTS public.subscription_admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_subscription_id text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  user_id text NOT NULL,
  user_email text,
  plan_name text NOT NULL,
  stripe_customer_id text,
  event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_admin_alerts_subscription
  ON public.subscription_admin_alerts (stripe_subscription_id, environment);

CREATE INDEX IF NOT EXISTS subscription_admin_alerts_open_created
  ON public.subscription_admin_alerts (created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.subscription_admin_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_admin_alerts FROM anon, authenticated;
GRANT ALL ON public.subscription_admin_alerts TO service_role;