ALTER TABLE public.ticket_orders
  ADD COLUMN IF NOT EXISTS access_token uuid;

UPDATE public.ticket_orders
SET access_token = gen_random_uuid()
WHERE access_token IS NULL;

ALTER TABLE public.ticket_orders
  ALTER COLUMN access_token SET DEFAULT gen_random_uuid(),
  ALTER COLUMN access_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_orders_access_token
  ON public.ticket_orders (access_token);