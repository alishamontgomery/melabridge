ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ticket_primary_color text NOT NULL DEFAULT '#542d2b',
  ADD COLUMN IF NOT EXISTS ticket_accent_color text NOT NULL DEFAULT '#f1bd83';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_ticket_primary_color_hex,
  ADD CONSTRAINT events_ticket_primary_color_hex
    CHECK (ticket_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  DROP CONSTRAINT IF EXISTS events_ticket_accent_color_hex,
  ADD CONSTRAINT events_ticket_accent_color_hex
    CHECK (ticket_accent_color ~ '^#[0-9A-Fa-f]{6}$');