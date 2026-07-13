# MelaBridge Launch Readiness Sprint — Execution Plan

This master prompt covers 24 workstreams. Shipping it in one turn would produce shallow work and regressions. I'll execute it in **8 sequenced phases**, each independently deployable and verifiable. Confirm the order (or reorder) and I'll start Phase 1.

Some items overlap with work already shipped in prior phases (booking pipeline, notifications, invoices, email templates). Those become **audit-only** — no rebuild.

---

## Already in place (audit only)

- 12-stage booking pipeline with contract+deposit rule (§17) — audit stage labels only
- Notification center + realtime (§4-prior)
- Invoices & payment schedule auto-generated on `booked` (§17 payment side)
- Auth + transactional email scaffolding (§15 base)
- Booking cannot reach `booked` without rule satisfied (§17, §24)

---

## Phase 1 — Credibility & messaging cleanup (§1, §3, §4, §5, §10, §12, §20)

Remove every unsupported claim across the marketing site.

- Strip fake stats (12,400 events, 38 countries, SOC 2, fake logos/testimonials) from `index.tsx`, `about.tsx`, `features.tsx`, `how-it-works.tsx`, `ai-planning.tsx`, `vision.tsx`, `bridge-*` pages
- Replace with **Early Access** messaging ("Now welcoming planners and vendors", "Join the first wave")
- Replace "escrow" with "Secure payments powered by Stripe" everywhere
- Remove funeral / celebration-of-life references from category lists
- Homepage headline: "Your complete event workspace" / "Everything you need to plan your event"
- Tone down AI claims (no "10,000 simulations", "predictive engine", "world-class")
- Tag every unfinished feature with `Coming Soon` / `Beta` badges (escrow, digital contracts, QR check-in, silent auctions, floor plans, calendar sync where not shipped, vendor AI matching)
- Unify positioning: "The intelligent platform for planning every event"

## Phase 2 — Pricing restructure (§2)

Rewrite `src/lib/billing-config.ts` and `pricing.tsx` / `subscription.tsx`:

- **Free (Host)**: unlimited personal event planning, guests, budget, timeline, tasks, basic AI, marketplace access
- **MelaAssist Plus**: premium AI, automation, smart reminders, calendar integrations, priority support
- **Vendor**: Free Listing / Professional / Premium (featured, AI assistant, lead automation, analytics)
- **Professional Planner**: business mgmt, client portals, team, reporting, branding, automation
- Remove any paywall on core event planning for families
- Keep existing Stripe price IDs where possible; add new ones via `payments--create_price` where needed

## Phase 3 — Public vs authenticated separation + nav (§6, §7)

- Extract public `<SiteHeader>` component with: Product, Marketplace, For Vendors, Pricing, About, Help, Log In, Get Started
- Apply to every public route (`index`, `about`, `features`, `pricing`, `marketplace`, `vendors`, `how-it-works`, `help`, `faq`, `contact`, `bridge-*`, etc.)
- Ensure `AppShell` (planner sidebar) never renders on public routes
- Anonymous visit to `/` must show marketing chrome only

## Phase 4 — Homepage, AI page, thin pages, FAQ (§10, §11, §13, §14, §21)

- Homepage: prioritize hosts → planners → vendors → venues in that order
- `ai-planning.tsx`: dedupe MelaAssist heading; sections = Planning Assistant, Smart Recommendations, Timeline Intelligence, Budget Intelligence, Risk Detection, Vendor Assistance, Decision Support
- Expand `features.tsx`, `about.tsx`, `help.tsx`, `how-it-works.tsx`, `pricing.tsx`, `ai-planning.tsx` with intro + screenshots + use cases + benefits + FAQ + CTA
- `faq.tsx`: keyboard-accessible accordion, real answers on every question

## Phase 5 — Auth + multi-role profiles (§15, §16)

- Registration form: confirm password, show/hide toggle, strength meter, terms/privacy checkboxes
- Resend verification email flow
- Google login error handling
- Post-signup role picker: Planner / Professional Planner / Vendor / Venue / Guest (multi-select)
- Multi-role profile switcher in account menu (single login, multiple profiles via `user_roles` table — already exists)
- Add profile later from settings

## Phase 6 — Marketplace + AI drafts + vendor workflow (§8, §18, §19)

- Marketplace empty state: "We're onboarding our first verified vendors" + Become a Vendor / Request a Vendor / Notify Me CTAs
- No infinite loading — proper empty/loading/error states
- AI event creation → always creates `event_drafts` row; review screen with Approve / Edit / Discard (drafts table already exists)
- Vendor workflow UI: Save, Compare, Request Quote, Request Availability, Invite External, Manual Add (planner side); Accept, Send Quote, Generate/Upload Contract, Signature, Request Deposit (vendor side)

## Phase 7 — Dashboard data consistency + booking labels (§9, §17)

- Audit demo/mock numbers — make them internally consistent (84 days, 96/142 guests → 34 pending + 12 declined, budget totals reconcile)
- Rename booking stages per master prompt: Saved / Contacted / Availability Requested / Quote Received / Negotiating / Contract Sent / Contract Signed / Deposit Received / Booked / Completed / Cancelled
- Confirm `fn_apply_confirmation_rule` still blocks `booked` without contract+deposit

## Phase 8 — Launch polish + QA (§22, §24)

Automated sweep via Playwright + code audit:

- Every `<Link>` target exists, every button has an onClick or Coming Soon label
- No placeholder text, no dead routes, no fabricated content
- Empty states everywhere
- Responsive check at 375/768/1280
- Form validation + error messages
- A11y: keyboard nav, focus states, labels, contrast
- Console error scan, network 4xx/5xx scan
- Signed-off QA report

---

## Preserved (not touched — §23)

- Existing branding, logo, color palette, typography
- Capture A Perfect Memory package assets + pricing + CheckCherry embed
- Working functionality (bookings, invoices, notifications, calendar, messaging)

---

## What I need from you

1. **Approve phase order** or reorder (e.g. "auth before pricing").
2. **Confirm pricing amounts** for MelaAssist Plus, Vendor Pro/Premium, Professional Planner — or say "you pick reasonable numbers and I'll adjust in Stripe later".
3. **Confirm which features are truly shipped vs Coming Soon** so I tag correctly. My current read:
   - Shipped: bookings, invoices, notifications, calendar module, messaging, tasks, budget, guests, marketplace search, Stripe subscriptions, AI planning (basic)
   - Coming Soon: escrow (removing), digital contracts (e-sign), QR check-in, silent auctions, floor plans, vendor AI matching, calendar 2-way sync
   - Confirm or correct.

On approval I'll start **Phase 1** immediately and ship it end-to-end (code + Playwright verification) before moving on. Each phase ends at a deployable checkpoint.
