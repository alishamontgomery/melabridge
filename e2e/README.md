# Launch browser gate

Run the real browser gate with:

```bash
npm run test:e2e
```

The suite runs serially at desktop and mobile widths. It uses pre-verified
Clerk test users, creates matching Supabase compatibility identities, verifies
the seeded ticket fixture, and then checks sign-in/callback/logout, protected reload,
host/planner/vendor onboarding, free claims and QR display, paid checkout
return finalization, and duplicate scanner behavior.

Set these environment variables in the test environment. The password value
is read by Playwright but is never logged:

```text
E2E_TEST_PASSWORD=...
E2E_HOST_EMAIL=...
E2E_PLANNER_EMAIL=...
E2E_VENDOR_EMAIL=...
E2E_ADMIN_EMAIL=...
E2E_TICKET_EVENT_ID=...
E2E_PAID_SESSION_ID=cs_test_...
E2E_PAID_ACCESS_TOKEN=...
E2E_STRIPE_ENVIRONMENT=sandbox
```

Role-specific passwords (`E2E_HOST_PASSWORD`, `E2E_PLANNER_PASSWORD`,
`E2E_VENDOR_PASSWORD`, and `E2E_ADMIN_PASSWORD`) can be used when the four
accounts do not share a password. `E2E_TICKET_EVENT_ID` must identify an
existing seeded event with one active free ticket type and one active paid
ticket type. `E2E_PAID_SESSION_ID` and `E2E_PAID_ACCESS_TOKEN` must refer to a
pending paid order for that event; the confirmation page performs the real
Stripe-session finalization path.

The Clerk users must already exist and have verified primary email addresses.
This is deliberate: the application rejects unverified identities during its
callback provisioning step. Use the development Clerk instance and Stripe
sandbox only. The setup fails before the first test when any required account,
payment session, or Supabase service configuration is missing.