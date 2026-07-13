-- Add new stages to the enum (must be in its own txn per stage)
ALTER TYPE public.booking_stage ADD VALUE IF NOT EXISTS 'in_progress' AFTER 'booked';
ALTER TYPE public.booking_stage ADD VALUE IF NOT EXISTS 'cancelled' AFTER 'reviewed';