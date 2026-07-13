INSERT INTO public.user_roles (user_id, role)
VALUES ('62b67a04-8069-4c48-a848-38c43cf40ae1', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;