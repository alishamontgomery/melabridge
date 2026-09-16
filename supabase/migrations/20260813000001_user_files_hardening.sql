-- Harden user_files: add FK, grants, and updated_at trigger.

-- Add FK to auth.users if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_files'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'user_files_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_files
      ADD CONSTRAINT user_files_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_files TO authenticated;
GRANT ALL ON public.user_files TO service_role;

-- updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_user_files_updated_at'
    AND event_object_table = 'user_files'
  ) THEN
    CREATE TRIGGER trg_user_files_updated_at
      BEFORE UPDATE ON public.user_files
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
