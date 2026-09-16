-- Category-specific package fields are only valid for the vendor's current
-- primary business category. Clear them whenever that category changes,
-- regardless of which application path performs the profile update.
CREATE OR REPLACE FUNCTION public.clear_vendor_package_category_fields_on_primary_category_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.vendor_packages
  SET
    category_fields = '{}'::jsonb,
    updated_at = now()
  WHERE vendor_id = NEW.id
    -- Explicitly categorized packages keep the same effective category even
    -- when the vendor changes their primary category.
    AND service_category IS NULL
    AND category_fields IS DISTINCT FROM '{}'::jsonb;

  RETURN NEW;
END;
$$;

REVOKE ALL
  ON FUNCTION public.clear_vendor_package_category_fields_on_primary_category_change()
  FROM PUBLIC;

DROP TRIGGER IF EXISTS clear_package_specs_on_primary_category_change
  ON public.vendor_profiles;

CREATE TRIGGER clear_package_specs_on_primary_category_change
AFTER UPDATE OF business_category ON public.vendor_profiles
FOR EACH ROW
WHEN (OLD.business_category IS DISTINCT FROM NEW.business_category)
EXECUTE FUNCTION public.clear_vendor_package_category_fields_on_primary_category_change();