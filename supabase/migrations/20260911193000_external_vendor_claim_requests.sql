-- External vendor claims are review records only. They never create a vendor
-- profile, transfer ownership, or grant is_verified automatically.
CREATE TABLE IF NOT EXISTS public.vendor_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('google_places')),
  external_id text NOT NULL,
  business_name text NOT NULL,
  website_uri text,
  google_maps_uri text,
  claimant_user_id uuid NOT NULL,
  claimant_email text NOT NULL,
  ownership_verified boolean NOT NULL DEFAULT false,
  verification_method text,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vendor_claim_requests_claimant_external_idx
  ON public.vendor_claim_requests (source, external_id, claimant_user_id);

CREATE INDEX IF NOT EXISTS vendor_claim_requests_status_idx
  ON public.vendor_claim_requests (status, created_at DESC);

ALTER TABLE public.vendor_claim_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.vendor_claim_requests FROM anon, authenticated;
GRANT ALL ON public.vendor_claim_requests TO service_role;