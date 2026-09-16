-- Packages can optionally be associated with one service on a multi-service
-- vendor profile. Existing packages remain uncategorized for compatibility.
ALTER TABLE public.vendor_packages
  ADD COLUMN IF NOT EXISTS service_category TEXT NULL;

CREATE INDEX IF NOT EXISTS vendor_packages_service_category_idx
  ON public.vendor_packages (vendor_id, service_category);