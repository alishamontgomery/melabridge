-- vendor_packages: structured package offerings stored against a vendor profile
-- Vendors create/edit/reorder their own packages; anyone can read them for the marketplace.

CREATE TABLE IF NOT EXISTS public.vendor_packages (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id   UUID        NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT '',
  price_type  TEXT        NOT NULL DEFAULT 'fixed'
              CHECK (price_type IN ('fixed', 'starting_at', 'contact')),
  price_cents INTEGER,                         -- NULL when price_type = 'contact'
  description TEXT        NOT NULL DEFAULT '',
  inclusions  TEXT[]      NOT NULL DEFAULT '{}',
  duration    TEXT        NOT NULL DEFAULT '',
  add_ons     TEXT[]      NOT NULL DEFAULT '{}',
  is_featured BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_packages ENABLE ROW LEVEL SECURITY;

-- Vendors can manage their own packages
CREATE POLICY "vendor_packages_owner_all" ON public.vendor_packages
  FOR ALL TO authenticated
  USING (
    vendor_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    vendor_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid())
  );

-- Anyone (anon + authenticated) can read packages for marketplace display
CREATE POLICY "vendor_packages_public_read" ON public.vendor_packages
  FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT                              ON public.vendor_packages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE      ON public.vendor_packages TO authenticated;
GRANT ALL                                 ON public.vendor_packages TO service_role;

-- Index for fast vendor lookups
CREATE INDEX IF NOT EXISTS vendor_packages_vendor_id_sort
  ON public.vendor_packages (vendor_id, sort_order, created_at);
