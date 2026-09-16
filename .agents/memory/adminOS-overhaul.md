---
name: AdminOS overhaul
description: Architecture decisions and model corrections made during the AdminOS rewrite pass.
---

## Vendor approval workflow removed
Vendors appear in the marketplace automatically when `onboarding_completed = true` — no admin approval gate. `is_verified` is the optional BridgeCheck™ badge only. Admin's `/admin/vendors` is now a directory, not a review queue.

**Why:** The old "Vendor Review" mental model (approve/verify before listing) was wrong. Auto-publish is confirmed via the marketplace query which only filters by `onboarding_completed`.

**How to apply:** Never add a "pending approval" or "awaiting review" queue for vendor onboarding. Admin badge toggle (`setVendorVerified`) is the only verification action.

## Admin nav duplication fix
The old admin nav had both "Vendor Review" → `/admin/vendors` AND "Vendor Directory" → `/vendors`. The `/vendors` route is the planner-facing discovery page, not an admin tool. It was removed from admin nav.

**Why:** Two nav items with nearly identical labels pointing to different pages (one admin, one planner-facing) caused confusion and role leakage in the UI.

## analytics.tsx and reports.tsx are admin-only platform pages
Both are gated by `ROLE_EXCLUSIVE` in app-shell. `analytics.tsx` is now platform analytics (users, vendors, inquiries, subscriptions) — not event-level data. `reports.tsx` is now an admin export hub (CSV downloads for users and vendors).

**Why:** The old versions showed event-level data (health score, RSVP %, budget %) which is irrelevant and confusing for admin.

## Vendor profile public route safety
`/vendor-profile/$vendorId` queries `vendor_profiles_public` view which likely only shows `onboarding_completed = true` profiles. In the admin vendor directory, incomplete profiles are disabled for click-through to avoid 404/not-found.

**Why:** Admin can see all vendors but clicking through to an incomplete profile's public URL returns not found.

## admin-stats.functions.ts fields
Current fields: `activeUsers`, `totalVendors`, `activeVendors`. Removed: `eventsInFlight`, `vendorApplications`.

## Platform analytics server function
`getPlatformStats` in `src/lib/admin-platform-stats.functions.ts` returns all platform-level metrics via supabaseAdmin. Called from `analytics.tsx` only. Asserts admin role before querying.
