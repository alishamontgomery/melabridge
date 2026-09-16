---
name: Supabase migration rollout
description: Live-schema verification and rollout constraints for forward migrations in the active external Supabase project.
---

Forward migrations in the repository are not automatically applied by the development workflow. Verify every required live column and confirm the PostgREST OpenAPI document exposes every new RPC before testing a dependent server path.

**Why:** Checked-in or merged migrations can remain absent from the active Supabase schema even when local types and builds pass. This has caused both missing RPC failures and a checkout failure from a missing security column.

**How to apply:** Roll forward only the needed timestamped migrations through an authorized database connection. Query `information_schema` for required columns and the live OpenAPI document for RPCs before running inquiry, Stripe, scheduler, or admin-role tests.

When a migration was applied through the pooler outside the CLI, insert its version into `supabase_migrations.schema_migrations` after verifying the schema change; otherwise a later `db push --include-all` can attempt to replay it.

**Why:** The active project has migration-history drift from earlier manual repairs, so CLI replay can stop on duplicate history rows even when the target schema already contains the change.

**How to apply:** Never replay the full pending list to repair one missing migration. Apply only the intended SQL, verify the live object, then reconcile that migration's history row.