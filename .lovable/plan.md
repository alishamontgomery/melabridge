## MelaBridge Personal Workspace Overhaul — Implementation Plan

This is a very large scope. I'll break it into phased slices so we can ship polished work without a giant single-shot rewrite that risks regressions. Each phase is independently mergeable and improves the app.

---

### Phase 0 — Foundations (shared infrastructure)

1. **Sample-data mode** — the single mechanism every page will use.
   - Add `profiles.sample_mode` boolean (default `true` on signup).
   - Add `is_sample` boolean to: `events`, `guests`, `tasks`, `budget_items`, `vendor_bookings`, `conversations`, `messages`, `event_files`, `event_members`, `notifications`.
   - Server fn `seedSampleWorkspace()` — idempotently creates 5 sample events (Wedding, Birthday, Corporate Conference, Baby Shower, Family Reunion) fully populated (guests, tasks, budget, vendors, bookings, timeline, messages, files, team).
   - Server fn `clearSampleWorkspace()` — deletes all `is_sample = true` rows for the user, sets `sample_mode = false`.
   - Server fn `reloadSampleWorkspace()` — clear + reseed.
   - Auto-run seed on first login (via onboarding route). Auto-run clear when the user creates their first real event. Auto-run reseed when they delete their last real event (only if `sample_mode` was never explicitly disabled).

2. **UI primitives**
   - `<SampleDataBadge />` — small pill shown on every sample-mode surface.
   - `<PageEmptyState />` — illustrated empty state with primary/secondary CTA + AI suggestion slot.
   - `<SkeletonCard />`, `<SkeletonList />` — consistent loaders.
   - `<MelaAssistPanel />` — reusable contextual AI suggestions panel (takes an array of suggestions).
   - `<FloatingAssistant />` — global floating button in `AppShell`.

---

### Phase 1 — First-login & onboarding dashboard
Rebuild `/onboarding` as the premium welcome dashboard:
- Hero: "Welcome to MelaBridge — Your AI-powered event planning workspace is ready."
- Three primary CTAs: **Create My First Event**, **Explore Sample Event**, **Take a 2-Minute Tour**.
- MelaAssist greeting card with personalized guidance.
- After seed runs, redirect returning users straight to `/events` (their sample workspace).

---

### Phase 2 — Core planning pages (wire to sample data)
Every page below reads real DB rows (sample or live). No hardcoded fixtures. Each gets: sample badge, skeleton loader, empty→sample fallback, MelaAssist suggestions, quick-action bar.

- **My Events** (`/events`) — premium event cards (banner, countdown, guests, budget, completion %, next task, quick actions: Open/Duplicate/Archive/Share).
- **Guests** (`/guests`) — RSVP statuses, meals, seating, households, plus-ones, search.
- **Timeline** (`/timeline`) — 12-month → event-day milestones.
- **Budget** (`/budget`) — estimated vs actual, category breakdown, remaining, charts, alerts.
- **Tasks** (`/tasks`) — priority, due dates, assignees, progress, AI recs.
- **Bookings** (`/bookings`) — contracts, deposits, payment schedule, status.
- **Messages** (`/messaging`) — planner/vendor/guest/team threads with attachments, reactions, read receipts (UI only for reactions/typing).
- **Team** (`/team`) — sample members, roles, permissions, pending invites, role templates.
- **Files** (`/files`) — sample folders (Contracts, Invoices, Mood Boards, Guest Docs, Vendor Files), drag-drop upload.

---

### Phase 3 — Vendors marketplace redesign
- `/vendors` → premium marketplace cards (cover, logo, verified, rating, reviews, city, starting price, response time, availability, save, view, quote, message).
- Filters: search, category, location, event date, budget, rating, distance, availability.
- Category shortcuts row (15 categories listed in brief).
- Sections: Featured, MelaAssist Recommendations, BridgeDNA™ compatibility.
- Vendor profile page: Gallery, Packages, Reviews, FAQs, Policies, Portfolio, Videos, Availability calendar, Booking, Messaging.
- Seed ~20 sample vendor profiles across categories (`vendor_profiles.is_sample`).

---

### Phase 4 — Calendar enhancements
Keep existing shell; add:
- Dashboard summary cards (Upcoming Events, Pending Tasks, Vendor Payments, Pending RSVPs, Notifications).
- MelaAssist sidebar (deadlines, follow-ups, overdue invoices, guest reminders, conflicts).
- Date-click opens **side drawer** instead of route change.
- Placeholder "Connect Google/Apple/Outlook" cards (disabled, "coming soon").

---

### Phase 5 — Guided event creation
Rebuild `/events/new`:
- Step 1: Type picker (Wedding, Birthday, Corporate, Baby Shower, Graduation, Reunion, Fundraiser, Custom).
- Step 2: AI auto-generates timeline, budget, tasks, vendor recs, guest checklist, calendar, documents, comms (uses Lovable AI gateway; server fn already exists in `event-bootstrap.functions.ts` — extend it).
- On first real event created → clear sample data.

---

### Phase 6 — Global UX polish
- Animated page transitions (fade-in on route mount).
- Skeleton loaders everywhere.
- Floating MelaAssist button in `AppShell`.
- Sticky action bars on list pages.
- Empty-state illustrations (generated).
- Keyboard shortcuts palette (already partially exists — polish).
- Consistent spacing/typography audit.
- Dark mode pass.

---

## Technical Details

- **DB migration** adds `is_sample`, `sample_mode`, plus `sample_metadata jsonb` on events (banner URL, description).
- **Grants**: every new column is on existing tables — no new tables, no new grants required.
- **Seed server fn** uses `requireSupabaseAuth` and writes as the user (RLS-safe). Idempotent via `WHERE is_sample = true AND owner_id = auth.uid()` checks.
- **Auto-transitions**: trigger on `events` INSERT/DELETE checks if user has any non-sample events; if first non-sample → mark profile `sample_mode=false` and delete sample rows. If last event deleted and `sample_mode` was never explicitly disabled → reseed. Implemented as a DB trigger + server-fn fallback.
- **AI** uses `openai/gpt-5.5` via Lovable AI Gateway for event bootstrap suggestions.
- **Images**: generate ~10 shared banner/cover images (weddings, corporate, etc.) once, store in `src/assets/`.

---

## Suggested execution order

I recommend we ship in this order, one phase per turn so you can review each:

1. **Phase 0 + 1** (foundations + onboarding) — biggest structural change; unlocks everything else.
2. **Phase 2** (planning pages) — highest visible impact.
3. **Phase 3** (vendors marketplace).
4. **Phase 4** (calendar) + **Phase 6** (polish pass).
5. **Phase 5** (guided event creation with AI).

**Question before I start:** should I proceed with Phase 0 + 1 now, or would you like to reorder / cut scope? (For example, if the vendor marketplace is highest priority for launch, we can front-load Phase 3.)
