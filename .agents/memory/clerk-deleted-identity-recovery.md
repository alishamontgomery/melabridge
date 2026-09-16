---
name: Clerk deleted identity recovery
description: How to recover preserved MelaBridge profiles after their external Clerk identities are deleted.
---

An active application identity link may be reclaimed for a newly verified Clerk user only when the previously linked Clerk user is confirmed to return not-found from the server-side Clerk API. If the old identity still exists or its status cannot be verified, fail closed.

**Why:** Deleting a Clerk user does not remove the preserved MelaBridge profile or its identity link, so normal signup can otherwise reject the legitimate owner as already linked while unrestricted relinking could hijack a live account.

**How to apply:** Keep profile ownership and admin role data in Supabase, verify the old Clerk identity with server credentials during provisioning, and reclaim only confirmed-deleted links.

Deleting the external Clerk users alone is not a clean reset: Supabase compatibility auth anchors and application profiles can still be returned by email-based candidate discovery and block a fresh signup.

**Why:** The provisioning path audits both `auth.users` and `profiles`, while sessions and identity links are stored separately from Clerk.

**How to apply:** For an intentional full reset, remove stale bridge links, application profiles, Supabase auth anchors, auth sessions/tokens, and user-owned dependents atomically. Ordinary signup must never reclaim a matching preserved profile unless the explicit recovery marker is present.

The verified `hello@melabridge.com` address is the only server-side bootstrap path for recreating the Admin profile; the browser profile selector and arbitrary client metadata must not grant Admin.

**Why:** The original Admin workspace was intentionally removed, so a fresh Clerk identity needs a controlled way to recreate its role without reopening generic Admin self-signup.

**How to apply:** After Clerk verifies that exact primary email, provision a fresh Admin profile/role. Keep all other new signups on their selected public account type.