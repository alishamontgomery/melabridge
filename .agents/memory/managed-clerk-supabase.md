---
name: Clerk and Supabase
description: Durable authentication and authorization rules for the Clerk-to-Supabase integration.
---

Clerk is the sole login and session authority. Supabase native Clerk third-party authentication must trust the active Clerk tenant, while existing Supabase UUIDs remain the application's ownership identifiers through a one-to-one identity bridge.

Clerk remains the authority for authentication messages such as signup verification and password reset. Application transactional email is sent through the installed Resend connector; callers must treat only a confirmed provider response as delivery and keep core database actions functional if delivery is unavailable.

**Why:** Authentication and application email have different trust and failure boundaries; application actions must not claim delivery when the provider is unavailable.

**How to apply:** Use the shared transactional email helper, check its result, never stamp email delivery timestamps without a real send, and label account-only in-app delivery honestly.

Only active bridge links may resolve a Clerk subject to an application UUID. Never restore a fallback that accepts a legacy Supabase UUID subject, and never replace user-scoped access with service-role requests. The current deployment uses an external Clerk tenant, so do not start a Replit-managed Clerk migration unless that decision changes.

**Why:** Preserving UUIDs avoids breaking ownership relationships, while fail-closed resolution prevents stale Supabase sessions or unlinked Clerk identities from bypassing Clerk.

**How to apply:** Keep Clerk and Supabase third-party issuers configured for each environment. Provision/link verified Clerk identities server-side, keep links unique, and suspend links rather than deleting preserved application data.

The callback and protected server functions must use the same idempotent server-side Clerk provisioning result; they must not make a second browser Supabase profile read to decide whether a valid session can enter the app.

**Why:** Clerk session activation, the browser token provider, and PostgREST requests can become ready in different orders, turning a valid sign-in into a false access failure.

**How to apply:** Let provisioning create or repair the internal profile/role/link, return the verified role and onboarding state, and use that result for callback routing. Keep the UUID bridge only as an ownership compatibility layer for existing business data.

Supabase RLS policies must resolve ownership with `public.current_app_user_id()`, not `auth.uid()`. Clerk subjects use `user_...` identifiers and cannot be cast to the UUID columns used by application ownership tables.

**Why:** Policies that compare or cast `auth.uid()` to UUID fail at runtime even when the server middleware has correctly resolved the linked legacy UUID.

**How to apply:** Use the bridge resolver consistently in SELECT/INSERT/UPDATE/DELETE policies for UUID-owned records, including staff access tokens and storage paths.

Re-provisioning or switching the Clerk development tenant requires updating Supabase Third-Party Auth to trust the new Clerk issuer before browser queries can succeed.

**Why:** Server-side provisioning can create the correct profile, vendor role, and active identity link while PostgREST still rejects the browser JWT before RLS runs.

**How to apply:** Treat the Clerk key pair and Supabase trusted issuer as one environment-level configuration. Validate a user-scoped Supabase query after any tenant change, not only the Clerk handshake.

After a Clerk tenant change, test every table read used during callback and role resolution, not just `profiles`.

**Why:** A trusted JWT can successfully read one table while another callback table still has missing grants or stale RLS policies, causing a generic access-verification failure after server provisioning has already succeeded.

**How to apply:** Smoke-test `profiles`, `user_roles`, and `vendor_profiles` with a normal Clerk token before declaring the browser callback healthy.