---
name: MelaBridge repair pass 2
description: Interaction fixes applied across Today's Focus, Timeline, Vendor Dashboard, Tasks, Guests, Budget, Calendar — what changed and why.
---

## What was fixed

**Today's Focus** (`src/components/dashboard/todays-focus.tsx`)
- Removed silent task-completion on CTA click. When `focus.taskId` is set, button now navigates to `/tasks` so user completes it explicitly. `onCompleted` prop removed; dashboard.tsx updated to match.

**Timeline** (`src/routes/timeline.tsx`)
- Non-event-day milestone titles are now `<Link to="/tasks">` so they are clickable. Event-day sentinel stays plain text.

**Tasks dialog** (`src/routes/tasks.tsx`)
- Added `description`/notes `Textarea` field to `TaskDetailDialog`. Saved as `description` column in patch.

**Vendor Dashboard** (`src/routes/_authenticated/vendor.tsx`)
- QUICK_ACTIONS: "Marketplace Listing" → `/vendor-profile-builder`, "AI Draft Inbox" removed/replaced with "Notifications" → `/notifications`, "Calendar Sync" → `/calendar/settings`.
- ModuleTile "Tasks" → `/tasks` (was `/vendor-portal`), ModuleTile "Marketplace Listing" → `/vendor-profile-builder` (was `/profile`).
- `ListCard` items: each `<li>` now wraps content in `<Link to={it.href}>` — previously dead text.
- "Today's tasks" list items: each `<li>` wraps in `<Link to="/tasks">`.
- Notification list items: each `<li>` wraps in `<Link to="/notifications">`.

**Calendar role guard** (`src/components/app-shell.tsx`)
- Added ROLE_EXCLUSIVE entries: `/calendar/requests`, `/calendar/dashboard`, `/calendar/settings` → vendor + admin only. Personal/organization users are redirected to their home on direct access.

**Budget event tab** (`src/routes/_authenticated/events/$eventId.tsx`)
- Added edit button (Pencil icon) per row in BudgetTab.
- Added `editItem` state + `saveEdit` function + edit Dialog with category/label/budgeted/spent/paid fields.

**Guests event tab** (`src/routes/_authenticated/events/$eventId.tsx`)
- Added edit dialog to GuestsTab: guest name is now a clickable button, plus a Pencil icon per row.
- Added `editGuest` state + `saveGuestEdit` function + Dialog with name/email/household/RSVP/plus-ones/meal fields.
- Added Dialog import to the file.

**Guests route mobile** (`src/routes/guests.tsx`)
- RSVP Badge in table now hidden on mobile (`hidden sm:inline-flex`) — Select dropdown alone carries the value, preventing cramped layout.

## Key architectural notes
- `saveVendorProfileDraft` in vendor-ai.functions.ts only saves business_name, business_category, business_description — no other draft fields map to vendor_profiles columns. This is intentional; other sections are copy-paste only.
- Calendar sub-routes (/calendar/requests, /calendar/dashboard, /calendar/settings) are vendor-specific; `/calendar` and `/calendar/index` are planner-accessible.
- The Select in GuestsTab edit dialog uses `name="rsvp"` with FormData — works because Radix Select is a native select under the hood when inside a form.
