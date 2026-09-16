-- Create the vendor-assets storage bucket (public reads, authenticated uploads)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-assets',
  'vendor-assets',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

-- Public read: anyone can view logos (needed for public vendor profiles)
DROP POLICY IF EXISTS "vendor-assets: public read" ON storage.objects;
CREATE POLICY "vendor-assets: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-assets');

-- Authenticated upload: vendors can upload only to their own folder
DROP POLICY IF EXISTS "vendor-assets: authenticated upload" ON storage.objects;
CREATE POLICY "vendor-assets: authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND name LIKE 'logos/' || auth.uid()::text || '/%'
  );

-- Authenticated update: vendors can overwrite their own files (upsert:true)
DROP POLICY IF EXISTS "vendor-assets: authenticated update" ON storage.objects;
CREATE POLICY "vendor-assets: authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND name LIKE 'logos/' || auth.uid()::text || '/%'
  );

-- Authenticated delete: vendors can remove their own files
DROP POLICY IF EXISTS "vendor-assets: authenticated delete" ON storage.objects;
CREATE POLICY "vendor-assets: authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND name LIKE 'logos/' || auth.uid()::text || '/%'
  );
