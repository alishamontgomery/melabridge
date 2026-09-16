ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ticket_contact_name text,
  ADD COLUMN IF NOT EXISTS ticket_contact_email text,
  ADD COLUMN IF NOT EXISTS ticket_cancellation_policy text NOT NULL DEFAULT 'no_cancellations',
  ADD COLUMN IF NOT EXISTS ticket_cancellation_window_hours integer,
  ADD COLUMN IF NOT EXISTS ticket_cancellation_terms text;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_ticket_contact_name_length,
  ADD CONSTRAINT events_ticket_contact_name_length
    CHECK (ticket_contact_name IS NULL OR char_length(ticket_contact_name) <= 120),
  DROP CONSTRAINT IF EXISTS events_ticket_contact_email_length,
  ADD CONSTRAINT events_ticket_contact_email_length
    CHECK (ticket_contact_email IS NULL OR char_length(ticket_contact_email) <= 255),
  DROP CONSTRAINT IF EXISTS events_ticket_cancellation_policy_check,
  ADD CONSTRAINT events_ticket_cancellation_policy_check
    CHECK (ticket_cancellation_policy IN ('no_cancellations', 'case_by_case', 'allowed_until')),
  DROP CONSTRAINT IF EXISTS events_ticket_cancellation_window_check,
  ADD CONSTRAINT events_ticket_cancellation_window_check
    CHECK (ticket_cancellation_window_hours IS NULL OR ticket_cancellation_window_hours BETWEEN 1 AND 8760),
  DROP CONSTRAINT IF EXISTS events_ticket_cancellation_terms_length,
  ADD CONSTRAINT events_ticket_cancellation_terms_length
    CHECK (ticket_cancellation_terms IS NULL OR char_length(ticket_cancellation_terms) <= 2000);