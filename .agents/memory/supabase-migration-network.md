---
name: Supabase migration network path
description: Environment-specific connection path for applying verified migrations to the external Supabase project.
---

The project's direct Supabase database hostname may resolve only to IPv6, which is unavailable in this workspace. The Supavisor transaction pooler is the workable path when a migration must be applied manually; determine the project region before connecting and keep the project-specific database user.

**Why:** The Supabase CLI can report a valid direct connection while the workspace cannot open its IPv6 socket, and blindly retrying the direct host does not change that network limitation.

**How to apply:** Prefer the normal migration workflow first. If the direct host fails at the network layer, use the matching `aws-0-<region>.pooler.supabase.com` endpoint with the project-scoped Postgres user, then verify the target RPC through the same Supabase client the app uses.