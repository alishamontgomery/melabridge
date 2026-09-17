# Threat Model

## Project Overview

MelaBridge is an AI-native event planning SaaS platform built with TanStack Start (SSR React), Supabase (auth + database), Stripe (payments), and Tailwind CSS. Users include event planners, vendors, event guests, and platform admins. The application supports event creation and management, guest RSVP, ticketing (paid and free), vendor bookings, team collaboration, and AI-assisted planning.

## Assets

- **User accounts and sessions** – email addresses, hashed passwords, session tokens. Compromise allows impersonation and access to event data.
- **Guest PII** – guest names, email addresses, meal choices, RSVP status, phone numbers. Stored in `guests` and `ticket_orders` tables.
- **Ticket buyer data** – buyer name, email, payment amount, QR codes, order IDs. Sensitive because it contains financial and contact information.
- **Application secrets** – `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `SESSION_SECRET`, `CRON_SECRET`, `GOOGLE_PLACES_API_KEY`. Compromise of any of these allows severe data access, payment fraud, or provider abuse.
- **Event data** – budgets, vendor relationships, schedules, communications. Business-sensitive.
- **Stripe payment intents and subscription records** – subscription status, payment history, refund state.

## Trust Boundaries

- **Browser / Server** – All client requests cross this boundary. The server must authenticate and authorize every request. The `_authenticated` route layout enforces this client-side only (`ssr: false`); server functions each carry their own `requireSupabaseAuth` middleware for true server-side enforcement.
- **Server / Supabase Database** – The application uses two Supabase clients: the user-scoped JWT client (subject to RLS policies) and the service-role admin client (bypasses RLS). All admin-client usage must be preceded by an application-layer authorization check.
- **Server / Stripe** – Webhook payloads are verified with HMAC-SHA256 using `PAYMENTS_SANDBOX_WEBHOOK_SECRET` / `PAYMENTS_LIVE_WEBHOOK_SECRET`. Stripe API calls use `STRIPE_SECRET_KEY`. NOTE: the Stripe environment (sandbox vs live) is currently derived from a **client-supplied** `environment` field on checkout/finalize/refund/webhook, not solely from server config — see EoP.
- **Public / Authenticated** – Most server functions require `requireSupabaseAuth`. Public exceptions include `getPublicEventTickets`, `createTicketCheckout`, `finalizeTicketOrder`, `getPublicOrderDetails`, `getTicketByCode`, `lookupGuestRsvp`, `submitGuestRsvp`, and the cron health-check GET.
- **Authenticated / Admin** – Admin server functions assert admin role after authentication using `assertAdmin(ctx)`.
- **Staff check-in (token-based)** – The `/staff-checkin` route uses time-limited, revocable cryptographic tokens stored as SHA-256 hashes. This is a separate trust boundary allowing unauthenticated staff to perform check-ins.

## Scan Anchors

- **Server entry points**: `src/routes/api/public/payments/webhook.ts`, `src/routes/api/cron/process-scheduled-messages.ts`, `src/routes/api/public/marketplace/google.ts` (unauthenticated), `src/routes/api/public/calendar.$token.ts`.
- **Authenticated server functions**: `src/lib/*.functions.ts` – all use `requireSupabaseAuth` middleware.
- **High-risk areas**: `src/lib/tickets.functions.ts` (payment + ticketing), `src/lib/admin-users.functions.ts` (user management), `src/lib/event-comms.functions.ts` (email sending), `src/lib/calendar.functions.ts` (client-controlled `planner_id`), `src/lib/vendor-sourcing.functions.ts` + `src/lib/vendor-ai.functions.ts` (server-side URL fetches / SSRF).
- **Public endpoints (no auth required)**: `getPublicOrderDetails`, `getTicketByCode`, `getPublicEventTickets`, `createTicketCheckout`, `finalizeTicketOrder`, `lookupGuestRsvp`, `submitGuestRsvp`, `getCheckinDataWithToken`, `checkInByQrCodeWithToken`, `/api/public/marketplace/google`.
- **Service-role (admin) client**: `src/integrations/supabase/client.server.ts` — the #1 IDOR/privesc hotspot; every use must be preceded by an app-layer authz check.
- **Dev-only areas**: `src/lib/test-seed.functions.ts` (guarded by `SEED_TEST_DATA_ALLOWED` and `NODE_ENV !== "production"`).

## Threat Categories

### Spoofing

Authentication uses Clerk sessions verified server-side; `requireSupabaseAuth` provisions the identity and injects a user-scoped RLS Supabase client. RSVP one-click tokens are HMAC-SHA256 signed with `SESSION_SECRET`. Staff check-in tokens are SHA-256 hashed before storage and are event-bound, expiring, and revocable. Stripe webhook signatures are verified with HMAC-SHA256. The cron endpoint is protected by a Bearer `CRON_SECRET`.

**Required guarantees**: `SESSION_SECRET` and all webhook secrets must be set in production.

### Tampering

Ticket prices are read server-side from the database at checkout time; the client only sends `ticketTypeId` and `quantity`. Quantity limits and promo-code validation are enforced server-side (no price-tampering path found). RSVP token payloads are HMAC-signed and include expiry.

**Open issue**: `createEvent`/`updateEvent` in `calendar.functions.ts` accept a client-controlled `planner_id` and spread it into the row, letting a vendor inject events into any user's calendar (integrity/spoofing). See `access-control-idor`.

### Information Disclosure

- Guest PII is protected by Supabase RLS restricting access to event owners/members.
- Ticket buyer PII is exposed via `getPublicOrderDetails` only when the caller holds the order's UUID access token (confirmed present).
- The `SUPABASE_PUBLISHABLE_KEY` and Stripe publishable key are intentionally public and do not grant privileged access.

### Denial of Service

- No explicit rate limiting on public endpoints (`createTicketCheckout`, `lookupGuestRsvp`, `/api/public/marketplace/google`). The unauthenticated marketplace/google endpoint additionally issues server-side outbound fetches, amplifying abuse potential.

### Elevation of Privilege

- Admin routes use `assertAdmin` with a server-side database check **before** any service-role/privileged operation (verified across all `admin-*.functions.ts`). `provisionClerkIdentity` binds identities to verified Clerk emails and does not trust client-supplied admin role fields.
- RLS policies on `ticket_types`, `ticket_orders`, `ticket_attendees`, `events`, `guests` restrict writes to event owners/members.
- `resendOrderConfirmation` now performs an explicit owner check (the previously noted gap is closed).
- **Confirmed (HIGH)**: `refundTicketOrder` (`tickets.functions.ts:595-641`) only reads the order via the RLS client and never verifies event ownership/finance role; the `ticket_orders` SELECT policy grants any `event_members` row visibility, so any low-privilege member can trigger a service-role Stripe refund + `apply_ticket_refund`. See `ticketing-payments`.
- **Confirmed (HIGH)**: `createTicketCheckout`/`finalizeTicketOrder`/`refundTicketOrder`/webhook accept a client-supplied Stripe `environment`; if `STRIPE_SANDBOX_SECRET_KEY` + sandbox payouts/webhook are configured in production, a buyer can finalize a real order with a test-mode payment. See `ticketing-payments`.
- **Confirmed (MEDIUM)**: `team.functions.ts` notification/invite endpoint checks event membership but not owner/editor role, letting viewers/commenters send in-app notifications and invite emails to arbitrary recipients via the service-role client. See `access-control-idor`.
- **Confirmed (HIGH, SSRF)**: `resolveGoogleBusinessSearchUrl` (reached unauthenticated via `/api/public/marketplace/google?query=`) and `generateVendorProfileDraft` fetch user-controlled URLs with `redirect: "follow"` and no final-destination IP validation. See `ssrf`.
