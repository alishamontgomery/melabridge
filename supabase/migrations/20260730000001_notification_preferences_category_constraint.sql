-- Fix notification_preferences unique constraint to include category.
-- The original constraint was (user_id, channel) which meant all category
-- rows for a user shared the same key, causing later upserts to overwrite
-- earlier ones. The correct key is (user_id, category, channel) so each
-- notification type can be independently toggled.

-- Drop the old constraint (may be named differently depending on Postgres auto-naming)
ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_user_id_channel_key;

-- Also drop by the common auto-generated pattern in case the name differs
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'notification_preferences'
    AND c.contype = 'u'
    AND array_to_string(ARRAY(
      SELECT a.attname
      FROM pg_attribute a
      WHERE a.attrelid = c.conrelid
        AND a.attnum = ANY(c.conkey)
      ORDER BY a.attnum
    ), ',') IN ('channel,user_id', 'user_id,channel');
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notification_preferences DROP CONSTRAINT IF EXISTS %I', cname);
  END IF;
END $$;

-- Add the category column if it doesn't already have a NOT NULL default
-- (it was added by a later migration — just ensure it exists before indexing)
ALTER TABLE public.notification_preferences
  ALTER COLUMN category SET DEFAULT 'general';

UPDATE public.notification_preferences
  SET category = 'event_updates'
  WHERE category IS NULL OR category = '';

ALTER TABLE public.notification_preferences
  ALTER COLUMN category SET NOT NULL;

-- Add the new composite unique constraint
ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_user_category_channel_key
  UNIQUE (user_id, category, channel);
