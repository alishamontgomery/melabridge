
-- Extend event_status enum with new vendor lifecycle values
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'inquiry';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'consultation_scheduled';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'quote_sent';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'tentative';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'cancelled';
