# MelaAssist AI Event Builder

Adds a conversational event-creation experience on top of the existing MelaAssist Context Engine + Action Framework. No AI pipelines are duplicated, no existing routes/APIs are broken, and nothing is saved without approval.

## What the user gets

A new page at `/events/ai-new` where the planner describes an event in plain language ("wedding for 120 in Atlanta next October, $25k") and MelaAssist:
1. Extracts what it can (title, type, date, time, city, venue, guests, budget, theme, notes).
2. Asks a short follow-up for anything missing.
3. Produces a **Draft Event card** + a **Timeline**, **Budget**, **Checklist**, and **Vendor Recommendations** — each as its own approvable card.
4. Nothing hits the database until the user clicks Approve on the specific card.

Existing `/events/new` form stays untouched and is still linked from `/events`. A "Plan with MelaAssist" CTA on `/events` and `/events/new` links to the new flow.

## UI

- New route: `src/routes/_authenticated/events/ai-new.tsx` (mobile-first, single column, sticky composer, progress header).
- Reuses `<ActionCard />` for every card so the Approve / Edit / Regenerate / Cancel / Copy workflow stays consistent with the assistant panel.
- Header shows a small progress ring: how many required fields are known (title, type, date, city, guests, budget) — updates as the chat fills them in.
- Next-step chips ("Move ceremony to 5 PM", "Increase budget to 30k", "Add a photo booth") come straight from the model's `nextSteps`.

## Server (extends existing engine — no new pipeline)

`src/lib/melaassist-actions.functions.ts`:
- Add two new **executable** kinds so approval actually saves:
  - `create_event_draft` — inserts the row into `events` (owner = caller), then calls the existing `bootstrapEventPlan({ only_if_empty: true })` so tasks/budget/runsheet/vendor needs are auto-scaffolded. Returns `{ eventId }`.
  - `add_timeline_milestone` — inserts a `tasks` row with a due date computed from an offset (`months_before` / `days_before`) against the event's `event_date`.
- Add `builderMode?: "event_builder"` to `TurnInput`. When set, the system prompt is tightened: always propose a `create_event_draft` first when title+type+date are known, then follow-up cards; only ask ONE missing question at a time.
- Role kinds for `personal` / `organization` gain `create_event_draft` and `add_timeline_milestone`. Existing kinds keep their current behavior for the panel.

`src/components/melaassist/types.ts` + `action-registry.ts`:
- Register the two new kinds (`executable: true`, approval copy).

## Reused components

- `melaAssistTurn` server function — same gateway, same model, same JSON-block contract.
- `executeMelaAction` server function — extended enum, existing switch pattern.
- `ActionCard`, `NextSteps`, `MelaAssistConversation` — dropped into the new page unchanged.
- `MelaAssistProvider` context — the page reads/writes the same `memory.currentEventId` so the floating panel picks up the freshly-created event automatically.

## Safety

- No auto-save. `create_event_draft` is gated by explicit Approve; every follow-up card (timeline milestone, budget line, checklist item) is its own Approve.
- After the event row is created, the memory sets `currentEventId` so later cards target the new event; the existing owner check + RLS handles authorization.
- No changes to Stripe, subscriptions, auth, messaging, vendor code, dashboards, or existing routes.
- Backward compatible: `/events/new` unchanged, `/events` list unchanged.

## Files touched

Edits:
- `src/lib/melaassist-actions.functions.ts` — add builder mode, add two executor cases.
- `src/components/melaassist/types.ts` — add two `MelaAssistActionKind` values.
- `src/components/melaassist/action-registry.ts` — register the two new kinds.
- `src/routes/_authenticated/events/index.tsx` (or wherever the events list header lives) — small "Plan with MelaAssist" link.
- `src/routes/_authenticated/events/new.tsx` — small banner linking to `/events/ai-new`.

New:
- `src/routes/_authenticated/events/ai-new.tsx` — the AI Event Builder page.

## QA

- `bunx tsgo --noEmit` clean.
- Manual: create wedding via chat, approve draft, verify event + bootstrap workspace loaded, approve a timeline milestone → task appears in `/tasks` scoped to that event.
- Manual: existing `/events/new` form still creates events; assistant panel on other pages still opens and works.
- Mobile viewport check (390px) on `/events/ai-new`.
