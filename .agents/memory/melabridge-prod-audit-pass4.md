---
name: MelaBridge production audit pass 4
description: Production-readiness audit findings and fixes applied August 2026.
---

# MelaBridge Production Audit Pass 4

## Confirmed-good areas (no action needed)
- Tasks: card click opens details, separate "Complete" button, no "Complete now" label
- Personal dashboard: no vendor business features bleed-through
- Personal settings: vendor features filtered out correctly
- Phone number: not present on any public page
- Bridge Studio: absent from all nav menus (direct-URL only)
- MelaAssist error handling: persistent banner + toast already implemented
- Calendar UI: uses "Preparation time" / "Cleanup time" (no "buffer" visible to users)
- Vendor dashboard header: shows businessName subtitle + firstName greeting via useDisplayName hook

## Fixes applied

### app-shell.tsx
- Vendor account dropdown "Marketplace Listing" → **"My Profile"** navigating `/vendor-profile-builder` (was `/profile`)

### auth.callback.tsx
- Added `user_roles` insert after profile upsert in the email-verification callback (`ensureProfile`)
  — mirrors the same fire-and-forget logic in auth.tsx so vendors who register via email confirmation
  get their role row immediately rather than relying solely on a DB trigger

### admin-stats.functions.ts
- Fixed `vendorApplications` stat: was counting `onboarding_completed=false` (incomplete profiles);
  now counts `onboarding_completed=true AND is_verified=false` (ready-to-review queue)

### admin.index.tsx
- Stat card label: "Vendor applications" → **"Awaiting review"** to match corrected semantic

### admin.vendors.tsx
- DB/RLS errors no longer collapse silently to empty list; surfaced as error state with Retry button

### pricing.tsx
- Default audience changed from `"host"` (only 1 free plan) to `"vendor"` (2 real paid plans)
  so visitors immediately see monetized tiers on first load

### index.tsx
- Added "Illustrative examples — actual results vary by event and usage." disclaimer
  below the MelaAssist feature preview stat cards

### vendor-settings.tsx
- "Complete your vendor profile first" error state linked to `/vendor-profile-builder` (was `/profile`)

## Still pre-existing / out of scope
- admin-subscriptions.functions.ts: 2 TypeScript errors (Task #95 on backlog)
- Stripe payment integration not connected (Task #76 on backlog)
