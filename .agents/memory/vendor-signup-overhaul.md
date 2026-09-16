---
name: Vendor signup overhaul pass 10
description: Auth race condition, JWT error, vendor category multi-select, zip_code, package pricing label, and duration field fixes.
---

## Auth routing race condition (CRITICAL)

**Bug:** New vendor accounts landed on Personal dashboard (/dashboard) instead of /vendor.
**Root cause:** `useEffect` in `auth.tsx` (depends on `[loading, user]`) fired as soon as Supabase emitted SIGNED_IN, BEFORE `ensureProfile` had written `account_type: "vendor"` to `profiles`. `landingRouteForUser` then found no vendor role and returned `/dashboard`.
**Fix:** Added `!busy` guard: `if (!loading && user && !busy)`. The `submitSignUp` flow holds `busy=true` via `activeOperation !== null` throughout the signup operation. After the explicit navigate fires, the effect correctly respects the already-navigated destination.
**Why:** `busy` is already `const busy = activeOperation !== null` at line ~233. No new state needed.

## JWT "issued at future" error

**Error:** "Sign-in could not finish — Workspace setup failed: JWT issued at future."
**Root cause:** Transient clock skew between Supabase token issuer and the DB/API validator at account creation. The JWT `iat` claim appears to be in the future relative to the validator's clock.
**Fix:** In `ensureProfile` (both `auth.tsx` and `auth.callback.tsx`): on any error containing "jwt" or "future" or code "PGRST301", wait 1200ms and retry the upsert once. Only surfaces error to user if retry also fails.
**Fix 2:** Added JWT clock-skew case to `friendlyAuthError` in `auth.callback.tsx`: shows "Sign-in is finishing — please wait a moment" rather than a raw technical error.

## Database additions

New columns added to `vendor_profiles`:
- `business_categories text[] DEFAULT '{}'` — array of all vendor service categories
- `zip_code text` — distinct from city/state for address search/marketplace matching

`vendor_profiles_public` view recreated to expose both columns (plus `is_verified` from pass 9).
`src/integrations/supabase/types.ts` manually updated for all three shapes (Row/Insert/Update) on both `vendor_profiles` and `vendor_profiles_public`.

## vendor-ai.functions.ts (SaveInput + handler)

`SaveInput` schema extended with:
- `business_categories: z.array(z.string()).max(20).optional()`
- `zip_code: z.string().max(20).optional()`

Handler saves `business_categories` as an array (separate from the string loop).
`getVendorProfileSnapshot` select now includes `business_categories` and `zip_code`.

## Onboarding VendorFlow (onboarding.tsx)

- VENDOR_CATEGORIES updated to the canonical 22-item list matching requirements.
- `category: string` state → `categories: string[]`; chip-based multi-select replaces the dropdown Select.
- `canNext1` requires at least one category selected.
- `finish()` saves `business_category: categories[0] ?? "other"` (backward compat) AND `business_categories: categories`.
- Step 2 adds `zipCode` state and a ZIP Code input alongside City/State.
- `zip_code` saved in the vendor_profiles upsert.

## Vendor profile builder (vendor-profile-builder.tsx)

- `VENDOR_OFFER_CATEGORIES` constant defined (22 categories, same canonical list).
- `biz` state extended with `categories: string[]` and `zipCode: string`.
- `categorySearch` state added for filtering chip grid.
- Snapshot initialization populates both from `business_categories` and `zip_code`.
- Business Details card: "What do you offer?" chip multi-select added at top (searchable).
- "Province / State" label → "State". City/State/ZIP now in a 3-column grid.
- Starting price moved to its own row with note: "Add packages for detailed pricing — they take precedence."
- `saveBusinessDetails` writes `business_categories` and `zip_code` to save payload.

## Package builder (vendor-packages.tsx)

- Pricing label: added dynamic `<Label>` above price input — shows "Package price" when `price_type === "fixed"`, "Starting price" when `price_type === "starting_at"`.
- Placeholder also adapts: fixed shows `"e.g., 1500"`, starting_at uses `template.priceHint`.
- Duration label → "Duration (optional)". Added `<SelectItem value="__none__">Not applicable / varies</SelectItem>` as first option. `onChange` converts `"__none__"` sentinel back to `""` before storing.

**Why:** Every vendor type has different duration semantics (DJ = hours, baker = servings, florist = arrangement). Making it optional prevents every non-time-based vendor from being forced to pick an irrelevant field.
