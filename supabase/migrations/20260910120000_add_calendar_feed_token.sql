ALTER TABLE public.calendar_settings
  ADD COLUMN IF NOT EXISTS calendar_feed_token uuid UNIQUE;

CREATE INDEX IF NOT EXISTS calendar_settings_feed_token_idx
  ON public.calendar_settings (calendar_feed_token)
  WHERE calendar_feed_token IS NOT NULL;