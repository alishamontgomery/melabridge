---
name: Supabase project migration — new project fawkzsyuiduzjnlaxssd
description: App fully migrated and all 87 migrations applied. Schema verified, all tests passing.
---

## Current state (fully operational as of 2026-08-02)
- New project: `fawkzsyuiduzjnlaxssd`
- URL: `https://fawkzsyuiduzjnlaxssd.supabase.co`
- `service_role` Replit secret: ✅ correct JWT for this project
- `SUPABASE_PUBLISHABLE_KEY` Replit secret: ✅ correct anon JWT for this project
- `SUPABASE_ACCESS_TOKEN` Replit secret: ✅ Supabase PAT (for CLI / Management API)
- `SUPABASE_DB_PASSWORD` Replit secret: ✅ set (direct DB connections are DNS-blocked from Replit though)
- `SUPABASE_URL`, `SUPABASE_PROJECT_ID` Replit env vars: ✅ set to new project
- `vite.config.ts` define block: ✅ overrides stale `.env` values at build time
- `supabase/config.toml`: ✅ updated to `fawkzsyuiduzjnlaxssd`
- **Schema**: ✅ ALL 87 MIGRATIONS APPLIED

## Schema snapshot
- 44 tables, 136 RLS policies, 39 triggers, 26 functions, 20 enums, 82 message template seed rows
- Auth site_url set to Replit dev domain
- No storage buckets needed (app has no storage.from() calls)

## How credentials are loaded
The `.env` file still has old project values but cannot be edited (Replit restriction).
`vite.config.ts` has a `define` block replacing `import.meta.env.VITE_SUPABASE_*` at
build time from `process.env.*` (Replit Secrets/env vars).

## Migrations applied via
Supabase CLI (`npx supabase db push`) authenticated via PAT (SUPABASE_ACCESS_TOKEN).
Two seed-data migrations required a guard before applying:
- `20260713055013` — hardcoded admin UUID wrapped in `IF EXISTS (SELECT 1 FROM auth.users WHERE id=...)`
- `20260715231725` — hardcoded test event owner UUID, same guard pattern

## Key RPC function signatures (actual, tested)
- `claim_free_tickets(_ticket_type_id uuid, _buyer_name text, _buyer_email text, _quantity int, _promo_code text DEFAULT NULL)`
- `has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live')`
- `get_public_event_page(p_event_id uuid)`
- `apply_ticket_refund(_order_id uuid, _refund_delta_cents int, _reason text DEFAULT NULL)`

## Table column name gotchas
- `budget_items`: columns are `label` (not `name`), `estimated_amount` / `actual_amount` / `paid_amount` (not `amount`)
- `guests`: column is `full_name` (not `name`), no `invited_by` column
- `subscriptions`: `stripe_subscription_id` and `stripe_customer_id` are NOT NULL — Stripe manages inserts

## Direct DB connections
Direct Postgres connections are DNS-blocked from Replit (ENOTFOUND for db.*.supabase.co).
Pooler connections return "tenant not found" across all regions (project may need pooler enabled in Supabase dashboard).
Use the Management API (`api.supabase.com`) with SUPABASE_ACCESS_TOKEN for future DDL work.
