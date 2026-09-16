-- Add package-specific photo URLs and permit vendors to manage their package images.
ALTER TABLE public.vendor_packages
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.vendor_packages
  DROP CONSTRAINT IF EXISTS vendor_packages_photos_max_three;
ALTER TABLE public.vendor_packages
  ADD CONSTRAINT vendor_packages_photos_max_three
  CHECK (cardinality(photos) <= 3);

CREATE OR REPLACE FUNCTION public.validate_vendor_package_photos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  photo_url text;
  expected_prefix text;
BEGIN
  expected_prefix := 'https://fawkzsyuiduzjnlaxssd.supabase.co/storage/v1/object/public/vendor-assets/package-photos/'
    || NEW.vendor_id::text || '/' || NEW.id::text || '/';
  FOREACH photo_url IN ARRAY NEW.photos LOOP
    IF photo_url NOT LIKE expected_prefix || '%' THEN
      RAISE EXCEPTION 'Package photos must belong to this package';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_vendor_package_photos_trigger ON public.vendor_packages;
CREATE TRIGGER validate_vendor_package_photos_trigger
  BEFORE INSERT OR UPDATE OF photos, vendor_id ON public.vendor_packages
  FOR EACH ROW EXECUTE FUNCTION public.validate_vendor_package_photos();

CREATE TABLE IF NOT EXISTS public.package_photo_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  package_id uuid,
  storage_path text NOT NULL,
  photo_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, storage_path)
);

ALTER TABLE public.package_photo_cleanup_jobs
  DROP CONSTRAINT IF EXISTS package_photo_cleanup_path_matches_vendor;
ALTER TABLE public.package_photo_cleanup_jobs
  ADD CONSTRAINT package_photo_cleanup_path_matches_vendor
  CHECK (storage_path LIKE 'package-photos/' || vendor_id::text || '/%');
ALTER TABLE public.package_photo_cleanup_jobs
  DROP CONSTRAINT IF EXISTS package_photo_cleanup_url_matches_vendor;
ALTER TABLE public.package_photo_cleanup_jobs
  ADD CONSTRAINT package_photo_cleanup_url_matches_vendor
  CHECK (
    photo_url LIKE 'https://fawkzsyuiduzjnlaxssd.supabase.co/storage/v1/object/public/vendor-assets/package-photos/'
      || vendor_id::text || '/%'
  );

ALTER TABLE public.package_photo_cleanup_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "package photo cleanup owner" ON public.package_photo_cleanup_jobs;
CREATE POLICY "package photo cleanup owner"
  ON public.package_photo_cleanup_jobs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vendor
      WHERE vendor.id = package_photo_cleanup_jobs.vendor_id
        AND vendor.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vendor
      WHERE vendor.id = package_photo_cleanup_jobs.vendor_id
        AND vendor.user_id = auth.uid()
    )
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_photo_cleanup_jobs TO authenticated;

DROP POLICY IF EXISTS "vendor-assets: package photo upload" ON storage.objects;
CREATE POLICY "vendor-assets: package photo upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(name))[1] = 'package-photos'
    AND EXISTS (
      SELECT 1
      FROM public.vendor_packages package
      JOIN public.vendor_profiles vendor ON vendor.id = package.vendor_id
      WHERE vendor.user_id = auth.uid()
        AND vendor.id::text = (storage.foldername(name))[2]
        AND package.id::text = (storage.foldername(name))[3]
    )
  );

DROP POLICY IF EXISTS "vendor-assets: package photo update" ON storage.objects;
CREATE POLICY "vendor-assets: package photo update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(name))[1] = 'package-photos'
    AND EXISTS (
      SELECT 1
      FROM public.vendor_packages package
      JOIN public.vendor_profiles vendor ON vendor.id = package.vendor_id
      WHERE vendor.user_id = auth.uid()
        AND vendor.id::text = (storage.foldername(name))[2]
        AND package.id::text = (storage.foldername(name))[3]
    )
  )
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(name))[1] = 'package-photos'
    AND EXISTS (
      SELECT 1
      FROM public.vendor_packages package
      JOIN public.vendor_profiles vendor ON vendor.id = package.vendor_id
      WHERE vendor.user_id = auth.uid()
        AND vendor.id::text = (storage.foldername(name))[2]
        AND package.id::text = (storage.foldername(name))[3]
    )
  );

DROP POLICY IF EXISTS "vendor-assets: package photo delete" ON storage.objects;
CREATE POLICY "vendor-assets: package photo delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(name))[1] = 'package-photos'
    AND (
      EXISTS (
        SELECT 1
        FROM public.vendor_packages package
        JOIN public.vendor_profiles vendor ON vendor.id = package.vendor_id
        WHERE vendor.user_id = auth.uid()
          AND vendor.id::text = (storage.foldername(name))[2]
          AND package.id::text = (storage.foldername(name))[3]
      )
      OR EXISTS (
        SELECT 1
        FROM public.package_photo_cleanup_jobs job
        JOIN public.vendor_profiles vendor ON vendor.id = job.vendor_id
        WHERE vendor.user_id = auth.uid()
          AND job.storage_path = name
          AND job.vendor_id::text = (storage.foldername(name))[2]
      )
    )
  );