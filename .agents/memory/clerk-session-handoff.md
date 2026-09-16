---
name: Clerk custom-flow session handoff
description: Mobile-safe session handoff rules for custom Clerk sign-in, signup, verification, and password-reset flows.
---

After Clerk returns a completed session in a custom flow, await `setActive` and wait until a fresh session token is available. Do not assume the newly active session cookie will accompany the callback's first server-function request, especially on mobile Safari: pass the fresh token explicitly to one-time provisioning and verify it server-side with Clerk before using its subject. Password sign-in can return `needs_client_trust` on a new device; continue with Clerk's supported email-code second factor instead of treating it as a failed sign-in.

Existing MelaBridge profiles whose Clerk identity is missing may be recovered through a verified Clerk signup, but that path must be explicitly marked as recovery and fail closed when no matching legacy profile exists. It must link the one matching legacy UUID rather than provision a new anchor. When a legacy auth anchor has a different email from the canonical profile, an onboarded admin profile is the authoritative match.

Published recovery can reach Clerk successfully and still fail at password reset with Clerk's `form_password_length` response even when the app-side minimum is eight characters. The production Clerk password policy is independent of the app form and cannot be overridden by client validation.

**Why:** Provider-side identity loss can leave application ownership data intact. A verified email is enough to reconnect the preserved profile, but an unrestricted signup fallback could accidentally create a second admin or ownership record.

**How to apply:** Keep normal signup provisioning unchanged. For a named recovery flow, carry a server-checked recovery marker in Clerk metadata, match the normalized verified email against legacy auth/profile records, and reject recovery when the match is absent or ambiguous.

Bound callback retries and clear the local Clerk session after repeated callback cycles. Never automatically redirect an already-signed-in auth page back to the callback: delayed sign-out propagation can recreate the loop. Let Clerk own the redirect after sign-out.

Do not read browser Clerk state from a route `beforeLoad` guard when `ClerkProvider` mounts inside the root route component. Gate protected routes in a component below the provider, and keep auth loading until the Clerk-to-legacy-user mapping has definitively resolved.

**Why:** Clerk session activation, cookie persistence, provider hydration, identity mapping, and sign-out propagation are asynchronous. On mobile Safari, a fresh client token may exist before the session cookie reaches server functions, causing a false unauthenticated provisioning failure.

**How to apply:** Use this handoff for sign-in, verified signup, client-trust verification, password reset, and direct protected-page reloads. Run callback provisioning once per mount, accept only a bounded token input, and verify it before resolving or creating an identity link. Support `email_code` for `needs_client_trust`; reset callback state around deliberate auth; keep Clerk's CAPTCHA mount in signup forms. A direct recovery URL must open the verified signup/recovery form, not the normal password sign-in form, when the provider identity is missing.
