---
name: Google service-area search
description: Google Places may return legitimate home-based businesses without public addresses or coordinates.
---

Google Places service-area listings can have a Maps identity and website but no public street address or coordinates. Treat the provider's location bias as sufficient for those results; do not discard them solely because exact radius distance is unavailable.

**Why:** Home-based vendors need local discovery without exposing their private address, and an address-only filter silently removes valid Google Business listings.

**How to apply:** Preserve addressless Google results when a location bias was sent, label them as service-area businesses, and keep a direct URL-based connection/import path as the reliable fallback when Places search cannot discover the listing.

Google share links can redirect to a Google search URL containing a `kgmid` and business name. That identity can be rendered as an external, address-free result when the user searches with the share URL, without inventing coordinates or a street address.

When a vendor explicitly links a Google listing, local search can match that linked external listing by name, service, city, or ZIP even if the native MelaBridge profile is not yet published. Keep it clearly labeled as an external service-area result and leave distance unknown when Google provides no coordinates.

Store the real business website separately from the Google listing URL so external result cards can offer both actions without mislabeling the listing link as the business website.