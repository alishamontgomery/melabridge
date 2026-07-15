DROP POLICY "Anyone can join waitlist" ON public.ticket_waitlist;

CREATE POLICY "Anyone can join waitlist for public tickets"
  ON public.ticket_waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ticket_types t
      WHERE t.id = ticket_waitlist.ticket_type_id
        AND t.event_id = ticket_waitlist.event_id
        AND t.is_active = true
        AND t.visibility = 'public'
    )
    AND length(trim(full_name)) BETWEEN 1 AND 120
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(email) <= 200
    AND notified_at IS NULL
  );
