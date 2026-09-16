---
name: Vendor profile deep audit pass 9
description: Senior-engineer-level review and fixes across vendor-profile.$vendorId.tsx, vendor-settings.tsx, and vendor-profile-builder.tsx.
---

## Bugs Fixed

### vendor-settings.tsx
- Contact effect: added `mounted` ref guard + try/catch/finally. Without it, any auth/DB error left `contactLoading=true` forever (permanent spinner).
- `!data && !isLoading`: added `isError` destructuring so error state shows "Couldn't load settings" instead of "Complete your vendor profile first".
- Terminology: "Confirm a booking when…" → "Confirm a lead when…", "Save booking settings" → "Save settings", deposit copy updated.

### vendor-profile.$vendorId.tsx (public profile)
- Data fetch: wrapped in try/catch/finally; `vpResult.error` now checked; loader clears in finally not in branch.
- Gallery filter: `["portfolio", "both", "cover"]` → `p.type !== "cover"`. Cover-only photos no longer appear twice (in hero AND gallery).
- Duplicate `openInquiry()` function removed; new version accepts optional `pkgName` to pre-fill the message.

### vendor-profile-builder.tsx
- Race condition: added `photosRef = useRef([])` synced via effect. All three upload handlers (cover, portfolio, backdrop) now use `photosRef.current` instead of the stale `photos` closure, preventing concurrent uploads from overwriting each other.

## Features Added

### Public profile enhancements
- **Photo lightbox**: `PhotoLightbox` component with keyboard nav (arrow keys, Escape), prev/next buttons, counter. Clicking gallery photos opens it.
- **Breadcrumb**: "← Marketplace / [Vendor Name]" nav above hero for easy back-navigation.
- **Package inquiry CTAs**: each `PkgCard` on public profile has an "Inquire about this package" button that pre-fills the message field.
- **Dynamic document.title**: sets to "Business Name · Category · City · MelaBridge" when profile loads; cleans up on unmount.
- **BridgeCheck™ badge**: replaces the generic "Listed" badge; only shows for `is_verified = true` vendors (green, not purple).
- **Inquiry success state**: "View in My Vendors" button → `/bookings`; "Send another inquiry" resets form; copy updated.
- **Gallery overflow**: shows "X more photos — contact to see the full portfolio" when >9 photos.

## Database
- `vendor_profiles_public` view recreated (DROP + CREATE) to include `is_verified` column.
- `src/integrations/supabase/types.ts` manually updated to reflect new column in all three type shapes (Row/Insert/Update).

**Why:** The public profile is the primary conversion surface — planners who land here must find it trustworthy, complete, and easy to act on. Every bug here directly reduces inquiry conversion.
