---
name: Replit TanStack deployment target
description: TanStack Start builds must target a Node server when publishing to Replit Cloud Run.
---

TanStack Start projects published to Replit Cloud Run need the Nitro `node-server` preset so the generated artifact listens for HTTP traffic.

**Why:** A Cloudflare module exits immediately when run as a Cloud Run process, causing publishing to fail after the security and database preparation stages even when the local Vite build passes.

**How to apply:** Set Nitro's `preset` to `"node-server"` in the native Vite configuration and verify the generated server returns HTTP 200 locally before publishing.

When a publish build reaches image creation and then stops after database migration statements, inspect the production schema and run the generated server locally before changing application code.

**Why:** Publishing can be marked failed during the platform handoff even when the bundle, container, port binding, and health route are valid; the failed log may omit the final infrastructure error.

**How to apply:** Use the deployment build detail, `explainSchemaDiff()`, and read-only production schema checks. If the schema is aligned and local `node .output/server/index.mjs` returns HTTP 200, retry Publish rather than refactoring the app.