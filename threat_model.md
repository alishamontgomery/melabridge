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
- **Server / Stripe** – Webhook payloads are verified with HMAC-SHA256 using `PAYMENTS_SANDBOX_WEBHOOK_SECRET` / `PAYMENTS_LIVE_WEBHOOK_SECRET`. Stripe API calls use `STRIPE_SECRET_KEY`.
- **Public / Authenticated** – Most server functions require `requireSupabaseAuth`. Public exceptions include `getPublicEventTickets`, `createTicketCheckout`, `finalizeTicketOrder`, `getPublicOrderDetails`, `getTicketByCode`, `lookupGuestRsvp`, `submitGuestRsvp`, and the cron health-check GET.
- **Authenticated / Admin** – Admin server functions assert admin role after authentication using `assertAdmin(ctx)`.
- **Staff check-in (token-based)** – The `/staff-checkin` route uses time-limited, revocable cryptographic tokens stored as SHA-256 hashes. This is a separate trust boundary allowing unauthenticated staff to perform check-ins.

## Scan Anchors

- **Server entry points**: `src/routes/api/public/payments/webhook.ts`, `src/routes/api/cron/process-scheduled-messages.ts`
- **Authenticated server functions**: `src/lib/*.functions.ts` – all use `requireSupabaseAuth` middleware
- **High-risk areas**: `src/lib/tickets.functions.ts` (payment + ticketing), `src/lib/admin-users.functions.ts` (user management), `src/lib/event-comms.functions.ts` (email sending)
- **Public endpoints (no auth required)**: `getPublicOrderDetails`, `getTicketByCode`, `getPublicEventTickets`, `createTicketCheckout`, `finalizeTicketOrder`, `lookupGuestRsvp`, `submitGuestRsvp`, `getCheckinDataWithToken`, `checkInByQrCodeWithToken`
- **Service-role (admin) client**: `src/integrations/supabase/client.server.ts`
- **Dev-only areas**: `src/lib/test-seed.functions.ts` (guarded by `SEED_TEST_DATA_ALLOWED` and `NODE_ENV !== "production"`)

## Threat Categories

### Spoofing

Authentication uses Supabase JWTs verified server-side on every server function via `requireSupabaseAuth`. RSVP one-click tokens are HMAC-SHA256 signed with `SESSION_SECRET`. Staff check-in tokens are SHA-256 hashed before storage. Stripe webhook signatures are verified with HMAC-SHA256 per Stripe's specification. The cron endpoint is protected by a Bearer `CRON_SECRET`.

**Required guarantees**: `SESSION_SECRET` must be kept secret. All webhook secrets must be set in production.

### Tampering

Ticket prices are read server-side from the database at checkout time; the client only sends `ticketTypeId` and `quantity`. Quantity limits and promo-code validation are enforced server-side. RSVP token payloads are HMAC-signed and include expiry. The service-role admin client is used for atomic state transitions (ticket finalization, refunds via RPC).

**Required guarantee**: Clients must never supply pricing or authorization data that the server accepts without re-validation.

### Information Disclosure

- Guest PII (names, emails, RSVPs) is protected by Supabase RLS which restricts access to event owners/members.
- Ticket buyer PII (buyer_name, buyer_email, amount_cents) is exposed unauthenticated via `getPublicOrderDetails` by orderId UUID. This is the primary open information-disclosure concern.
- Email addresses are logged to stderr in `event-comms.functions.ts` on send failure.
- The `SUPABASE_PUBLISHABLE_KEY` and Stripe publishable key (`pk_live_*`) are exposed in the browser bundle; these are designed-to-be-public keys and do not grant privileged access.
- All admin-client operations are preceded by `assertAdmin` checks.

### Denial of Service

- No explicit rate limiting is implemented on public endpoints (`createTicketCheckout`, `lookupGuestRsvp`, `joinTicketWaitlist`). Supabase and Stripe have their own rate limits.
- The AI (`askMelaAssist`, `bootstrapEventPlan`) is guarded by `requireSupabaseAuth`, limiting unauthenticated DoS.

### Elevation of Privilege

- Admin routes use `assertAdmin` with a server-side database check.
- RLS policies on `ticket_types`, `ticket_orders`, `ticket_attendees`, `events`, `guests` restrict writes to event owners/members.
- `updateTicketType` and `deleteTicketType` rely on Supabase RLS (confirmed: "Event owners can update/delete ticket types" policy) rather than application-layer ownership checks.
- The `resendOrderConfirmation` server function is missing an ownership check: any authenticated user can trigger confirmation email resend for any order UUID. This is a privilege escalation in email-send capability.
