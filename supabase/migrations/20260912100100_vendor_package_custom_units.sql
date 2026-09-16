ALTER TABLE public.vendor_packages
  ADD COLUMN IF NOT EXISTS price_unit TEXT;

ALTER TABLE public.vendor_packages
  DROP CONSTRAINT IF EXISTS vendor_packages_price_basis_check;

ALTER TABLE public.vendor_packages
  ADD CONSTRAINT vendor_packages_price_basis_check
  CHECK (
    price_basis IS NULL OR
    price_basis IN ('flat_rate', 'per_person', 'per_hour', 'per_event', 'per_item', 'custom_unit', 'custom_quote')
  );