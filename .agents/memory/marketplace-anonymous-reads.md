---
name: Marketplace anonymous reads
description: Authentication boundary for public Marketplace search and external vendor discovery.
---

Public Marketplace search must use a genuinely anonymous read path. A TanStack server-function call can invoke Clerk token loading on the browser even when the server function itself has no auth middleware; signed-out Clerk initialization can time out before the request is sent.

**Why:** The public page had retained inputs but silently showed zero external results because its Google fallback server-function call waited for Clerk. A public read endpoint restored real results without weakening authenticated claim or mutation paths.

**How to apply:** Keep anonymous Google/vendor discovery on an explicit GET route with bounded query validation and no writes. Keep ownership claims, sourcing requests, private APIs, and protected pages on Clerk-authenticated server functions/routes. Do not add an optional Clerk identity server-function probe to the public provider; in the mismatched-key state it can reload the Marketplace document and erase the search draft. For the shared Marketplace route, use a cookie-presence check to distinguish direct signed-in loads from signed-out public loads, and preserve an already-resolved client auth snapshot when switching from the authenticated shell so Clerk is not reinitialized during search.