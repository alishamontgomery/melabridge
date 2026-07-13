# Vendor Booking Lifecycle — Core Platform Redesign

Replace the flat "Booked" flag with a full 12-stage booking pipeline that becomes the single source of truth across Planner Dashboard, Vendor Portal, Marketplace, CRM, Notifications, and Analytics.

## 1. Data model (migration)

New enum + table + supporting rows.

```text
booking_stage enum:
  saved | contacted | consultation_scheduled | quote_sent |
  quote_under_review | contract_sent | contract_signed |
  deposit_paid | booked | completed | review_requested | reviewed

booking_confirmation_rule enum:
  contract_only | deposit_only | contract_and_deposit | manual
```

- `vendor_bookings` — one row per planner↔vendor engagement
  - planner_id, vendor_id (vendor_profiles.id), event_id (nullable)
  - category, title, current_stage, confirmed_at
  - quote_amount, deposit_amount, deposit_paid_amount, total_paid
  - contract_sent_at, contract_signed_at, deposit_paid_at, completed_at
  - notes, created_by
- `vendor_booking_events` — immutable stage history (stage, actor_id, note, occurred_at)
- `vendor_settings` — one row per vendor: `confirmation_rule` (default `contract_and_deposit`), `requires_deposit`, `auto_advance` bool

RLS + GRANTs:
- planner and vendor on the booking can select/update; only planner or vendor can insert stage events
- vendor_settings: vendor owns their row

Trigger `fn_apply_confirmation_rule()`:
- On insert into `vendor_booking_events`, evaluates the vendor's `confirmation_rule` against the booking's flags and, if satisfied, inserts a `booked` stage event and stamps `confirmed_at` — guarantees "never Booked before requirements met" server-side.
- Also emits a `notifications` row for both planner and vendor with a `/bookings/{id}` deep link.

## 2. Shared UI kit

`src/lib/booking-stages.ts`
- Ordered stage list with `{ key, label, icon, color, group }` (group = discovery / negotiation / contract / payment / delivered).
- Helpers: `stageIndex`, `nextStage`, `progressPct`, `isConfirmed`.

`src/components/booking/`
- `BookingStageBadge.tsx` — icon + label + semantic color chip.
- `BookingProgressTracker.tsx` — horizontal stepper with ✓ / ⏳ / • markers and "Current status" caption.
- `BookingStageSelect.tsx` — action menu that dispatches the correct server fn.

All colors go through existing semantic tokens (`--primary`, `--gold`, `--muted`, `--destructive`, plus two new tokens `--stage-progress` / `--stage-complete` in `src/styles.css`).

## 3. Server functions (`src/lib/bookings.functions.ts`)

All `requireSupabaseAuth`:
- `listPlannerBookings`, `listVendorBookings`, `getBooking`
- `createBooking` (planner saves a vendor → `saved`)
- `advanceStage({ bookingId, stage, meta })` — validates transition, inserts stage event; trigger handles auto-`booked`
- `recordQuote`, `sendContract`, `signContract`, `recordDeposit`, `recordFinalPayment`, `markCompleted`, `requestReview`, `submitReview`
- `updateVendorConfirmationRule`

## 4. Screens

### Planner
- `/_authenticated/bookings/index.tsx` — table of bookings with `BookingProgressTracker` inline; filter by stage/event/category.
- `/_authenticated/bookings/$id.tsx` — full timeline, stage history, contract & payment panels, actions.
- Planner dashboard widget: "Vendors in progress" using the tracker.

### Vendor
- `/_authenticated/vendor.tsx` gains a Bookings tab (leads list + tracker + action buttons: Send Quote, Schedule Consultation, Send Contract, Record Deposit, Record Final Payment, Mark Completed).
- New `/_authenticated/vendor/settings.tsx` — **Booking Confirmation Rules** section (4 radio options, default Contract Signed + Deposit Paid) + toggle "Requires deposit".

### Marketplace / CRM
- Vendor card gains a "Save vendor" action → creates a booking in `saved`.
- CRM view (existing `/vendors`) shows current stage per vendor.

### Notifications
- Existing notifications route already renders rows; the DB trigger inserts stage-transition notifications with `href = /bookings/{id}`. Add stage icons to the row renderer.

### Analytics
- Add a "Bookings funnel" section to `/analytics` powered by a server fn that groups `vendor_booking_events` by stage.

## 5. Guardrails

- `advanceStage` rejects manual jumps to `booked`; only the trigger writes it (except when `confirmation_rule = 'manual'`, in which case a dedicated `confirmBookingManually` fn is required and audited).
- All stage writes require the actor be a member of the booking (RLS + server check).
- Future integrations (e-sign, Stripe, calendar, AI follow-ups) plug in by calling the same `advanceStage` / `recordDeposit` fns — no additional status surface.

## 6. Rollout

1. Migration (enums, tables, trigger, RLS, GRANTs, default vendor_settings backfill).
2. Shared stage kit + components.
3. Server fns.
4. Planner bookings screens + dashboard widget.
5. Vendor bookings tab + settings screen.
6. Marketplace "Save vendor" + CRM stage column.
7. Analytics funnel + notification icon polish.
8. Playwright sweep: save → quote → contract → deposit → auto-Booked; manual rule path; completed → review.

## Out of scope (explicitly deferred)

- Actual e-signature provider integration (stubs `contract_signed_at` via a "Mark signed" action).
- Live Stripe deposit capture (records amounts; wiring to Stripe webhook is a follow-up but the schema supports it).
- Calendar auto-holds on consultation scheduling.

Confirm and I'll implement in the order above.
