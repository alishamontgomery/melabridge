-- Add event-level visibility for ticket page access control
-- 'public'    = event appears in discovery + shareable link works
-- 'link_only' = shareable link works but not in discovery (default)

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_visibility text NOT NULL DEFAULT 'public'
  CHECK (event_visibility IN ('public', 'link_only'));
