---
name: MelaBridge production audit pass 5
description: Button/UX audit and live infrastructure fixes applied August 2026.
---

# MelaBridge Production Audit Pass 5

## Infrastructure fix: Logo upload (vendor-assets bucket)
- vendor-assets storage bucket did NOT exist in Supabase — no migrations defined it
- Created live via Storage API (service_role key), then applied 4 RLS policies via Management API:
  - public read (SELECT on bucket_id='vendor-assets')
  - authenticated upload (INSERT scoped to 'logos/{auth.uid()}/%')
  - authenticated update (UPDATE same scope)
  - authenticated delete (DELETE same scope)
- Policies confirmed present via pg_policies query
- Bucket set to public=true, fileSizeLimit=5MB
- Logo path format: `logos/{user.id}/{timestamp}.{ext}` — must match policy LIKE pattern

## Code fixes applied
- calendar.dashboard.tsx: pending approval rows changed from non-clickable `<div>` → `<Link to="/calendar/requests">` with hover state
- dashboard.tsx (planner): EmptyDashboard now has primary "Create your first event" hero button alongside "Try with sample data"
- admin.index.tsx: stat label "Vendor applications" → "Awaiting review"
- vendor-settings.tsx: error state "Open profile" link fixed /profile → /vendor-profile-builder

## Stripe status
- Stripe connector accepted (conn_stripe_01KZ6JSJQFNBNJNDP9S7ZR8A8Z, added)
- All Stripe code is fully built in stripe.ts + stripe.server.ts + payments.functions.ts + subscription.tsx
- stripe.server.ts: uses STRIPE_SECRET_KEY directly if set (standard Replit path); falls back to Lovable gateway
- Client needs VITE_PAYMENTS_CLIENT_TOKEN (publishable key, pk_test_ or pk_live_)
- Webhook verification uses PAYMENTS_SANDBOX_WEBHOOK_SECRET or PAYMENTS_LIVE_WEBHOOK_SECRET
- User declined to enter keys this session — add via Replit Secrets when ready

## Audit findings confirmed OK (no action needed)
- Vendor portal: can view and act on booking requests
- Vendor route /vendor exists and works (file: src/routes/_authenticated/vendor.tsx)
- Vendor onboarding: 3-step flow, navigates to /vendor on complete
- Event creation: end-to-end wired
- Guest RSVP: works without login
- Notification bell: wired with realtime, mark-read, archive (delete)
- MelaAssist: proper error handling (persistent banner for config errors, toast for transient)

## Known gaps (backlogged tasks already exist)
- Portfolio upload in profile builder: not implemented (Task #125)
- Vendor reply delivery by email: saves locally only (Task #46)
- Stripe live checkout: needs API keys (Task #76)
