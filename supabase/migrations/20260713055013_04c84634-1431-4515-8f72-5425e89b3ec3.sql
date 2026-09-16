-- Seed admin role for dev user if they exist in this project.
-- Wrapped in a guard so this is safe on a fresh database (user won't exist on new projects).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '62b67a04-8069-4c48-a848-38c43cf40ae1') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES ('62b67a04-8069-4c48-a848-38c43cf40ae1', 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
