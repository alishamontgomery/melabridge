-- Add admin verification columns to vendor_profiles
-- Allows admins to mark vendor profiles as verified (BridgeCheck™ badge)

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for fast lookups of verified vendors
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_is_verified
  ON public.vendor_profiles (is_verified)
  WHERE is_verified = true;

-- Admin policy: only service_role may update is_verified
-- (enforced at application level via server functions with assertAdmin)
