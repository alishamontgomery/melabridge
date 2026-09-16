---
name: Clerk domain and publishable-key discovery
description: How to verify an external Clerk instance and diagnose stale session loops after key changes.
---

The Clerk Backend API `/v1/domains` endpoint exposes the instance's `frontend_api_url`. A development publishable key is the URL host plus a trailing `$`, encoded as base64url after the `pk_test_` prefix. After repairing a key mismatch, validate in a fresh browser context because an old development session can continue reporting an infinite refresh loop even when a new context is clean.

**Why:** The Clerk dashboard was not available through the workspace initially, but the connected Clerk backend API exposed enough public instance metadata to verify the correct frontend domain without handling credentials in chat.

**How to apply:** Use the connected Clerk integration for instance/domain verification, keep the server secret in Replit Secrets, and treat a clean fresh-browser auth load as the meaningful post-repair check.

For a production custom-domain proxy, the app must handle the configured `/api/__clerk` path with Clerk's official `clerkFrontendApiProxy` handler; otherwise ClerkJS loads as a 404 and auth controls remain inert even when the publishable and secret keys match.

**Why:** The published custom domain was configured with a Clerk proxy URL, but the application had no matching route. Local direct-FAPI auth worked while the live domain's Clerk script failed to load.

**How to apply:** Intercept the proxy path in the server entry before TanStack request handling, forward with the live publishable and secret keys, then republish before testing the custom domain.

The Replit-connected Clerk integration may represent only the development instance even when the deployment uses a separate live key and custom frontend domain. Do not use development users or development instance settings as proof that production sign-in works.

**Why:** The workspace connection exposed the development frontend API and development user directory, while the published site exposed a live custom-domain frontend API. Both environments can be healthy while their users and settings remain completely separate.

**How to apply:** Compare the public production bootstrap key/environment and the development bootstrap separately, and verify live allowed origins, redirect URLs, and server secret pairing in the production Clerk instance rather than the connected development instance.

An active Supabase identity bridge can still point at a valid development Clerk user while the corresponding production Clerk tenant has no user for the same email. Treat that bridge as preserved application ownership, not proof of production authentication.

**Why:** The legacy admin row and active bridge survived, but production returned `form_identifier_not_found` for the admin emails while the development connector returned a valid user.

**How to apply:** Verify the exact email in the live Clerk tenant before changing `clerk_identity_links`; restore the existing live Clerk identity through production administration, then link it to the preserved UUID rather than creating a replacement MelaBridge profile.

Production Clerk settings can reject new passwords at a longer minimum than the app's local schema, and bot sign-up protection may invoke a Cloudflare Turnstile challenge on custom flows. Keep sign-in validation permissive for existing passwords, enforce the live minimum only for new/reset passwords, and keep the `clerk-captcha` placeholder mounted before `signUp.create()`.

**Why:** The published environment exposed a 15-character minimum and breach checks, while the app accepted eight characters and replaced Clerk's detailed errors with a generic password message. Mobile signup can also stall if the Turnstile challenge host is unavailable.

**How to apply:** Read the production Clerk environment settings through the proxy during diagnosis, surface password/breach/CAPTCHA errors distinctly, and treat failed challenge DNS or content blockers as an external production dependency rather than a role/onboarding bug.