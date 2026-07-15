
-- Add invitation guidance column to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS invitation_guidance TEXT;

-- Shopping list per event
CREATE TABLE IF NOT EXISTS public.event_shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'General',
  item TEXT NOT NULL,
  quantity TEXT,
  notes TEXT,
  purchased BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_test_seed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_shopping_event ON public.event_shopping_items(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_shopping_items TO authenticated;
GRANT ALL ON public.event_shopping_items TO service_role;

ALTER TABLE public.event_shopping_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event members can view shopping items"
  ON public.event_shopping_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_shopping_items.event_id
        AND (e.owner_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.event_members m
                        WHERE m.event_id = e.id AND m.user_id = auth.uid()))
    )
  );

CREATE POLICY "Event members can insert shopping items"
  ON public.event_shopping_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_shopping_items.event_id
        AND (e.owner_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.event_members m
                        WHERE m.event_id = e.id AND m.user_id = auth.uid()))
    )
  );

CREATE POLICY "Event members can update shopping items"
  ON public.event_shopping_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_shopping_items.event_id
        AND (e.owner_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.event_members m
                        WHERE m.event_id = e.id AND m.user_id = auth.uid()))
    )
  );

CREATE POLICY "Event members can delete shopping items"
  ON public.event_shopping_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_shopping_items.event_id
        AND (e.owner_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.event_members m
                        WHERE m.event_id = e.id AND m.user_id = auth.uid()))
    )
  );

DROP TRIGGER IF EXISTS trg_event_shopping_updated_at ON public.event_shopping_items;
CREATE TRIGGER trg_event_shopping_updated_at
  BEFORE UPDATE ON public.event_shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
