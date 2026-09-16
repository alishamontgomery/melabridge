---
name: Supabase new API key format
description: The sb_secret_* and sb_publishable_* key formats do NOT work with PostgREST REST API directly; migrations must be applied manually via the Supabase SQL Editor.
---

## The rule
`sb_secret_*` and `sb_publishable_*` Supabase API keys are "opaque" new-format keys. They do NOT authenticate against PostgREST (the `/rest/v1/` endpoint) — returning 401 "Invalid API key" even when passed as `apikey` header or `Authorization: Bearer`. The Supabase Management API (api.supabase.com) requires a personal access token starting with `sbp_*`.

**Why:** These keys go through Supabase's API gateway which converts them to credentials — they aren't validated as JWTs by PostgREST directly.

**How to apply:** When a migration needs to be applied from the agent environment and only a `sb_secret_*` key is available, provide the user the SQL to run manually in the Supabase SQL Editor at `https://supabase.com/dashboard/project/<ref>/editor`.

## The JWT format (old-style) does work
The legacy JWT service role key (starts `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`) works with PostgREST via `apikey: <key>` + `Authorization: Bearer <key>` headers. The JWT payload contains a `ref` field — verify it matches the app's project ID before using it.

## Project-key mismatch check
Always decode the JWT's middle segment (base64url) to verify `payload.ref === <expected project id>`. The app project ID is in `SUPABASE_URL` env var: `https://<project-id>.supabase.co`.
