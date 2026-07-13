
CREATE TYPE public.event_draft_status AS ENUM ('pending', 'approved', 'edited', 'discarded');
CREATE TYPE public.event_draft_source AS ENUM ('email', 'message', 'voice', 'manual_paste', 'assistant');

CREATE TABLE public.event_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.event_draft_status NOT NULL DEFAULT 'pending',
  source public.event_draft_source NOT NULL DEFAULT 'assistant',
  source_reference TEXT,
  raw_input TEXT,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  field_confidences JSONB NOT NULL DEFAULT '{}'::jsonb,
  extracted JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  suggested_next_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  approved_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX event_drafts_owner_status_idx ON public.event_drafts(owner_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_drafts TO authenticated;
GRANT ALL ON public.event_drafts TO service_role;

ALTER TABLE public.event_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their drafts" ON public.event_drafts
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert their drafts" ON public.event_drafts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update their drafts" ON public.event_drafts
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete their drafts" ON public.event_drafts
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER trg_event_drafts_updated
  BEFORE UPDATE ON public.event_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_draft_id UUID REFERENCES public.event_drafts(id) ON DELETE SET NULL;
