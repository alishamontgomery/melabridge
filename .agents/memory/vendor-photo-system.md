---
name: vendor-photo-system
description: Architecture of the vendor_photos labeling system added to replace the old portfolio_urls-only approach
---

# Vendor Photo Labeling System

## The Rule
`vendor_profiles.vendor_photos` is a JSONB array of `{url: string, type: "portfolio"|"cover"|"backdrop"|"both"}`. This replaces the undifferentiated `portfolio_urls` text[] array for all new uploads. Old `portfolio_urls` data is still read as a fallback.

**Why:** Previously portfolio, cover, and backdrop were all jammed into one `portfolio_urls[]` with no way to distinguish them. Photo Booth package builder couldn't know which images were backdrops. Profile Strength couldn't detect cover vs portfolio photos.

## How to Apply
- Profile builder Photos section writes to `vendor_photos` via `saveVendorProfileDraft({ vendor_photos: [...] })`
- Package builder backdrop picker reads from `getVendorPortfolioUrls()` which filters `vendor_photos` by `type === "backdrop" || type === "both"`, falling back to `portfolio_urls` if `vendor_photos` is empty
- Profile Strength cover photo check: `vendor_photos.some(p => p.type === "cover" || p.type === "both")` with fallback to `portfolio_urls.length >= 1`
- Profile Strength portfolio count: `vendor_photos.filter(p => p.type === "portfolio" || p.type === "both").length` with fallback to `portfolio_urls.length`
- Snapshot completeness check uses `vendor_photos` portfolio count, not `portfolio_urls`

## DB
Both columns were added live:
```sql
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS vendor_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faqs JSONB NOT NULL DEFAULT '[]'::jsonb;
```

## Key files
- `src/lib/vendor-ai.functions.ts` — SaveInput schema, save handler, snapshot SELECT and completion checks
- `src/lib/vendor-packages.functions.ts` — getVendorPortfolioUrls backdrop filter
- `src/routes/_authenticated/vendor-profile-builder.tsx` — upload UI, labeling UI, savePhotos()
- `src/components/vendor-profile-strength.tsx` — buildStrengthItems photo logic
