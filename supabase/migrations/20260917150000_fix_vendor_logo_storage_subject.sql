-- Logo object paths use the authenticated Clerk subject:
-- logos/<clerk-user-id>/<timestamp>.<ext>
--
-- Application tables resolve Clerk subjects to legacy UUIDs through
-- current_app_user_id(), but Storage paths must compare against the raw JWT sub.

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ]
WHERE id = 'vendor-assets';

DROP POLICY IF EXISTS "vendor-assets: authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "vendor-assets: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "vendor-assets: authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can upload vendor-assets" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can update vendor-assets" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can delete vendor-assets" ON storage.objects;

CREATE POLICY "vendor-assets: authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'logos'
    AND (storage.foldername(objects.name))[2] = (auth.jwt() ->> 'sub')
  );

CREATE POLICY "vendor-assets: authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'logos'
    AND (storage.foldername(objects.name))[2] = (auth.jwt() ->> 'sub')
  )
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'logos'
    AND (storage.foldername(objects.name))[2] = (auth.jwt() ->> 'sub')
  );

CREATE POLICY "vendor-assets: authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'logos'
    AND (storage.foldername(objects.name))[2] = (auth.jwt() ->> 'sub')
  );

-- These older dashboard-created policies also covered logos and invoked the
-- UUID bridge for Clerk subjects. Keep their photo coverage without allowing
-- them to conflict with the dedicated logo rules above.
CREATE POLICY "Vendors can upload vendor-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'photos'
    AND (storage.foldername(objects.name))[2] = (auth.jwt() ->> 'sub')
  );

CREATE POLICY "Vendors can update vendor-assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'photos'
    AND (storage.foldername(objects.name))[2] = (auth.jwt() ->> 'sub')
  )
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'photos'
    AND (storage.foldername(objects.name))[2] = (auth.jwt() ->> 'sub')
  );

CREATE POLICY "Vendors can delete vendor-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'photos'
    AND (storage.foldername(objects.name))[2] = (auth.jwt() ->> 'sub')
  );

-- Storage evaluates every policy for the operation. The package-photo rules
-- must therefore avoid auth.uid(), which attempts to cast Clerk subjects to
-- UUID even when the object is not under package-photos/.
ALTER POLICY "vendor-assets: package photo upload"
  ON storage.objects
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'package-photos'
    AND EXISTS (
      SELECT 1
      FROM public.vendor_packages package
      JOIN public.vendor_profiles vendor ON vendor.id = package.vendor_id
      WHERE vendor.user_id = public.current_app_user_id()
        AND vendor.id::text = (storage.foldername(objects.name))[2]
        AND package.id::text = (storage.foldername(objects.name))[3]
    )
  );

ALTER POLICY "vendor-assets: package photo update"
  ON storage.objects
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'package-photos'
    AND EXISTS (
      SELECT 1
      FROM public.vendor_packages package
      JOIN public.vendor_profiles vendor ON vendor.id = package.vendor_id
      WHERE vendor.user_id = public.current_app_user_id()
        AND vendor.id::text = (storage.foldername(objects.name))[2]
        AND package.id::text = (storage.foldername(objects.name))[3]
    )
  )
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'package-photos'
    AND EXISTS (
      SELECT 1
      FROM public.vendor_packages package
      JOIN public.vendor_profiles vendor ON vendor.id = package.vendor_id
      WHERE vendor.user_id = public.current_app_user_id()
        AND vendor.id::text = (storage.foldername(objects.name))[2]
        AND package.id::text = (storage.foldername(objects.name))[3]
    )
  );

ALTER POLICY "vendor-assets: package photo delete"
  ON storage.objects
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'package-photos'
    AND (
      EXISTS (
        SELECT 1
        FROM public.vendor_packages package
        JOIN public.vendor_profiles vendor ON vendor.id = package.vendor_id
        WHERE vendor.user_id = public.current_app_user_id()
          AND vendor.id::text = (storage.foldername(objects.name))[2]
          AND package.id::text = (storage.foldername(objects.name))[3]
      )
      OR EXISTS (
        SELECT 1
        FROM public.package_photo_cleanup_jobs job
        JOIN public.vendor_profiles vendor ON vendor.id = job.vendor_id
        WHERE vendor.user_id = public.current_app_user_id()
          AND job.storage_path = name
          AND job.vendor_id::text = (storage.foldername(objects.name))[2]
      )
    )
  );

-- Event covers predate the Clerk-path convention and intentionally use the
-- bridged application UUID: logos/<owner-uuid>/event-covers/<event-id>/...
DROP POLICY IF EXISTS "vendor-assets: event cover upload" ON storage.objects;
DROP POLICY IF EXISTS "vendor-assets: event cover update" ON storage.objects;
DROP POLICY IF EXISTS "vendor-assets: event cover delete" ON storage.objects;

CREATE POLICY "vendor-assets: event cover upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'logos'
    AND (storage.foldername(objects.name))[2] = public.current_app_user_id()::text
    AND (storage.foldername(objects.name))[3] = 'event-covers'
    AND EXISTS (
      SELECT 1
      FROM public.events event
      WHERE event.id::text = (storage.foldername(objects.name))[4]
        AND event.owner_id = public.current_app_user_id()
    )
  );

CREATE POLICY "vendor-assets: event cover update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'logos'
    AND (storage.foldername(objects.name))[2] = public.current_app_user_id()::text
    AND (storage.foldername(objects.name))[3] = 'event-covers'
    AND EXISTS (
      SELECT 1
      FROM public.events event
      WHERE event.id::text = (storage.foldername(objects.name))[4]
        AND event.owner_id = public.current_app_user_id()
    )
  )
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'logos'
    AND (storage.foldername(objects.name))[2] = public.current_app_user_id()::text
    AND (storage.foldername(objects.name))[3] = 'event-covers'
    AND EXISTS (
      SELECT 1
      FROM public.events event
      WHERE event.id::text = (storage.foldername(objects.name))[4]
        AND event.owner_id = public.current_app_user_id()
    )
  );

CREATE POLICY "vendor-assets: event cover delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'logos'
    AND (storage.foldername(objects.name))[2] = public.current_app_user_id()::text
    AND (storage.foldername(objects.name))[3] = 'event-covers'
    AND EXISTS (
      SELECT 1
      FROM public.events event
      WHERE event.id::text = (storage.foldername(objects.name))[4]
        AND event.owner_id = public.current_app_user_id()
    )
  );
