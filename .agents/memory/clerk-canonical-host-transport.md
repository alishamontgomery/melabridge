---
name: Clerk canonical host transport
description: The external Clerk production instance rejects the MelaBridge canonical host when requests are forced through the app proxy.
---

For the external Clerk setup used by MelaBridge, `melabridge.com` must use Clerk’s direct frontend API transport. The app proxy must not be selected for the canonical host or reintroduced by the Clerk server package’s `CLERK_PROXY_URL` environment fallback. Server Clerk middleware must not gate top-level HTML navigations.

**Why:** The direct frontend API served the working signup/sign-in flow earlier in the day. Forcing `melabridge.com` through the same-origin proxy caused Clerk to return `host_invalid` before signup or session handoff could begin. With an expired session and no refresh cookie, global server middleware can return a 307 handshake Location for the document request itself, moving the browser to `/api/__clerk/...` before React loads.

**How to apply:** Preserve the canonical-host bypass when changing Clerk provider wiring, clear the server package’s proxy environment fallback before middleware initializes, reject legacy proxy paths without redirecting, and bypass Clerk request middleware for HTML GET/HEAD documents while retaining it for server functions and non-document requests. Do not rotate keys as a first response.