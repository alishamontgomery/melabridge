---
name: MelaBridge QA stabilization pass 7
description: Comprehensive QA pass — storage RLS, photo UX redesign, mobile inquiry dialog, URL normalization, auth redirect
---

## Storage RLS — photos/ path was blocked
The vendor-assets bucket INSERT/UPDATE/DELETE policies only allowed `logos/<uid>/*`.
Photo uploads go to `photos/<uid>/*` → RLS blocked them silently.
**Fix**: DROP old policies, CREATE new ones matching `logos/<uid>/*` OR `photos/<uid>/*`.
Applied via Supabase Management API directly (no migration file change needed).

## URL normalization — ensureAbsoluteUrl in utils.ts
Vendors can save website URLs without https:// (e.g. "mysite.com").
Browser treats `<a href="mysite.com">` as relative → internal 404.
**Fix**: `ensureAbsoluteUrl()` in src/lib/utils.ts. Applied to:
- src/routes/vendors.tsx
- src/routes/marketplace.tsx (website + social links)
- src/routes/vendor-profile.$vendorId.tsx (website + social links)
- src/routes/vendor-settings.tsx (normalizes on save)
- src/routes/vendor-profile-builder.tsx (normalizes on save via normalizeUrl)
- src/routes/e.$eventId.tsx (gift registry URL)

## Photos & Media redesign (vendor-profile-builder)
Replaced per-photo type labels with three dedicated sections:
1. **Cover Photo** — single wide image, auto-saves on upload, always visible Replace/Remove controls
2. **Portfolio Photos** — multi-select grid, all type="portfolio", auto-saves after all uploads complete
3. **Backdrop Catalog** — only shown when business_category contains "photo booth", type="backdrop"
Auto-save calls `savePhotosData(newPhotos)` with the finalized array directly (avoids stale state).
File size limit corrected to 5MB client-side (matches bucket limit).
Removed unused Select imports after redesign.
Phone input: type="tel" + inputMode="tel". Starting price: inputMode="numeric" + digit filter.

## Inquiry dialog — mobile UX fixes
- Removed grid-cols-2 date/guests row → all fields single column
- Removed estimatedGuests field (was never sent to DB)
- Added `overflow-y-auto` + `max-h-[92svh]` + flex-col to DialogContent
- `onOpenAutoFocus={(e) => e.preventDefault()}` to prevent iOS focus-trap conflicts
- Form content wrapped in `overflow-y-auto` scrollable div

## Inquiry auth redirect — uses `next` param on /auth
The /auth route search params use `next` (not `redirect`).
Unauthenticated inquiry clicks now: toast → navigate to /auth?next=/vendor-profile/{id}

## Two-track inquiry system (existing architecture)
Storefront inquiry form → `calendar_booking_requests` (vendors see at /calendar/requests).
Bookings dashboard → `vendor_bookings` table (separate pipeline).
Planners cannot currently see their sent inquiries in /bookings (Task #144 covers this gap).
Success message updated to NOT say "check your calendar requests" (that's vendor-side).

## MelaAssist "busy" error
The Gemini SDK + GEMINI_API_KEY is correctly wired. The error IS rate limiting on free tier.
Error message "MelaAssist is busy — try again in a moment" is accurate and intentional.
Event functions (event-drafts, event-bootstrap) use Lovable AI gateway with OpenRouter-style
model names ("google/gemini-3-flash-preview") — that IS the correct format for that API.
