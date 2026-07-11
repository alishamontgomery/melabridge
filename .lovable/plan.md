# MelaBridge — Production-Readiness Plan

## Honest scoping note

What you've asked for is an MVP built to production quality across **17 phases, ~25 modules, full auth, RLS, AI, invitations, messaging, notifications, file storage, permissions, and a 4-persona QA pass**. Realistically that's several focused work sessions, not one turn. Trying to do it all at once produces the exact problem you're auditing against — dozens of pages that *look* wired up but don't actually save, validate, or enforce permissions.

So this plan does two things:

1. **Delivers the one complete end-to-end user journey you called out as the priority**, backed by a real database, in this first pass.
2. **Sequences the rest** so every subsequent pass ships a fully-working slice (interface + persistence + validation + permissions + errors) rather than another layer of scaffolding.

Right now the app has ~50 routes but **zero real backend** — Lovable Cloud is not enabled, there's no `auth`, no DB tables, no RLS, and every module uses in-memory demo state. That is the single biggest blocker; everything in your prompt depends on fixing it first.

---

## Pass 1 (this turn, after you approve) — Foundation + core loop

Goal: a real user can sign up, land in onboarding, create a persisted event, see it on a dashboard, add tasks/budget/guests, log out, log back in, and find everything intact.

**1. Enable Lovable Cloud** and provision the schema for the core loop:
`profiles`, `user_roles` (app_role enum: owner/admin/editor/commenter/viewer), `events`, `event_members`, `tasks`, `budget_items`, `guests`, `vendors`, `activity_log`. All with RLS scoped through a `has_event_access(event_id, min_role)` security-definer function so we never write recursive policies. Grants + timestamps + indexes on `event_id`.

**2. Auth** (email/password + Google via Lovable Cloud):
`/auth` (sign in + sign up tabs), `/forgot-password`, `/reset-password`, `onAuthStateChange` wired in `__root.tsx`, `_authenticated/route.tsx` gate, header shows avatar/sign-out when signed in, protected routes moved under `_authenticated/`. Profile row auto-created via DB trigger on signup.

**3. Onboarding** (`/onboarding`) — real form, writes to `profiles` + creates first `events` row, redirects to `/events/$id`.

**4. Event CRUD** — create, edit, archive, delete-with-confirm, cover image upload to Storage, list at `/events`, detail at `/events/$id`. Server functions with `requireSupabaseAuth` + Zod validation.

**5. Core modules wired to DB for the active event**: Tasks (CRUD + complete + assign + due date), Budget (categories + estimated/actual/paid), Guests (add/edit/RSVP/import CSV). Each with loading, empty, and error states.

**6. Dashboard** (`/events/$id`) rebuilt on real data: countdown, progress from task completion %, budget summary, guest RSVP summary, recent activity. Every card links somewhere real.

**7. Cleanup pass on the audit list**:
- Remove dead buttons and fake interactions in touched routes
- Delete/hide modules we haven't wired yet from the sidebar until their pass lands (so nothing in-nav is a lie)
- Fix the current landing-page footer social handles per your Phase 13 spec (already done last turn — verify)
- Global 404 + Unauthorized pages, toast system, confirmation dialog, error boundary

At the end of pass 1 you'll have: **Homepage → Sign up → Onboarding → Create Event → Dashboard → Tasks/Budget/Guests → Logout → Login → data persists**. That's the journey you led with.

---

## Pass 2 — AI Planner + Vendors + Decisions + Files

- Wire Bridge Concierge™ to Lovable AI Gateway (`google/gemini-3-flash-preview`) via a `createServerFn`, streaming a structured event plan. Accepted recommendations write to real tables (`tasks`, `budget_items`, `ai_recommendations`).
- Vendors CRUD + quotes + contract status + compare view.
- Decision Center™: `decisions`, `decision_choices`, `votes` tables; create/vote/close/override flows.
- Files: Storage bucket per event, upload/preview/rename/delete, RLS by event membership.

---

## Pass 3 — Collaboration, Messaging, Notifications

- Invitations (email + link) → `event_members` with role.
- Roles enforced in UI (hide/disable) AND in RLS (`has_event_access(event_id, min_role)`).
- Comments + @mentions on tasks/decisions.
- Messaging: `conversations` + `messages` + unread indicators + attachments.
- Notifications table + preferences + bell dropdown + toasts.
- Activity log surfaced on the Planning Board.

---

## Pass 4 — Settings, Polish, QA

- Settings pages that actually save: profile, password, notification prefs, AI prefs, appearance, privacy, account deletion (hard delete via admin server fn).
- Sample "Johnson Family Reunion" demo event behind an explicit `Explore Demo` button on `/events` — seeded via a migration into a dedicated `demo_events` flag so it never mixes with real user data.
- Accessibility sweep: focus rings, ARIA labels, reduced-motion, contrast.
- 4-persona manual QA via Playwright (owner, editor, commenter, viewer) on desktop + mobile.
- Final report: fixed / functional / needs-credentials / migrations / env vars / remaining blockers.

---

## Technical details

- **Stack**: keep TanStack Start + Tailwind v4 + shadcn + existing design tokens. No brand/nav/palette changes.
- **Backend**: Lovable Cloud (Supabase under the hood). `createServerFn` for app-internal reads/writes with `requireSupabaseAuth`; browser client for realtime + auth flows only.
- **RLS pattern**: `user_roles` table + `has_role()` for platform roles; `event_members` + `has_event_access(event_id, min_role)` for per-event permissions. Security-definer functions to avoid recursive policies.
- **AI**: Lovable AI Gateway via `@ai-sdk/openai-compatible`, key in `LOVABLE_API_KEY`, server-only. Structured output with Zod schemas. No mock data presented as live AI — if the key is missing we show a clearly-labeled "AI unavailable — configure Lovable AI" state.
- **Existing routes** stay mounted but modules not yet wired get a "Coming in the next build pass" empty state instead of fake interactions, so the audit rule "no visible buttons that perform no action" holds from turn one.
- **Migrations**: one per pass, additive. Grants + RLS in the same migration as every `CREATE TABLE`.

---

## What I need from you before I start

1. **Approve this phased approach** (Pass 1 today, subsequent passes in follow-up turns).
2. **Confirm I can enable Lovable Cloud** now — it's the prerequisite for literally everything auth/data related.
3. **Which auth methods for Pass 1**: default is email/password + Google. Say the word if you want to skip Google or add Apple.
4. **User profiles**: I'm assuming yes (name, avatar, role, preferences) since onboarding collects them — confirm.

Reply "go" (with any tweaks) and I'll start Pass 1 immediately.
