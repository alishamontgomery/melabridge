# MelaBridge Production Hardening Plan

This is a very large scope (21 sections, hundreds of sub-items). I can't ship all of it reliably in a single turn without producing shallow work or breaking things. I'll break it into sequenced phases, each independently shippable and verifiable. **Confirm the phase order (or reorder) and I'll start executing Phase 1 immediately.**

Some items in your list are **already built** from the last passes and only need audit/polish, not rebuild — I've flagged those so we don't duplicate work.

---

## Already in place (audit-only, not rebuild)

- 12-stage booking pipeline + `fn_apply_confirmation_rule` trigger (auto-Booked only when contract+deposit rule satisfied) — **§1, §2 core**
- `vendor_bookings`, `vendor_booking_events` (audit timeline), `vendor_booking_settings`, RLS + `is_booking_party`
- Notifications table + auto-notify on stage transitions — **§4 backend**
- Stripe checkout + subscriptions + webhook — **§14 core**
- Vendor profiles table, marketplace search, calendar module, messaging, tasks
- Auth email + app email scaffolding

## Rename only (no logic change) — §1

Your requested stage labels differ from what we shipped. Map:
- `saved` → keep internal, hide from client-facing UI
- `contacted` → **Inquiry**
- `quote_sent` → **Quote Sent**
- `quote_under_review` → **Quote Accepted** (when accepted) / drop "under review" label
- `contract_sent` → **Contract Sent**
- `contract_signed` (pre-deposit) → display as **Awaiting Deposit**
- `deposit_paid` (pre-contract) → display as **Awaiting Signature**
- `booked` → **Booked** (never shown as "Auto-Booked" in UI — already true)
- add **In Progress** (event started, not completed) + **Cancelled** as new stages
- `completed` → **Completed**

Pure label + 2 new stages (`in_progress`, `cancelled`). No pipeline rebuild.

---

## Proposed phase order

### Phase 1 — Booking lifecycle finalization (§1, §2, §5)
- Rename stage labels per above; add `in_progress` + `cancelled` enum values
- On transition to `booked`, trigger fires the automation fan-out: reserve `calendar_availability`, insert `calendar_events` block, create invoice row, create payment schedule rows, insert activity timeline entries, emit notifications to planner + vendor + client
- Booking detail page: full audit timeline (already have `vendor_booking_events`, add richer entries: quote_viewed, contract_viewed, invoice_created, payment_received, reminder_sent)
- Cancel action → `cancelled` stage + release calendar hold

### Phase 2 — Vendor calendar integrity (§3)
- Add DB constraint / trigger preventing overlapping `calendar_events` for the same vendor when `status='confirmed'`
- Respect `calendar_blocked_dates` + `calendar_availability` in marketplace availability filter
- Realtime subscription on `calendar_events` for vendor dashboard (no refresh)

### Phase 3 — Notification center (§4)
- New `/notifications` route with unread badge, mark read / mark all read, filter chips (booking/quote/payment/message/system), search, archive column, history pagination
- Header bell with realtime unread count
- Extend notification types enum

### Phase 4 — Payments completeness (§14)
- Invoice + payment_schedule tables (installments, balance due)
- Auto-generate on `booked`; auto-reminder cron for upcoming installments
- Payment history view per booking
- Prevent duplicate invoices (unique on booking_id + sequence)

### Phase 5 — Email templates (§6)
- Replace placeholder auth/app templates with branded MelaBridge templates for: booking confirmed, quote sent, contract sent, reminder, invoice, receipt, balance due, thank you, cancellation, review request
- Wire triggers to `sendTemplateEmail` on the matching booking events

### Phase 6 — Dashboards live data (§7)
- Audit each dashboard route, replace any static/mock widget with realtime queries (Supabase realtime channels on relevant tables)
- Vendor / Planner / Client / Admin — one pass each

### Phase 7 — Reviews (§15)
- After `completed`, cron emits `review_requested` notification + email
- Reviews table + submit form + vendor public response
- Aggregate rating on `vendor_profiles`

### Phase 8 — Marketplace + vendor profile polish (§8, §9)
- Vendor profile completeness checklist (logo, banner, gallery, packages, availability, FAQs, service areas)
- Marketplace: distance filter (needs coords), availability filter (joins `calendar_availability`), featured/verified flags, favorites, recently viewed
- Capture a Perfect Memory: package deep-links (each package card → `/vendor/capture-a-perfect-memory/packages/<slug>`), preserve pricing / images / CheckCherry embed exactly

### Phase 9 — Calendar sync (§11)
- Google Calendar via existing connector: two-way sync, imported events block availability
- Outlook + ICS import (one-way for ICS)

### Phase 10 — Messaging, tasks, event creation polish (§10, §12, §13)
- Event creation form: address autocomplete already wired — audit for duplicate Create buttons; add AI-approval gate before insert
- Messaging: attachments, templates, typing/read receipts (realtime), search, pin
- Tasks: templates by event type, auto-generation on event create

### Phase 11 — Dead-feature sweep + accessibility + perf (§16, §17, §18, §20)
- Route-by-route audit script: every `<Link>` target exists, every button has an onClick, every route has head() metadata
- Remove any remaining placeholder text / sample bookings / fake users
- Lighthouse pass, image lazy-load, query batching, empty/error states everywhere
- Playwright a11y sweep (keyboard nav, contrast)

### Phase 12 — Final QA (§21)
- End-to-end Playwright suite covering the four roles (vendor, planner, client, admin) through the full booking lifecycle
- Console error scan, network 4xx/5xx scan, security linter
- Produce a signed-off QA report

---

## What I need from you

1. **Approve this phase order** (or reorder — e.g. "do §6 emails before §4 payments").
2. **Confirm scope trims** if any: e.g. Apple Calendar ICS is one-way only; Outlook needs a new connector — OK?
3. **CheckCherry**: confirm the existing embed URL/pattern to preserve verbatim for Capture a Perfect Memory packages.

On approval, I'll start with **Phase 1** in the next turn and ship it end-to-end (migration + UI + Playwright verification) before moving on. Each phase ends with a working, deployable checkpoint.
