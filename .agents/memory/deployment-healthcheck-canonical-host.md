---
name: Deployment healthcheck and canonical host
description: Internal deployment probes must bypass public-host redirects.
---

Production canonical-host redirects must allow Replit's internal healthcheck hosts such as 127.0.0.1, localhost, 0.0.0.0, and ::1.

**Why:** Redirecting the internal probe to the public custom domain makes health checks depend on external networking; the deployment can be terminated and present site-wide 500s even while the app serves correctly locally.

**How to apply:** Keep public noncanonical hosts redirected to the canonical domain, but return the application response directly for internal probe addresses.