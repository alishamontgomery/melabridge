---
name: Vendor multi-service compatibility
description: Rules for representing vendors with multiple services without breaking legacy category data or package display.
---

Keep `business_category` as the primary/legacy service and use `business_categories` as the deduplicated full service list. Matching, search, favorites, and public display must use the full list; uncategorized packages fall back to the primary service, while explicitly categorized packages use their selected service.

**Why:** Existing vendor records and older package records predate multi-service support, so replacing the legacy field or requiring package categories would hide existing profiles and details.

**How to apply:** When adding a vendor-facing service edit or read path, normalize through the shared category helper, preserve the primary field, and treat package service association as nullable.