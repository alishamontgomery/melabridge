CREATE TABLE public.ticket_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES public.ticket_types(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 20),
  note TEXT,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_type_id, email)
);

CREATE INDEX ticket_waitlist_event_idx ON public.ticket_waitlist(event_id, created_at DESC);
CREATE INDEX ticket_waitlist_type_idx ON public.ticket_waitlist(ticket_type_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_waitlist TO authenticated;
GRANT INSERT ON public.ticket_waitlist TO anon;
GRANT ALL ON public.ticket_waitlist TO service_role;

ALTER TABLE public.ticket_waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can add themselves to the waitlist (public form).
CREATE POLICY "Anyone can join waitlist"
  ON public.ticket_waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Event owners can view/manage their waitlist.
CREATE POLICY "Event owners can read waitlist"
  ON public.ticket_waitlist FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = ticket_waitlist.event_id AND e.owner_id = auth.uid()));

CREATE POLICY "Event owners can update waitlist"
  ON public.ticket_waitlist FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = ticket_waitlist.event_id AND e.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = ticket_waitlist.event_id AND e.owner_id = auth.uid()));

CREATE POLICY "Event owners can delete waitlist"
  ON public.ticket_waitlist FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = ticket_waitlist.event_id AND e.owner_id = auth.uid()));

CREATE TRIGGER update_ticket_waitlist_updated_at
  BEFORE UPDATE ON public.ticket_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
