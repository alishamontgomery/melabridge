-- Recent searches / recently-opened items per user
CREATE TABLE public.search_recents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,                 -- 'query' | 'result'
  query text,                         -- when kind='query'
  entity_type text,                   -- when kind='result' (event, guest, vendor, task, file, message, module, ...)
  entity_id text,                     -- string to accommodate module ids like 'm-guests'
  title text NOT NULL,
  subtitle text,
  href text,                          -- destination path
  opened_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX search_recents_user_opened_idx ON public.search_recents (user_id, opened_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_recents TO authenticated;
GRANT ALL ON public.search_recents TO service_role;

ALTER TABLE public.search_recents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own recents"   ON public.search_recents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recents" ON public.search_recents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recents" ON public.search_recents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own recents" ON public.search_recents FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Pinned favorites per user
CREATE TABLE public.search_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  title text NOT NULL,
  subtitle text,
  href text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);

CREATE INDEX search_favorites_user_idx ON public.search_favorites (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_favorites TO authenticated;
GRANT ALL ON public.search_favorites TO service_role;

ALTER TABLE public.search_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own favorites"   ON public.search_favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own favorites" ON public.search_favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own favorites" ON public.search_favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);