---
name: MelaBridge production-hardening pass 3
description: Full audit and repair of all known launch-blocking defects; what was found, fixed, and what remains.
---

## What was fixed (all in this pass)

### Budget (budget.tsx)
- Remaining formula was `budget - totalPaid`; corrected to `budget - totalCommitted` (committed = estimated_amount sum)
- Added `EditBudgetDialog` with local `budgetTarget` state override (avoids ecosystem re-fetch delay)
- Added over-budget banner when `totalCommitted > budgetTarget`
- Added `Unallocated` stat (budget minus committed)
- Edit pencil icon on Budget stat card opens the dialog directly

### Workspace (workspace.tsx)
- `${event.type} · ${event.location}` could render "null · null" — fixed with null filter
- Hardcoded florist contract suggestion removed, replaced with real MelaAssist CTA

### Guest Portal (guest-portal.tsx)
- All 4 metrics were hardcoded (180 invited, 132 confirmed etc) — replaced with real Supabase query
- "Copy link" button had no onClick — now copies `${window.location.origin}/e/${event.id}` to clipboard

### Reports (reports.tsx)
- Hardcoded "Active modules: 12" stat removed, replaced with real "Events with dates" count

### AdminOS (admin.index.tsx + admin-stats.functions.ts)
- `EmailDomainTestSection` now only renders on production domain (isProdHost gate added to AdminPage scope)
- "Audit log" module tile destination changed from `/reports` to `/analytics` (both were going to /reports)
- `openReports: 0` and `pendingRefunds: 0` hardcoded values removed; function now omits these fields so UI shows "—"
- Type updated to `openReports?: number; pendingRefunds?: number`

### App Shell (app-shell.tsx)
- `/ai-memory` removed from ADMIN_NAV — the ai-memory page linked to routes that 404 (bridgelive, bridgegraph etc.)
- Brain icon import removed

### Settings (settings.tsx)
- `/settings/calendar` (dead route) corrected to `/calendar/settings`

### Fundraising (fundraising.tsx)
- Hardcoded CAMPAIGNS and DONORS arrays with fake data replaced with a "Coming soon" page
- Admin-only via ROLE_EXCLUSIVE (unchanged)

### Timeline → Tasks deep-link (timeline.tsx + tasks.tsx)
- Milestone links now pass `search={{ highlight: m.id }}` to the tasks route
- tasks.tsx gained `validateSearch` to accept `highlight?: string`
- On mount, if `highlight` param is present, tasks.tsx auto-opens the matching TaskDetailDialog
- All other `/tasks` Link components updated to pass `search={{ highlight: undefined }}`
- `TodaysFocus.tsx` navigate call updated to pass `search: { highlight: focus.taskId }`

### Files (files.tsx)
- Rename functionality added: `rename` useMutation + `RenameDialog` component
- All desktop table buttons given `aria-label="Rename/Download/Delete {filename}"`
- Mobile card buttons already had generic aria-labels; updated to include filename
- Pencil (rename) button added to both mobile card and desktop table rows

### Vendor Portal (vendor-portal.tsx)
- "Complete vendor profile" CTA linked to `/profile` — corrected to `/vendor-profile-builder`

### BridgePilot (bridgepilot.tsx)
- `upcomingBookings` was hardcoded 0; now queries `calendar_events` table filtered by `vendor_id = uid` and `starts_at >= today`

## What was confirmed working (no changes needed)

- **Tasks**: Opening task = detail dialog (NOT auto-complete); complete = separate deliberate action ✓
- **Guests**: RSVP stat cards (Attending/Maybe/Pending/Declined) are interactive and filter the guest list ✓
- **RSVP enum**: `yes | no | maybe | pending` matches DB schema ✓
- **MelaAssist**: Real data context, explicit approval flow, no silent DB mutations ✓
- **Runsheet**: Real DB data via event_runsheet_items ✓
- **Calendar**: Real data — booking requests, conflict detection, vendor settings all functional ✓
- **Bookings**: Real Supabase data, live subscriptions ✓
- **Events**: Real data, AI builder requires per-item approval ✓
- **Marketplace**: Real vendor data, no dead clicks, contact/lead actions work ✓
- **Auth**: All protected routes gate correctly; admin server functions enforce RBAC ✓
- **Build**: TypeScript 0 errors, production build succeeds ✓

## Known remaining limitations (not launch blockers)

- Fundraising module is coming-soon (admin-only)
- Vendor profile builder AI saves 3 fields directly; FAQs/Packages sections are preview-only (intentional)
- openReports and pendingRefunds show "—" in AdminOS — no reports queue table exists yet
- EmailDomainTestSection only visible on melabridge.com domain
- Stub admin routes (bridgedna, digital-twin, decisions, travel, concierge, collaboration) accessible by direct URL but gated to admin role via ROLE_EXCLUSIVE — none appear in nav

**Why:** removeHardcoded0 fields vs returning null: TypeScript type was `number`, changing to `number | undefined` lets the `fmt` function show "—" naturally without fake data.

**How to apply:** Budget remaining = `event.budget - totalCommitted` (estimated_amount sum), never `- totalPaid`. The localBudget state override pattern should be used whenever a stat is edited inline to avoid a full ecosystem re-fetch.
