-- Stripe Connect accounts are environment-specific. Keep sandbox and live
-- accounts separate so a test seller can never receive a production charge.
CREATE TABLE IF NOT EXISTS public.stripe_connect_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  stripe_account_id text NOT NULL,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  currently_due text[] NOT NULL DEFAULT '{}',
  disabled_reason text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, environment),
  UNIQUE (stripe_account_id, environment)
);

CREATE INDEX IF NOT EXISTS idx_stripe_connect_accounts_user
  ON public.stripe_connect_accounts(user_id);

GRANT ALL ON public.stripe_connect_accounts TO service_role;
ALTER TABLE public.stripe_connect_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Connect account status"
  ON public.stripe_connect_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_stripe_connect_accounts_updated_at
  BEFORE UPDATE ON public.stripe_connect_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();