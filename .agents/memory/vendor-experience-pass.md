---
name: Vendor experience — complete product pass
description: Key decisions, patterns, and constraints established during the full vendor experience rebuild (Task #31).
---

# Vendor Experience — Complete Product Pass

## vendor_packages table
- Added in `supabase/migrations/20260729000003_vendor_packages.sql`
- Not yet in the generated Supabase TypeScript types → all queries must use `(supabase as any).from("vendor_packages")` and cast results with `as unknown as VendorPackage[]`
- Public read policy exists (anon + authenticated), so marketplace and public profile can read without auth
- CRUD server functions live in `src/lib/vendor-packages.functions.ts`

**Why:** The type generator runs against the live DB; the migration adds the table at runtime but the ts types file is only regenerated manually. Any future `vendor_packages` query from a typed Supabase client needs the `as any` cast until types are regenerated.

**How to apply:** Whenever querying `vendor_packages` via the Supabase client, use `(supabase as any).from("vendor_packages")` and cast the result to the local type.

## Route file naming for public params (TanStack Router)
- Flat route file: `src/routes/vendor-profile.$vendorId.tsx` → path `/vendor-profile/$vendorId`
- Public route (no `_authenticated` wrapper) — accessible without login
- Uses `PublicShell` when no user, `AppShell` when logged in

## VENDOR_NAV restructure
- "Booking Requests" (was `/calendar/requests`) consolidated into "Requests & Leads" at `/vendor-portal`
- "My Listing" (was `/profile`, wrong destination) changed to "My Profile" at `/vendor-profile-builder`
- "Packages" added pointing to `/vendor-packages`
- `/vendor-packages` added to `ROLE_EXCLUSIVE` in app-shell (vendor only)

## Marketplace ranking
- `vendor_profiles_public` query no longer uses `.order("created_at", { ascending: false})` — just fetches up to 200 rows unordered
- Client-side `rankScore(v)` function in marketplace.tsx sorts the `visible` useMemo by organic quality: verified (30), logo (15), description≥100 chars (15), 3+ photos (20), any photo (5), pricing (10), experience (5)
- No paid/sponsored signals anywhere in the ranking

## Vendor portal (leads inbox)
- Status pipeline maps directly to `calendar_request_status` enum: pending→New, alternate_proposed→Responded, approved→Booked, declined→Not a fit, cancelled→Cancelled
- Private notes stored in localStorage keyed by request id (key `mb-vendor-notes`)
- Response templates stored in localStorage (key `mb-vendor-templates`, max 20)
- "Record reply" currently marks status as `alternate_proposed` + saves to notes; actual email delivery is a follow-up (Task #46)

## ProfileStrength component
- `src/components/vendor-profile-strength.tsx` exports `ProfileStrength`, `buildStrengthItems`, `PUBLISH_THRESHOLD` (5), `STRENGTH_TOTAL` (8)
- FAQs item always shows as incomplete (FAQs not stored in DB yet — no dedicated column on vendor_profiles)
- Availability item checks `business_hours` JSONB for non-empty object
