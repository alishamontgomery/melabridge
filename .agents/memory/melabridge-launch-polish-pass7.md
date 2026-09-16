---
name: QA stabilization pass 7 (updated)
description: Now also covers the large consistency pass — profile scoping, plan renames, lead simplification, admin ticketing bypass, and landing page improvements.
---

See melabridge-launch-polish-pass6.md for the original pass 7 content (storage RLS, photos redesign, URL normalization, mobile inquiry dialog, auth redirect).

This file covers the additional consistency pass applied on top:
- **Plan renames**: vendor_professional "Professional" → "Business"; planner_professional "Professional Planner" → "Pro Planner"
- **host_free featured removed** so no "Most Popular" badge on the free host plan
- **Feature lists rewritten** per audience to be genuinely distinct (host=personal events/guests/AI, vendor=profile/leads/portfolio/tickets, planner=clients/team/reporting)
- **Audience scoping after login**: `lockedAudience` computed in subscription.tsx from role + `user.user_metadata.account_type`; hides tabs for non-admin users; vendor → "vendor", pro_planner metadata → "planner", all others → "host"
- **Upgrade modal scoped**: upgrade-modal.tsx uses useRole() + user metadata to find the right plan from gate.requiredPlans matching userAudience; never shows other-audience plans
- **Admin feature gate bypass**: use-feature-gate.ts now returns allowed=true for admin role regardless of subscription
- **Admin ticketing sandbox**: New TicketingSandboxSection in admin.index.tsx with test card numbers and flow walkthrough
- **Signup: 3 options**: host ("Hosting or organizing events"), vendor ("Running an event business"), planner ("A professional event planner"); maps to account_type "host"/"vendor"/"pro_planner" in user metadata
- **Lead pipeline simplified**: TRACKER_STAGES now 5 steps: saved(New)→contacted→quote_sent(Interested)→booked(Hired)→completed(Closed); stage labels cleaned; InvoicesAndSchedule removed; dropdown simplified
- **Booking detail CRM**: "Log quote sent" → "Move to Interested"; "Log payment received" → "Mark as Hired"; "Record client action" sub-menu removed
- **Landing page**: 3 distinct audience sections (Hosts & Families, Vendors & Businesses, Professional Planners) with genuinely distinct benefit lists; nav updated; venues section removed (folded into vendors)

**Why (audience scoping)**:
User complaint: "I hate how when upgrading it shows other profile types." Solution: lock authenticated users to their own audience everywhere — subscription page, upgrade modal, and feature gate suggestions.

**account_type metadata mapping**:
- Old signups: account_type "planner" = host (was confusingly named); treated as "host" audience
- New signups: "host" → host audience, "pro_planner" → planner audience, "vendor" → vendor audience

**CRITICAL BUG FIX — ensureProfile DB mapping**:
user_metadata now stores fine-grained values ("host", "pro_planner") but the `profiles` table and `user_roles` table only accept the legacy broad values ("organization", "vendor", "personal"). `ensureProfile` MUST map before upserting:
- "host" → dbAccountType "organization", dbRole "organization"
- "pro_planner" → dbAccountType "organization", dbRole "organization"
- "vendor" → dbAccountType "vendor", dbRole "vendor"
Without this mapping, new signups and sign-ins throw a DB constraint error surfaced as "something went wrong."
The fine-grained metadata value is preserved untouched in `user.user_metadata.account_type` for subscription scoping.

**Admin bypass**:
Admin must be able to test ticketing without a subscription. Bypass is in use-feature-gate.ts. Admin can create events and sell tickets in Stripe test mode without purchasing a plan.
