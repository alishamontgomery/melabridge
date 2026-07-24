# MelaAssist Everywhere — Platform Integration

Reuse the existing `MelaAssistProvider`, action engine, Event Builder, and Vendor Profile Builder. No new providers, no duplicate AI calls.

## 1. Page-aware greeting + "continue previous work"
- Extend `src/components/melaassist/suggestions.ts` with a `getPageContext(pathname, role)` helper returning `{ greeting, suggestions, tip }` per surface: vendor profile, event page, events index, dashboard, admin, marketplace, budget, timeline, tickets-removed fallback, etc.
- Update `MelaAssistSuggestions` to render the page-aware greeting, contextual chips, and a single dismissible "AI Tip".
- In `MelaAssistPanel`, when opening with existing `memory.currentTask` or `currentDraft`, show a "Welcome back — you were working on **{task}**" banner with `Continue` / `Start new` / `Discard` buttons (calls existing `send`, `reset`, and `clearMemory`).

## 2. Smart suggestions (role + page)
- Replace `getSuggestionsForRole` usage with `getPageContext(pathname, role).suggestions` inside the panel.
- Sets: Vendor (improve profile, create packages, portfolio audit, FAQs), Planner on event page (timeline, budget, vendors, guest list), Planner dashboard (continue draft, plan new event), Admin (review vendors, platform health, subscription metrics).

## 3. MelaAssist Insights card (collapsible)
- New `src/components/melaassist/MelaAssistInsights.tsx`: collapsible card with role-specific bullets computed from data already available on the page (props-driven). No new server calls.
- Mount on:
  - Planner dashboard (`src/routes/dashboard.tsx`): overdue tasks, missing vendor categories, budget %, timeline %.
  - Vendor dashboard (`src/routes/_authenticated/vendor.tsx`): profile completion %, photo count hint, packages count.
  - Admin (`src/routes/admin.index.tsx`): new users this week, vendor growth, active subscriptions.
- Each insight has a "Fix with MelaAssist" button that calls `openAssistant({ initialPrompt, task })`.

## 4. AI Activity Feed
- Reuse existing session `history` from `MelaAssistProvider`.
- New `src/components/melaassist/MelaAssistActivityFeed.tsx` — compact list showing last 5 executed actions with icons and a "Reopen" button that pushes a prompt back into the panel.
- Add to dashboard + vendor + admin index next to Insights.

## 5. Empty-state hooks
- Extend `src/components/page-empty-state.tsx` (or wrap) with an optional `assistantPrompt` prop that renders a "Do it with MelaAssist" CTA calling `openAssistant`.
- Wire empty states on: events index, vendor packages/FAQ sections, marketplace (planner side no vendors saved), budget, timeline, guest list.

## 6. AI Tips
- One dismissible tip per page context (stored in `sessionStorage` by key). Rendered in `MelaAssistSuggestions` and optionally under empty states.

## 7. Panel wiring
- `MelaAssistPanel` reads `context.pathname` and passes it to `getPageContext`.
- Greeting/suggestions swap live when route changes (pathname already reactive in context).
- Continue-work banner only shows when `!hasMessages && memory.currentTask`.

## 8. Performance
- All additions are presentation-only; no new server functions.
- Insights compute from existing loader data via props.
- Tips/continue-work state in local component + sessionStorage.

## 9. QA
- Manual pass: open assistant on `/dashboard`, `/vendor`, `/admin`, `/events`, `/events/$id`, `/marketplace`; verify greeting + suggestions differ.
- Verify Event Builder (`/events/ai-new`) and Vendor Profile Builder still function untouched.
- Verify approve/edit/regenerate flow unchanged.
- Mobile viewport (402px) — panel + insights card + activity feed stack cleanly.
- `bun run build` passes.

## Technical notes
- Files created:
  - `src/components/melaassist/page-context.ts`
  - `src/components/melaassist/MelaAssistInsights.tsx`
  - `src/components/melaassist/MelaAssistActivityFeed.tsx`
  - `src/components/melaassist/ContinueWorkBanner.tsx`
- Files edited:
  - `src/components/melaassist/MelaAssistPanel.tsx`
  - `src/components/melaassist/MelaAssistSuggestions.tsx`
  - `src/components/melaassist/suggestions.ts` (kept as thin re-export)
  - `src/routes/dashboard.tsx`
  - `src/routes/_authenticated/vendor.tsx`
  - `src/routes/admin.index.tsx`
  - `src/components/page-empty-state.tsx` (add optional CTA)
- No schema changes, no new server functions, no new provider.
