
CREATE TABLE public.event_runsheet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  start_time time,
  duration_min integer NOT NULL DEFAULT 15,
  title text NOT NULL,
  owner text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  is_sample boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_runsheet_items TO authenticated;
GRANT ALL ON public.event_runsheet_items TO service_role;
ALTER TABLE public.event_runsheet_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Runsheet: members read" ON public.event_runsheet_items FOR SELECT USING (app_private.is_event_member(event_id, auth.uid()));
CREATE POLICY "Runsheet: editors insert" ON public.event_runsheet_items FOR INSERT WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "Runsheet: editors update" ON public.event_runsheet_items FOR UPDATE USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role)) WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "Runsheet: editors delete" ON public.event_runsheet_items FOR DELETE USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE TRIGGER trg_runsheet_updated_at BEFORE UPDATE ON public.event_runsheet_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_runsheet_event ON public.event_runsheet_items(event_id, sort_order);

DO $$ BEGIN
  CREATE TYPE public.vendor_need_status AS ENUM ('required','recommended','optional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.event_vendor_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category text NOT NULL,
  status public.vendor_need_status NOT NULL DEFAULT 'recommended',
  priority integer NOT NULL DEFAULT 3,
  notes text,
  booked_vendor_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  is_sample boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_vendor_needs TO authenticated;
GRANT ALL ON public.event_vendor_needs TO service_role;
ALTER TABLE public.event_vendor_needs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "VendorNeeds: members read" ON public.event_vendor_needs FOR SELECT USING (app_private.is_event_member(event_id, auth.uid()));
CREATE POLICY "VendorNeeds: editors insert" ON public.event_vendor_needs FOR INSERT WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "VendorNeeds: editors update" ON public.event_vendor_needs FOR UPDATE USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role)) WITH CHECK (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE POLICY "VendorNeeds: editors delete" ON public.event_vendor_needs FOR DELETE USING (app_private.has_event_access(event_id, auth.uid(), 'editor'::event_role));
CREATE TRIGGER trg_vendor_needs_updated_at BEFORE UPDATE ON public.event_vendor_needs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_vendor_needs_event ON public.event_vendor_needs(event_id, sort_order);
