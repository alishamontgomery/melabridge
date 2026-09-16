---
name: Clerk development key pairing
description: Development auth can loop indefinitely when the publishable and secret Clerk keys belong to different instances.
---

Keep the Clerk publishable key used by the browser and the Clerk secret key used by the server from the same Clerk instance and environment.

**Why:** A mismatched pair produces repeated session-token refresh redirects in development even when public routes and server builds appear healthy.

**How to apply:** Treat repeated Clerk refresh-loop warnings as a manual secret/configuration blocker. Do not attempt to repair them by changing auth routing or exposing key values.