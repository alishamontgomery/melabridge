-- New enum values must be committed before they can be used
ALTER TYPE public.booking_stage ADD VALUE IF NOT EXISTS 'quote_viewed';
ALTER TYPE public.booking_stage ADD VALUE IF NOT EXISTS 'quote_accepted';
ALTER TYPE public.booking_stage ADD VALUE IF NOT EXISTS 'no_response';
ALTER TYPE public.booking_stage ADD VALUE IF NOT EXISTS 'lost';

ALTER TABLE public.vendor_bookings
  ADD COLUMN IF NOT EXISTS quote_viewed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS quote_accepted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS review_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS no_response_at     timestamptz,
  ADD COLUMN IF NOT EXISTS lost_at            timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at       timestamptz,
  ADD COLUMN IF NOT EXISTS in_progress_at     timestamptz;