# AI Automation Overhaul — Plan

The user wants MelaBridge to plan the event **for** the user. Creating an event must instantly produce a full editable workspace (tasks, budget, timeline, runsheet, vendor needs, reminders) — not blank pages with "Generate" buttons.

This is a large scope. I'll ship it in one focused pass, prioritizing the automation backbone over cosmetic polish so the whole surface works, then iterate.

## Approach

Single AI call at event creation produces the entire plan. Deterministic scaffolding fills gaps so the workspace is **never** blank even if the AI call fails.

### 1. Extend `bootstrapEventPlan` server function
Currently generates tasks + budget only. Extend to also produce:
- **Runsheet** (event-day minute-by-minute schedule) — stored as tasks with a `runsheet` marker/tag and specific times, or as a new `event_runsheet_items` table.
- **Vendor needs** — categories with Required/Recommended/Optional status → new `event_vendor_needs` table.
- **Timeline milestones** — already covered by tasks with due_date; group in UI.

AI prompt is upgraded to accept event_type and return a plan sized to the event (birthday ≈ 20 tasks, wedding ≈ 100). Falls back to a deterministic template per event type when AI fails or is unavailable.

### 2. New DB tables (one migration)
- `event_runsheet_items` (event_id, time, title, duration_min, owner, sort_order, notes, is_sample)
- `event_vendor_needs` (event_id, category, status enum: required/recommended/optional, priority, notes, booked_vendor_id nullable, sort_order)

Both with GRANTs + RLS (owner via events.owner_id, same pattern as tasks/budget).

### 3. Deterministic templates
`src/lib/event-templates.ts` — per-event-type task/budget/vendor/runsheet templates. Used:
- As fallback when AI fails
- As the "starter shape" the AI is asked to expand upon
- Ships with birthday, wedding, baby shower, engagement, bridal shower, anniversary, graduation, corporate, fundraiser, reunion, community, school defaults

### 4. Event creation flow (`events/new.tsx`)
- Simplify Step 2 form to only: name, type, date, location, guest count, budget (optional). Remove notes field.
- Step 3 runs `bootstrapEventPlan` which now populates **everything** (tasks + budget + runsheet + vendor needs).
- Progress tiles show all 4 categories populating.

### 5. UI wiring
- **Tasks page**: group by time bucket (This Week, Month Before, Week Of, Day Before, Event Day, After).
- **Budget page**: already renders items; verify not empty state when items exist.
- **Timeline page**: already shows tasks with due_dates.
- **Runsheet**: new route `/runsheet` (or reuse timeline day-of view) that lists `event_runsheet_items`. Wire the dead "Plan Runsheet" button.
- **Vendors page**: show `event_vendor_needs` at the top with Required/Recommended/Optional badges.
- **Event Health Score**: compute in `ecosystem-store` from tasks done %, vendor needs met, budget status, RSVP progress, overdue payments. Show missing-items list on dashboard.
- Remove dead "Explore Sample Workspace" button (or wire it to load sample).
- Hide Cancelled/Completed status options in the create flow.
- Remove duplicate "Create Event" CTAs.

### 6. Payment wording
Rename budget-item payment fields in the UI:
- "Deposit Required", "Deposit Received", "Remaining Balance", "Final Payment Due", "Status" (auto-computed: Pending Deposit / Partially Paid / Paid in Full / Overdue).

### 7. Proactive MelaAssist alerts
Compute on dashboard/event overview: missing essential vendors, budget over-allocation, RSVP timing, overdue tasks. Each alert has a one-click action link.

## Scope trade-offs

To keep this shippable in one turn:
- **Deep 100+ task wedding template**: I'll ship a solid 30-40 task wedding template + rely on AI to expand. Not literally 100 hand-written tasks per event type.
- **Weather/venue-capacity/cake-timing detection**: covered by generic alert framework, not each specific rule.
- **Runsheet drag-reorder / export**: I'll ship the populated runsheet + edit + add. Export/reorder deferred.
- **Vendor auto-matching to marketplace**: needs shows the category; matching to real vendors uses existing vendor search — I won't rebuild that flow.

## Files

**New**
- `supabase/migrations/<ts>_runsheet_vendor_needs.sql`
- `src/lib/event-templates.ts` (deterministic per-type templates)
- `src/routes/_authenticated/runsheet.tsx` (or extend timeline)
- `src/components/event-health-card.tsx`
- `src/components/proactive-alerts.tsx`

**Edited**
- `src/lib/event-bootstrap.functions.ts` (expand output, add fallback)
- `src/routes/_authenticated/events/new.tsx` (simplify form, remove notes, hide cancelled/completed)
- `src/routes/tasks.tsx` (time-bucket grouping)
- `src/routes/budget.tsx` (payment wording)
- `src/routes/vendors.tsx` (needs section at top)
- `src/lib/ecosystem-store.tsx` (health score inputs)
- `src/routes/_authenticated/events/$eventId.tsx` (health card + alerts + wire Plan Runsheet button)
- Any page currently showing "Explore Sample Workspace" — wire or remove.

## Verification
- `bunx tsgo --noEmit`
- Playwright: sign in, create a birthday event with 30 guests / $2k, open each page, screenshot proof each is populated.
- Check dead buttons (Plan Runsheet, Explore Sample Workspace) now do something.

Confirm and I'll build it in one pass.
