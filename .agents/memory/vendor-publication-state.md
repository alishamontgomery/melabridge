---
name: Vendor publication state
description: The distinction between completing vendor signup and publishing a vendor marketplace listing.
---

Vendor signup should create a private vendor profile draft. The vendor profile's publication flag should only become true after the self-service profile-strength requirements pass.

**Why:** Treating onboarding completion as publication exposed incomplete listings and made the marketplace state misleading. Vendors need an explicit, server-checked publish action.

**How to apply:** Keep account onboarding completion separate from vendor listing publication. Any UI that says a vendor is live must use the vendor profile publication state, not the general account onboarding flag.