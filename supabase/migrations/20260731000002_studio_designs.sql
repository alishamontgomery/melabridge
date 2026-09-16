-- BridgeStudio design persistence
CREATE TABLE IF NOT EXISTS public.studio_designs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id      uuid REFERENCES public.events(id) ON DELETE SET NULL,
  title         text NOT NULL DEFAULT 'Untitled Design',
  template_id   text,
  canvas_json   jsonb,
  thumbnail_url text,
  width         integer NOT NULL DEFAULT 480,
  height        integer NOT NULL DEFAULT 672,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_designs_owner" ON public.studio_designs;
-- Owners can CRUD their own designs only
CREATE POLICY "studio_designs_owner"
  ON public.studio_designs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS studio_designs_user_id_idx    ON public.studio_designs(user_id);
CREATE INDEX IF NOT EXISTS studio_designs_event_id_idx   ON public.studio_designs(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS studio_designs_updated_at_idx ON public.studio_designs(updated_at DESC);
