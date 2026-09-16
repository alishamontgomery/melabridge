ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS invitation_last_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.guests.invited_at IS
  'Most recent time a dedicated RSVP invitation email was successfully sent.';

COMMENT ON COLUMN public.events.invitation_last_sent_at IS
  'Rate-limit lease for dedicated guest invitation batches.';
