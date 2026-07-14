# Production-Readiness Sprint

Before adding new pillars (Real Send Pipeline, Studio v2, Marketplace, AI Automation, AI Concierge), MelaBridge needs a hardening pass so every profile feels enterprise-grade. This plan is that sprint — scoped, sequenced, and shippable in one pass.

## Scope

Every route in `src/routes/` reviewed against a single checklist:

1. **No dead buttons** — every `<Button>` / clickable either navigates, mutates, opens a dialog, or is removed. No `onClick={() => {}}` and no "coming soon" toasts on primary actions.
2. **No dead links** — every `<Link>` points to an existing route in `routeTree.gen.ts`. Broken targets get either a real page or the link is removed.
3. **No blank pages** — every route renders meaningful content (either real data, a curated empty state with a clear next action, or seeded sample content). No pages that render only a title.
4. **No overflow / clipping** — global sweep applying the responsive-grid pattern (`grid-cols-[minmax(0,1fr)_auto]`, `min-w-0`, `truncate`, `shrink-0`, `whitespace-normal` on buttons) to every header, card, tab strip, and dialog. Verified via Playwright at 375/768/1280.
5. **Consistent navigation** — `AppShell` groups audited so the same profile sees the same nav in the same order everywhere. Remove duplicates (e.g. Guest Messaging appearing under two groups).
6. **No placeholders** — remove "Lorem ipsum", "TODO", stub cards, and "Coming soon" tiles from shipped surfaces. If a surface is not ready, hide it behind a feature flag rather than showing a stub.
7. **Auto-generated planning assets on event creation** — when a new event is created via `event-bootstrap.functions.ts`, seed:
   - Tasks (12–20 based on event type + days-to-event)
   - Budget categories with suggested amounts (from event type + guest count)
   - Timeline / runsheet skeleton
   - Pre-event checklist
   - Vendor need placeholders based on event type
   All idempotent so re-running the bootstrap doesn't duplicate.

## Deliverables

### Phase 1 — Audit pass (mechanical fixes)
- Ripgrep sweep for `onClick={() => {}}`, empty `href`, `to=""`, `toast("Coming soon")`, `TODO`, `Lorem` — fix or remove each hit.
- Ripgrep sweep for `<Link to=` values not in `routeTree.gen.ts` — repair.
- Apply responsive header pattern to every page header and card header (targeted line replaces, not rewrites).
- Standardize button sizing: `min-h-11` on primary CTAs, `whitespace-normal` on text-heavy labels.
- Add a shared `PageHeader` component so every route gets the same responsive header and we stop repeating the fix.

### Phase 2 — Empty-state cleanup
- Add a single `EmptyState` component variant with icon + headline + subtext + primary CTA that routes somewhere useful.
- Replace every ad-hoc empty state (`No results`, blank card) with it.
- For routes with no data yet, ensure the CTA either creates the missing entity or links to the correct next step.

### Phase 3 — Auto-generated planning assets
- Extend `src/lib/event-bootstrap.functions.ts` with `seedPlanningAssets({ eventId })` invoked after event insert.
- Pull templates from a new `src/lib/planning-templates.ts` keyed by event type (wedding, birthday, corporate, cultural, other).
- Seeding writes to `tasks`, `budget_items`, `event_runsheet_items`, `event_vendor_needs` with `created_via = 'auto_seed'` for later cleanup UX.
- Idempotency: check for existing rows with that marker before inserting.

### Phase 4 — Playwright QA sweep
- Script visits: `/`, `/dashboard`, `/events`, `/events/new`, `/guests`, `/budget`, `/tasks`, `/timeline`, `/vendors`, `/vendor-portal`, `/guest-portal`, `/invitations`, `/inspiration`, `/messaging`, `/admin`, `/profile`, `/settings`.
- Each at 375px and 1280px viewports, screenshots to `/tmp/browser/audit/`.
- Log any horizontal scrollbar (`document.documentElement.scrollWidth > innerWidth`) or clipped text.
- Fix findings in a second pass.

## Out of scope for this sprint
- Real email/SMS send pipeline (next sprint per user priority)
- Public RSVP + QR tracking backend (next sprint)
- Vendor marketplace booking flow (later)
- AI event auto-generation (later)
- AI Concierge proactive suggestions (later)

Those five pillars get their own dedicated sprints in the priority order the user gave, starting with **Real Send Pipeline** immediately after this hardening pass lands.

## Technical notes
- Use `code--exec` + `rg` for the audit sweeps; batch findings per file.
- Use `code--line_replace` for targeted header/button fixes; only `code--write` for new files (`PageHeader`, `EmptyState`, `planning-templates.ts`).
- Bootstrap seeding runs inside the existing `createServerFn` with `requireSupabaseAuth` — no schema changes required (uses existing columns).
- Verify with `bunx tsgo --noEmit` and Playwright before closing the sprint.

## Estimated size
Large but bounded: ~30–50 file edits + 3 new files + 1 migration-free seed function. Single sprint, single response batch where possible.

Approve this and I'll execute Phase 1 → 4 in order, reporting Playwright findings before the final polish pass.