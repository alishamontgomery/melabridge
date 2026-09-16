-- Pre-production RLS hardening.
-- Keeps public marketplace reads narrow and prevents cross-event file reassignment.

-- An uploader may edit descriptive metadata, but a file must remain attached to
-- the event and storage object it was created for.
DROP POLICY IF EXISTS "Uploader can update own files" ON public.event_files;
CREATE POLICY "Uploader can update own files"
  ON public.event_files
  FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.id = event_files.event_id
          AND e.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.event_members m
        WHERE m.event_id = event_files.event_id
          AND m.user_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_event_file_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
     OR NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
    RAISE EXCEPTION 'File ownership, event, and storage path cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_event_file_identity_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_event_file_identity_change
  ON public.event_files;
CREATE TRIGGER prevent_event_file_identity_change
  BEFORE UPDATE ON public.event_files
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_event_file_identity_change();

-- Defensive re-application of the intended vendor-settings boundary. Vendors
-- can read their own settings; planners can read settings only after a lead
-- relationship exists.
DROP POLICY IF EXISTS "planners can read vendor settings"
  ON public.vendor_booking_settings;
DROP POLICY IF EXISTS "vendor or related planner can read settings"
  ON public.vendor_booking_settings;
CREATE POLICY "vendor or related planner can read settings"
  ON public.vendor_booking_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles vp
      WHERE vp.id = vendor_booking_settings.vendor_id
        AND vp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.vendor_bookings vb
      WHERE vb.vendor_id = vendor_booking_settings.vendor_id
        AND vb.planner_id = auth.uid()
    )
  );

-- Public packages must belong to a profile already exposed by the curated
-- marketplace view. Owners retain access to drafts through the owner policy.
DROP POLICY IF EXISTS "vendor_packages_public_read"
  ON public.vendor_packages;
CREATE POLICY "vendor_packages_public_read"
  ON public.vendor_packages
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_profiles_public vp
      WHERE vp.id = vendor_packages.vendor_id
    )
  );