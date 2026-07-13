
# Final Launch QA — Plan

Scope: launch-blockers only. Not a Lighthouse tune-up or exhaustive pixel audit. Delivered in 4 batches so each is reviewable and reversible.

## Batch A — Seed test accounts + data (dev/preview only)

Create a **guarded** migration + server function that seeds five accounts and realistic data. Guarded means: refuses to run unless `LOVABLE_ENV != 'production'` AND caller is admin. No test data ever lands in prod.

**Accounts** (password `MelaTest!2026` for all):
- admin@test.melabridge.com — Admin role
- planner@test.melabridge.com — Planner
- vendor@test.melabridge.com — Vendor (approved vendor_profile)
- attendee@test.melabridge.com — Attendee (event guest w/ ticket)
- guest@test.melabridge.com — Guest (RSVP only)

**Per-account seed data**:
- Planner: 3 events (draft/upcoming/completed), 8 guests w/ RSVPs, 5 tasks, 6 budget items, 4 timeline items, 3 files in BridgeVault, 1 conversation w/ vendor, 2 notifications, 1 active subscription (sandbox).
- Vendor: complete vendor_profile, 2 services w/ pricing, 3 inquiries, 1 booking, 2 reviews.
- Attendee: 1 purchased ticket (sandbox), RSVP=yes, notifications.
- Guest: 1 pending RSVP invite.
- Admin: view of all above (no owned data).

Exposed as `/admin` button "Seed test data" (admin-only, dev-only). Also a "Wipe test data" counterpart that deletes rows tagged `is_test_seed = true` (new nullable column, defaulted false — production data unaffected).

## Batch B — Playwright QA pass by role

Log in as each of the 5 accounts, crawl main routes, capture:
- Console errors + failed network requests
- 404s / broken links / dead buttons
- Missing empty/loading/error states on core flows
- Mobile viewport (390×844) layout breaks on top 15 routes
- RLS/permission leaks (e.g. attendee hitting `/admin`)

Output: `/tmp/qa/report.md` with route × role × issue matrix + screenshots. Shared with you before Batch C.

## Batch C — Fix blockers

From the QA report, fix in priority order:
1. Any auth/signup/reset/verify flow breakage
2. Any Stripe checkout/webhook/portal breakage (sandbox + live)
3. Broken links & dead primary CTAs
4. Missing 404 & 500 pages (add `src/routes/__root.tsx` notFound + errorComponent polish)
5. Remaining mock data on user-facing pages
6. Role gate leaks
7. Mobile layout breaks on top-level routes
8. Console errors visible in normal use

Not in scope this pass (call out in report, not fix): deep a11y (WCAG AA audit), Lighthouse ≥90 tuning, exhaustive image replacement, full timezone matrix testing, Android device testing (iOS Safari + Chrome desktop + 390px mobile viewport only).

## Batch D — Launch verification

- Verify `hello@melabridge.com` is the sender on all 6 auth email templates + any transactional templates; check email domain status.
- Verify Stripe go-live status; if live keys present, test one live checkout end-to-end (won't charge — void the payment intent) and confirm webhook writes to `subscriptions` with `environment='live'`.
- Confirm Terms/Privacy/Contact/Help/FAQ routes are populated (no lorem/todo).
- Grep codebase for `TODO`, `FIXME`, `mock`, `dummy`, `lorem`, `test@example`, `Placeholder`, `console.log` in user paths.
- Confirm seed data wipe works; seed button hidden in production build.
- Produce final `LAUNCH_REPORT.md` at repo root: what was fixed, what's known-open, sign-off checklist.

## What I'll need from you between batches

- After Batch A: approve the migration (I'll surface it for review).
- After Batch B: skim the QA report — you may want to reprioritize or expand scope.
- After Batch D: read the launch report before hitting Publish.

## Technical notes

- Seed guard uses a Postgres function `public.assert_non_production()` that raises unless the env allows it; server function double-checks admin role via `has_role(auth.uid(), 'admin')`.
- New column `is_test_seed boolean default false` added to events, guests, tasks, budget_items, timeline items, files, conversations, notifications, vendor_profiles, subscriptions, tickets — makes wipe surgical.
- Playwright runs headless in the sandbox against `http://localhost:8080`; screenshots to `/tmp/qa/screens/`.
- Stripe live verification uses `stripe.paymentIntents.cancel` immediately after auth, so no real charge lands.
- No changes to `client.ts`, `types.ts`, `.env`, `supabase/config.toml`.

## Estimated size

- Batch A: 1 migration + 2 server functions + 1 admin UI button (~400 lines).
- Batch B: 1 Playwright script + report (no product code).
- Batch C: variable — will report back a fix count before starting each cluster.
- Batch D: verification only, minimal code.

Ready to start Batch A on your go-ahead.
