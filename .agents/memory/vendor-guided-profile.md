---
name: Vendor guided profile
description: Durable decisions for the vendor profile workflow and public contact exposure.
---

The vendor profile setup is intentionally a five-step draft flow: business details, contact and links, searchable services with one Primary category, packages and portfolio, then preview and publish. Existing save, upload, AI review, and package-editor behavior should be reused rather than replaced.

Public phone and email are opt-in fields. A vendor can save them privately while still publishing the profile; the public view must return them as NULL unless the matching visibility choice is public. Website visibility is separately controlled.

**Why:** The vendor experience must describe only capabilities that exist, and contact data should never become public as a side effect of publishing a profile.

**How to apply:** Preserve draft state between steps, keep publishing server-checked, and update the profile table, public view, save contract, and storefront together whenever contact visibility changes.