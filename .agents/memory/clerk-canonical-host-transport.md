---
name: Clerk canonical host transport
description: The external Clerk production instance rejects the MelaBridge canonical host when requests are forced through the app proxy.
---

For the external Clerk setup used by MelaBridge, `melabridge.com` must use Clerk’s direct frontend API transport. The app proxy remains available for other live custom hosts, but the canonical host must not be forced through `/api/__clerk`.

**Why:** The direct frontend API served the working signup/sign-in flow earlier in the day. Forcing `melabridge.com` through the same-origin proxy caused Clerk to return `host_invalid` before signup or session handoff could begin.

**How to apply:** Preserve the canonical-host bypass when changing Clerk provider wiring, and verify the production auth surface loads Clerk assets from `clerk.melabridge.com` without a proxy URL. Do not rotate keys as a first response.