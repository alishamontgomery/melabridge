BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(3);

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '13700000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'category-trigger-owner@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '13700000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'category-trigger-other@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

INSERT INTO public.vendor_profiles (
  id,
  user_id,
  business_name,
  business_category
)
VALUES
  (
    '13700000-0000-0000-0000-000000000011',
    '13700000-0000-0000-0000-000000000001',
    'Multi-service vendor',
    'DJ'
  ),
  (
    '13700000-0000-0000-0000-000000000012',
    '13700000-0000-0000-0000-000000000002',
    'Unchanged vendor',
    'Caterer'
  );

INSERT INTO public.vendor_packages (
  id,
  vendor_id,
  name,
  category_fields,
  service_category
)
VALUES
  (
    '13700000-0000-0000-0000-000000000021',
    '13700000-0000-0000-0000-000000000011',
    'Inherited DJ package',
    '{"set_types":["Reception"]}'::jsonb,
    NULL
  ),
  (
    '13700000-0000-0000-0000-000000000022',
    '13700000-0000-0000-0000-000000000011',
    'Explicit photo booth package',
    '{"booth_style":"360"}'::jsonb,
    'Photo Booth'
  ),
  (
    '13700000-0000-0000-0000-000000000023',
    '13700000-0000-0000-0000-000000000012',
    'Other vendor package',
    '{"dietary_options":["Vegan"]}'::jsonb,
    NULL
  );

UPDATE public.vendor_profiles
SET business_category = 'Baker'
WHERE id = '13700000-0000-0000-0000-000000000011';

SELECT is(
  (
    SELECT category_fields
    FROM public.vendor_packages
    WHERE id = '13700000-0000-0000-0000-000000000021'
  ),
  '{}'::jsonb,
  'clears specs from a package that inherits the changed primary category'
);

SELECT is(
  (
    SELECT category_fields
    FROM public.vendor_packages
    WHERE id = '13700000-0000-0000-0000-000000000022'
  ),
  '{"booth_style":"360"}'::jsonb,
  'preserves specs on a package explicitly assigned to another service'
);

SELECT is(
  (
    SELECT category_fields
    FROM public.vendor_packages
    WHERE id = '13700000-0000-0000-0000-000000000023'
  ),
  '{"dietary_options":["Vegan"]}'::jsonb,
  'does not change packages belonging to another vendor'
);

SELECT * FROM finish();

ROLLBACK;