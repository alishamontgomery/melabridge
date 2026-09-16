-- Fix the profile-role trigger for deployments where profiles.account_type is
-- text while user_roles.role is public.app_role. Existing data is unchanged.

CREATE OR REPLACE FUNCTION public.sync_role_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_type_text text := NEW.account_type::text;
BEGIN
  -- Public profile writes must never remove the private Admin role.
  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = NEW.id
      AND role = 'admin'::public.app_role
  ) AND account_type_text <> 'admin' THEN
    RETURN NEW;
  END IF;

  IF account_type_text IN ('personal', 'organization', 'vendor', 'admin') THEN
    IF account_type_text <> 'admin' THEN
      DELETE FROM public.user_roles
      WHERE user_id = NEW.id
        AND role <> account_type_text::public.app_role;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, account_type_text::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_role_from_profile()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_role_from_profile()
  TO service_role;