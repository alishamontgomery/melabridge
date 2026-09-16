-- Give vendors an explicit way to keep a package in their workspace without
-- showing it on the public listing. The pricing basis is optional because not
-- every service is priced per person, hour, or item.
ALTER TABLE public.vendor_packages
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS price_basis TEXT;

ALTER TABLE public.vendor_packages
  DROP CONSTRAINT IF EXISTS vendor_packages_price_basis_check;

ALTER TABLE public.vendor_packages
  ADD CONSTRAINT vendor_packages_price_basis_check
  CHECK (
    price_basis IS NULL OR
    price_basis IN ('flat_rate', 'per_person', 'per_hour', 'per_event', 'per_item', 'custom_quote')
  );

CREATE INDEX IF NOT EXISTS vendor_packages_public_lookup
  ON public.vendor_packages (vendor_id, is_visible, is_featured, sort_order);