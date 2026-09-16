---
name: Reliability monitoring
description: How recurring health and synthetic checks should run safely in this app.
---

The recurring monitor must run outside the app process for browser and SSR checks. A server endpoint that fetches its own public pages can deadlock the dev server and report false failures; use the scheduler-launched browser runner and send bounded, redacted results back to the app.

**Why:** Same-process self-fetches stalled public routes while protected redirects appeared healthy, and authenticated Clerk/Stripe flows cannot be safely exercised without creating test data.

**How to apply:** Keep public/config checks separate from authenticated-flow checks. Mark missing test sessions, live checkout, and other intentionally skipped operations as blocked or not-run, never as successful.

Marketplace native-source failures currently need an explicit rejection-path check: when the public vendor view returns HTTP 503, Google results remain usable but the native section can remain stuck in loading instead of showing its retryable error state.

**Why:** A read-only browser failure injection reproduced the state across mobile and tablet sizes, so a degraded native directory can look like a slow request rather than a recoverable failure.

**How to apply:** Keep Google fallback checks independent, but treat the native loading-to-error transition as a separate reliability gate before launch.