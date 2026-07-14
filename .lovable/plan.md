# Dashboard Companion Redesign

Transform `/dashboard` from a stats grid into a personalized, AI-first daily briefing. All work stays in frontend/presentation (no schema changes) and reuses existing event, task, guest, budget, vendor, and runsheet data already loaded there.

## New dashboard layout (top → bottom)

1. **AI Welcome Header** — "Good morning/afternoon/evening, {firstName} ☀️", event name, live countdown ("56 Days Away"), on-track % (computed from tasks complete + budget delta + RSVP rate), rotating daily motivational line (deterministic by date so it stays stable within a day, rotates across a pool of ~15).
2. **Live Countdown strip** — animated Days / Hours / Minutes until event date, milestone chip when 100/50/30/7/1 days away.
3. **Daily Check-In card** — shown at most once every 3 days (tracked in `localStorage: melabridge:lastMoodCheckin`). 5 mood options. Selected mood stored in `localStorage: melabridge:mood` and drives the tone of Today's Focus + Brief copy.
4. **Today's Brief** — dynamic bullet list generated from real data: new RSVPs in last 24h, overdue/high-priority tasks, upcoming payments, budget status, next runsheet milestone, weather-friendly note if event is outdoor. Never empty — falls back to planning tips.
5. **Today's Focus** — single recommended task card (highest priority upcoming task, or a suggested next step if none). Shows "Why this matters" + estimated time + "Complete Now" button that marks it done inline.
6. **Event Health Score** — computed 0–100 with 5 sub-scores rendered as star ratings: Budget, Guests, Timeline, Vendors, Contracts. Deterministic pure function from loaded data.
7. **Celebrate Progress** — milestone banner that appears when a threshold is hit (venue booked, 50% RSVPs, under budget, N days left). Uses `canvas-confetti` for the confetti burst (already permitted; ~3KB). Dismissible, and once dismissed for a given milestone key it's remembered in localStorage.
8. **AI Concierge card** — prominent gradient card with 7 action buttons routing to existing flows (timeline, vendors, reminders, invitations, seating, budget, quotes).
9. **AI Savings Center** — up to 3 heuristic suggestions derived from budget items (over-target categories, un-booked vendors near event date).
10. **Smart Predictions** — 2–3 data-driven predictive tips (RSVP pace vs. days remaining, budget burn rate, vendor booking urgency).
11. **Inspiration Feed** — rotating horizontally-scrollable cards (curated static list keyed to event type). "Save to event" writes to existing files/notes table already used elsewhere, or a new local favorite list — will reuse `search_favorites` table already present.

## No-empty-states rule
Every card has a fallback content path: planning tip, milestone preview, or educational blurb keyed off event type. No "No activity" strings anywhere.

## Files
- **New:** `src/components/dashboard/welcome-header.tsx`, `countdown-strip.tsx`, `daily-checkin.tsx`, `todays-brief.tsx`, `todays-focus.tsx`, `event-health-score.tsx`, `celebrate-progress.tsx`, `ai-concierge.tsx`, `ai-savings.tsx`, `smart-predictions.tsx`, `inspiration-feed.tsx`.
- **New:** `src/lib/dashboard-intelligence.ts` — pure functions: `computeHealthScore`, `buildDailyBrief`, `pickTodaysFocus`, `getDailyMessage`, `computePredictions`, `computeSavings`, `getMilestones`.
- **Edit:** `src/routes/dashboard.tsx` — replace stats-grid layout with the composed sections above; keep existing data queries (events, tasks, guests, budget, vendors) and pass into the new components. Preserve deleted_at filters and current data-loading behavior.
- **Add dep:** `canvas-confetti` + `@types/canvas-confetti`.

## Design tokens
Use existing semantic tokens (`--primary`, `--accent`, gradients already in `styles.css`). Add 2 subtle new utility classes if needed for the header gradient and the health-score ring — via `styles.css`, no hardcoded hex in components.

## Out of scope (not touched this sprint)
- No schema/DB changes.
- No changes to other routes (tasks, guests, budget, timeline, events, files).
- No AI gateway calls — brief/focus/predictions are computed client-side from already-loaded data (deterministic, instant, free). We can layer real LLM copy in a future sprint.
- No new backend endpoints.

## Verification
- `bunx tsgo --noEmit`
- Playwright: load `/dashboard`, screenshot desktop + mobile viewports, confirm all sections render with real event data and empty-event fallbacks.
