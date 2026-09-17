---
name: Clerk canonical host transport
description: The external Clerk production instance rejects the MelaBridge canonical host when requests are forced through the app proxy.
---

For the external Clerk setup used by MelaBridge, `melabridge.com` must use Clerk’s direct frontend API transport. The app proxy must not be selected for the canonical host or reintroduced by the Clerk server package’s `CLERK_PROXY_URL` environment fallback.

**Why:** The direct frontend API served the working signup/sign-in flow earlier in the day. Forcing `melabridge.com` through the same-origin proxy caused Clerk to return `host_invalid` before signup or session handoff could begin.

**How to apply:** Preserve the canonical-host bypass when changing Clerk provider wiring, clear the server package’s proxy environment fallback before middleware initializes, and verify the production auth surface loads Clerk assets from `clerk.melabridge.com` without a proxy URL. Do not rotate keys as a first response.