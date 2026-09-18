---
name: Stripe subscription event ordering
description: Durable rule for synchronizing subscription state and related admin alerts under retries and out-of-order delivery.
---

Apply subscription state and its admin alert open/resolution in one database transaction, guarded by a deterministic event version.

**Why:** Stripe retries and does not guarantee webhook delivery order. If state and alert changes commit separately, an older handler can reopen stale state or leave an alert inconsistent with the winning subscription status.

**How to apply:** Compare a version tuple that includes the Stripe event timestamp plus deterministic same-second tie-breakers. Only the winning transaction may mutate both subscription status and alert state.