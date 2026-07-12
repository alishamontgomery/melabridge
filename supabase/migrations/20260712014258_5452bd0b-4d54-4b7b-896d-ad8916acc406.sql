
-- Extend profiles with account type + organization flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT,           -- 'planner' | 'vendor' | 'guest'
  ADD COLUMN IF NOT EXISTS is_organization BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS organization_name TEXT,
  ADD COLUMN IF NOT EXISTS organization_type TEXT;      -- business | school | church | nonprofit | corporate

-- Vendor profiles
CREATE TABLE IF NOT EXISTS public.vendor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  business_name TEXT NOT NULL,
  business_category TEXT NOT NULL,
  business_description TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  city TEXT,
  state TEXT,
  travel_radius INTEGER,
  business_address TEXT,
  mobile_service BOOLEAN DEFAULT false,
  virtual_services TEXT,
  years_in_business INTEGER,
  starting_price NUMERIC(12,2),
  business_hours JSONB,
  social_links JSONB,
  portfolio_urls TEXT[] DEFAULT '{}',
  accepted_terms BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_profiles TO authenticated;
GRANT ALL ON public.vendor_profiles TO service_role;
GRANT SELECT ON public.vendor_profiles TO anon; -- allow public marketplace browsing
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendor profiles: public read"
  ON public.vendor_profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Vendor profiles: insert own"
  ON public.vendor_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Vendor profiles: update own"
  ON public.vendor_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Vendor profiles: delete own"
  ON public.vendor_profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_vendor_profiles_updated_at
  BEFORE UPDATE ON public.vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
