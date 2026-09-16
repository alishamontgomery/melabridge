---
name: Stripe payments setup
description: State of Stripe integration — what's built, what's live, what needs to happen at production deploy time.
---

# Stripe Payments Setup

## Current state (test mode)

- **Mode**: Stripe TEST (`sk_test_...` + `pk_test_...`)
- **Keys in secrets**: `STRIPE_SECRET_KEY` (direct, bypasses Lovable gateway), `VITE_PAYMENTS_CLIENT_TOKEN` (publishable key)
- **Launch prices** in the Stripe test account:
  - `planner_professional_monthly` → $29/month
  - `planner_professional_annual` → $290/year
  - The former $39 planner monthly price is inactive, preserving existing subscribers on their historical price.
- **Planner Pro trial**: Exactly 5 days, passed via Checkout `subscription_data.trial_period_days`; Checkout always collects a payment method and the app checks account and Stripe customer history so switching intervals cannot reset eligibility.
- **Launch vendor billing**: Vendor Profile is free; paid vendor tiers remain hidden/non-purchasable while historical subscriptions remain honored.
- **Webhook**: Registered at current dev domain. Covers `customer.subscription.*`, `invoice.payment_failed`, `checkout.session.completed/expired`.
- **Webhook secret**: `PAYMENTS_SANDBOX_WEBHOOK_SECRET` in secrets (must match the registered webhook — set when webhook was created).

## User-facing checkout path

1. `/pricing` → paid plan CTA → `/subscription` (updated — was `/auth`)
2. `/subscription` → plan picker → consent dialog → Stripe embedded checkout (inline on page)
3. Checkout → `/checkout/return?session_id=xxx` → `verifyCheckoutSession` server fn → upserts `subscriptions` table
4. No `session_id` on return page → redirects to `/subscription` (fixed — was showing "Checkout complete")
5. Vendor dashboard shows upgrade banner for free-plan vendors → `/subscription`
6. Personal hosts can start free and upgrade to the existing Pro Planner tier when they need ticketing; do not lock hosts to a free-only catalog.

## What to do at production deploy

1. Get production URL from deployment skill
2. Create a new Stripe webhook pointing to `https://<prod-url>/api/public/payments/webhook?env=live` (for live keys) or `?env=sandbox` (for continued test mode)
3. Store the new webhook signing secret as `PAYMENTS_SANDBOX_WEBHOOK_SECRET` (test) or `PAYMENTS_LIVE_WEBHOOK_SECRET` (live)
4. If switching to live mode: add live `STRIPE_SECRET_KEY` and `VITE_PAYMENTS_CLIENT_TOKEN` (`pk_live_...`), create live prices with same lookup keys in Stripe live mode

**Why:** Webhooks are needed for subscription lifecycle events (renewals, failures, cancellations). The return-page flow (`verifyCheckoutSession`) works without webhooks for initial activation, but renewals and payment failures require webhook processing.
