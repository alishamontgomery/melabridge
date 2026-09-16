-- Public event page fields
-- Adds publish toggle, public description, FAQs, and gift registry to events.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_published         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_description   TEXT,
  ADD COLUMN IF NOT EXISTS public_faqs          JSONB    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gift_registry_url    TEXT,
  ADD COLUMN IF NOT EXISTS show_schedule_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_rsvp_public     BOOLEAN NOT NULL DEFAULT true;

-- Index for public lookups (only published events need fast lookups)
CREATE INDEX IF NOT EXISTS idx_events_is_published ON public.events (id) WHERE is_published = true;

-- ─── Security-definer RPC: public event page ──────────────────────────────────
-- Exposes ONLY the safe public-facing columns for a single published event.
-- Runs as the DB owner (SECURITY DEFINER), so it can read the base table without
-- granting SELECT on the full events table to the anon role.
-- The anon role gets EXECUTE on this function and nothing else.
CREATE OR REPLACE FUNCTION public.get_public_event_page(p_event_id uuid)
RETURNS TABLE (
  id                   uuid,
  name                 text,
  event_type           text,
  event_date           date,
  event_time           time,
  location             text,
  description          text,
  public_description   text,
  public_faqs          jsonb,
  gift_registry_url    text,
  show_schedule_public boolean,
  show_rsvp_public     boolean,
  cover_image_url      text,
  tickets_enabled      boolean
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT
    e.id,
    e.name,
    e.event_type,
    e.event_date,
    e.event_time,
    e.location,
    e.description,
    e.public_description,
    e.public_faqs,
    e.gift_registry_url,
    e.show_schedule_public,
    e.show_rsvp_public,
    e.cover_image_url,
    e.tickets_enabled
  FROM public.events e
  WHERE e.id = p_event_id
    AND e.is_published = true
    AND e.deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_event_page(uuid) TO anon;

-- ─── Security-definer RPC: public runsheet ────────────────────────────────────
-- Returns runsheet items only for published events.
-- Joins back to events to enforce the is_published check — so a caller who
-- knows a runsheet item ID cannot bypass the publication gate.
CREATE OR REPLACE FUNCTION public.get_public_runsheet(p_event_id uuid)
RETURNS TABLE (
  id           uuid,
  title        text,
  start_time   time,
  duration_min integer,
  owner        text,
  status       text,
  sort_order   integer
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT
    r.id,
    r.title,
    r.start_time,
    r.duration_min,
    r.owner,
    r.status,
    r.sort_order
  FROM public.event_runsheet_items r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.event_id = p_event_id
    AND e.is_published = true
    AND e.deleted_at IS NULL
  ORDER BY r.sort_order NULLS LAST, r.start_time NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_runsheet(uuid) TO anon;

-- NOTE: No SELECT grants on the base tables are added here.
-- The anon role accesses public event data exclusively through the two
-- SECURITY DEFINER functions above, which enforce the publication gate and
-- expose only the intended columns. Planner writes go through the authenticated
-- server function (updatePublicPageSettings) which uses requireSupabaseAuth
-- and the user's JWT, so RLS owner checks are enforced normally.
