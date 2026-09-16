-- Event communications log
-- Stores messages that organizers have sent (or scheduled) to guest segments.

CREATE TABLE IF NOT EXISTS public.event_communications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject          TEXT        NOT NULL,
  body             TEXT        NOT NULL,
  recipient_group  TEXT        NOT NULL, -- 'all_guests' | 'confirmed' | 'pending' | 'declined' | 'ticket_holders' | 'checked_in'
  recipient_count  INT         NOT NULL DEFAULT 0,
  scheduled_for    TIMESTAMPTZ,          -- NULL = immediate send
  sent_at          TIMESTAMPTZ,
  status           TEXT        NOT NULL DEFAULT 'sent', -- 'sent' | 'scheduled' | 'failed'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_communications ENABLE ROW LEVEL SECURITY;

-- Organizer can see and insert communications for their own events.
CREATE POLICY "Event owner manages communications"
  ON public.event_communications
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT id FROM public.events WHERE owner_id = auth.uid()
    )
  );

-- Index for listing recent communications per event efficiently.
CREATE INDEX IF NOT EXISTS idx_event_comms_event_id_created
  ON public.event_communications (event_id, created_at DESC);
