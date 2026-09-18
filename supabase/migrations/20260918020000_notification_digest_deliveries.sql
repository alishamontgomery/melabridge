CREATE TABLE IF NOT EXISTS public.notification_digest_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  period_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category, period_key)
);

GRANT ALL ON public.notification_digest_deliveries TO service_role;
ALTER TABLE public.notification_digest_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages notification digest deliveries"
  ON public.notification_digest_deliveries FOR ALL TO service_role
  USING (true) WITH CHECK (true);