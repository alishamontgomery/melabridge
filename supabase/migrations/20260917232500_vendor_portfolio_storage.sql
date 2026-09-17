-- Portfolio objects use the authenticated Clerk subject:
-- portfolio/<clerk-user-id>/<timestamp>.<ext>
--
-- Keep this prefix separate from general photos so the application can enforce
-- the portfolio-specific 10-image limit while Storage remains owner-scoped.

DROP POLICY IF EXISTS "vendor-assets: portfolio upload" ON storage.objects;
CREATE POLICY "vendor-assets: portfolio upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'portfolio'
    AND (storage.foldername(objects.name))[2] = (auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS "vendor-assets: portfolio update" ON storage.objects;
CREATE POLICY "vendor-assets: portfolio update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'portfolio'
    AND (storage.foldername(objects.name))[2] = (auth.jwt() ->> 'sub')
  )
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'portfolio'
    AND (storage.foldername(objects.name))[2] = (auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS "vendor-assets: portfolio delete" ON storage.objects;
CREATE POLICY "vendor-assets: portfolio delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(objects.name))[1] = 'portfolio'
    AND (storage.foldername(objects.name))[2] = (auth.jwt() ->> 'sub')
  );