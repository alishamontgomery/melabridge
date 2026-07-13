
-- 1. event_files table
CREATE TABLE public.event_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'other',
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX event_files_event_id_idx ON public.event_files(event_id);
CREATE INDEX event_files_uploaded_by_idx ON public.event_files(uploaded_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_files TO authenticated;
GRANT ALL ON public.event_files TO service_role;

ALTER TABLE public.event_files ENABLE ROW LEVEL SECURITY;

-- Members of the event can see files
CREATE POLICY "Event members can view files"
  ON public.event_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_files.event_id AND e.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.event_members m
      WHERE m.event_id = event_files.event_id AND m.user_id = auth.uid()
    )
  );

-- Uploader (must be a member) can insert
CREATE POLICY "Members can upload files"
  ON public.event_files FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.event_members m WHERE m.event_id = event_id AND m.user_id = auth.uid())
    )
  );

-- Uploader can update own metadata
CREATE POLICY "Uploader can update own files"
  ON public.event_files FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

-- Uploader or event owner can delete
CREATE POLICY "Uploader or event owner can delete files"
  ON public.event_files FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_files.event_id AND e.owner_id = auth.uid()
    )
  );

CREATE TRIGGER event_files_set_updated_at
  BEFORE UPDATE ON public.event_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Storage policies on bridgevault bucket
-- Objects are stored under `${auth.uid()}/${event_id}/${filename}`
CREATE POLICY "Users can read own bridgevault files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'bridgevault'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload to own bridgevault path"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bridgevault'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own bridgevault files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'bridgevault'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own bridgevault files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bridgevault'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
