# MelaBridge Refinement Sprint — Execution Plan

This is a large sprint (16 areas). I'll execute in ordered batches, verifying between them so nothing regresses. No redesign — same theme, layout, branding.

Please confirm the batch order below (or tell me to reorder / drop items) and I'll start immediately.

## Batch 1 — Structural cleanup (fastest wins, unblocks other work)
1. **Remove Messaging entirely** (§1): delete `/messaging`, `/notifications`-message templates, scheduled reminders, email template registry surfaces, nav items, dashboard cards, command palette entries, search index refs. Rebalance sidebar spacing.
2. **Rename "Guest Target" → "Expected Guests"** (§7) everywhere (labels only; DB column `guest_target` stays).
3. **Remove `household` from Guests UI** (§5). Column stays in DB; hide from forms/tables. Add Role, Tags UI.
4. **Nav audit** (§13): remove duplicate CTAs, dead links surfaced by rg sweep.

## Batch 2 — Budget correctness (§3, §4, §8)
5. Replace Budget Summary cards → **Budget / Committed / Paid / Remaining**.
6. **"Add Line Item" modal** on `/budget` (currently links to event overview). Fields: Category, Description, Vendor, Estimated, Deposit, Paid, Due Date, Notes.
7. Make every budget row inline-editable (amount, name, paid, deposit, due date, notes, vendor, delete). Totals recompute live.

## Batch 3 — Runsheet & Tasks intelligence (§2, §6)
8. Rewrite `event-bootstrap.functions.ts` runsheet seeding: anchor to `event_time`, generate pre-event items with negative offsets (load-in, hair, makeup, decor, photographer, guest arrival), ceremony at T0, then post-event blocks. Templates per `event_type`.
9. Rewrite task due-date seeding: offsets counted back from `event_date` (venue -180d, photographer -150d, invites -90d, cake -45d, etc.). Only mark overdue when actually past today.
10. Runsheet edit UX: inline time edit, rename, delete, add, assign owner. (Drag & drop deferred unless required — will implement with dnd-kit if you confirm.)

## Batch 4 — Ticketing module (§9, §10)
11. Migration: `event_tickets`, `ticket_types`, `ticket_orders`, `ticket_attendees` with RLS + GRANTs. Add `tickets_enabled boolean` to `events`.
12. Event-create wizard: "Will this event require ticket sales or registration?" toggle. Auto-ON for Conference/Festival/Fundraiser/Community; OFF for Wedding/Birthday/Baby Shower/Graduation.
13. `/events/$eventId/tickets` tab: types CRUD, sales window, quantity, promo codes, custom questions, orders list, QR check-in stub, exports, analytics cards (sales, revenue, attendance, inventory).
14. Public `/tickets/$eventId` checkout page (Stripe via existing BridgePay integration; refund arch scaffolded but not wired).

## Batch 5 — AI, empty states, polish (§11, §12, §14, §15)
15. Extend `nl-commands.ts` MelaAssist parser: recognize the listed intents; dispatch to existing mutations.
16. Replace remaining blank pages with `PageEmptyState` (Guests, Budget, Files, Tickets, Runsheet).
17. Responsive sweep at 375/768/1280 via Playwright, screenshot every route, patch overflow/clipping.
18. Loading skeletons, delete confirms, success toasts across CRUD.

## Batch 6 — Final QA (§16)
19. Playwright walkthrough of full event lifecycle (create → guests → budget → runsheet → tickets → publish share link).
20. Console-error sweep, dead-link sweep, role-based nav check (Planner/Vendor/Professional).

## Notes / assumptions
- Preserving DB columns for anything I only hide in UI (safe rollback).
- Ticketing checkout uses the existing Stripe wiring; go-live requires publishable keys already in the project.
- Drag & drop for runsheet: I'll use `@dnd-kit/core` if you want it; otherwise inline up/down buttons only.
- "Email Templates" removal (§1): confirming you also want the *auth email templates* under `src/lib/email-templates/` gone, or only the in-app messaging templates? Auth emails (signup, magic link, recovery) are required by Supabase Auth — I'll keep those and remove only the in-app template registry.

**Reply "go"** to execute Batch 1 immediately, or tell me to reorder/split further. Given the size, I'd recommend approving batch-by-batch so you can review between.
