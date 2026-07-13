# MelaBridge Calendar v1 — Native Scheduling

Replace the current OAuth-based calendar sync flow with a self-contained scheduling system. External providers become "Coming Soon" placeholders; no OAuth, no credentials, no user setup.

## 1. Remove external sync from the MVP

Delete these files:
- `src/routes/api/oauth/google-calendar.start.ts`
- `src/routes/api/oauth/google-calendar.callback.ts`
- `src/routes/api/oauth/outlook-calendar.start.ts`
- `src/routes/api/oauth/outlook-calendar.callback.ts`
- `src/routes/api/public/calendar.$token.ts` (ICS feed)

Keep the `calendar_connections` and `calendar_sync_map` tables in the DB (harmless, reserved for future two-way sync). Do not reference them in the UI.

Rewrite `src/routes/_authenticated/settings.calendar.tsx` so it only shows a disabled "External Calendar Sync" card with three greyed rows:
- Google Calendar — Coming Soon
- Microsoft Outlook — Coming Soon
- Apple Calendar — Coming Soon

No copy URL, no rotate token, no connect buttons, no instructions.

Strip ICS/OAuth server functions from `src/lib/calendar.functions.ts` (getIcsUrl, listCalendarConnections, disconnectCalendar).

If onboarding prompts a calendar connection anywhere, remove that step.

## 2. New database schema (native calendar)

One migration adds:

**`calendar_availability`** — vendor weekly business hours
- `user_id`, `weekday` (0–6), `start_time`, `end_time`, `is_active`
- Multiple rows per weekday allowed (multiple windows).

**`calendar_blocked_dates`** — days off / vacation
- `user_id`, `start_date`, `end_date`, `reason` (`day_off` | `vacation` | `travel`), `notes`

**`calendar_settings`** — per-vendor rules
- `user_id` PK, `buffer_before_minutes`, `buffer_after_minutes`, `max_events_per_day`, `block_travel_days`, `vacation_start`, `vacation_end`

**`calendar_events`** — the actual bookings
- `id`, `vendor_id`, `planner_id` (nullable), `event_id` (nullable link to `events`), `client_name`, `event_name`, `event_type`, `venue_name`, `address`, `starts_at`, `ends_at`, `setup_minutes`, `breakdown_minutes`, `status` (`inquiry` | `pending` | `confirmed` | `completed` | `cancelled` | `declined`), `internal_notes`, `payment_status`, `contract_status`, `checklist` jsonb, `attachments` jsonb, `team_assignments` jsonb, `timeline` jsonb, `source` (`native` | `external`, defaults `native` — reserved for future sync), `external_provider`, `external_id`

**`calendar_booking_requests`** — planner-initiated requests / alternate proposals
- `id`, `booking_id` (nullable — created once approved), `vendor_id`, `planner_id`, `requested_start`, `requested_end`, `message`, `status` (`pending` | `approved` | `declined` | `alternate_proposed`), `alternate_start`, `alternate_end`, `alternate_message`

All tables: `GRANT` to `authenticated` + `service_role`, RLS enabled, policies scoped so vendors manage their own rows and planners see rows where they're the `planner_id`.

## 3. Server functions (`src/lib/calendar.functions.ts`)

Replace the file with:
- `getCalendarSettings`, `updateCalendarSettings`
- `listAvailability`, `upsertAvailability`, `deleteAvailability`
- `listBlockedDates`, `addBlockedDate`, `deleteBlockedDate`
- `listEvents({ from, to, status?, type?, q? })`
- `getEvent(id)`, `createEvent`, `updateEvent`, `duplicateEvent`, `cancelEvent`, `completeEvent`
- `requestBooking` (planner)
- `respondToBookingRequest({ id, action: 'approve' | 'decline' | 'propose_alternate', ... })`
- `getDashboardSummary` — today's events, upcoming, pending approvals, monthly count, revenue sum, availability status
- `checkConflicts({ start, end, setup_minutes, breakdown_minutes, excludeId? })` — used before approval to prevent overlap; returns conflict list with reason (event/setup/breakdown/travel/blocked/vacation/max-per-day)

## 4. UI

New routes (all under `_authenticated`):
- `/calendar` — main calendar with Month/Week/Day/Agenda tabs, status color legend, filters (type, status), search
- `/calendar/settings` — availability windows, blocked dates, vacation mode, buffers, max/day, travel-day toggle
- `/calendar/requests` — pending booking requests with Approve / Decline / Propose Alternate
- `/calendar/events/$id` — full event detail (all fields, timeline, checklist, attachments, team, payment/contract status)
- `/calendar/dashboard` — today, upcoming, pending, monthly count, revenue, availability summary

Update `/settings` to link to `/calendar/settings` (replacing the old calendar sync link).
Update `/settings/calendar` to the "Coming Soon" placeholder described above.
Add "Calendar" entry to `AppShell` nav.

Color tokens for statuses use existing semantic tokens (add to `src/styles.css` if missing): inquiry=muted, pending=amber, confirmed=primary, completed=emerald, cancelled=rose.

## 5. Conflict / protection logic

`checkConflicts` runs on:
- Vendor approving a request
- Vendor creating/editing an event
- Planner requesting a date (soft warning only)

Rules:
- Overlap with existing confirmed event's `[starts_at - setup, ends_at + breakdown]` window → hard block on approve.
- Overlap with buffer_before/after settings → warning.
- Overlap with blocked date / vacation → hard block.
- `max_events_per_day` exceeded → hard block.
- `block_travel_days` on and different city than adjacent booking → warning.

## 6. Planner vs vendor experience

Role gate via existing `has_role`:
- Vendor sees: settings, requests inbox, full event CRUD, complete/duplicate, dashboard.
- Planner sees: request form, their own request statuses, notifications when approved, propose-alternate reply.

Notifications reuse the existing `notifications` table (category `calendar`).

## 7. Future-sync friendliness

`calendar_events.source`, `external_provider`, `external_id` columns exist from day one so a later job can push/pull without a schema migration. `calendar_connections` / `calendar_sync_map` stay untouched.

## Technical notes

- All new server fns use `.middleware([requireSupabaseAuth])`.
- Loaders in `_authenticated/*` may call them; public routes must not.
- Types regenerate after the migration; UI + fns land after that step.
- No new secrets, no OAuth, no ICS.
