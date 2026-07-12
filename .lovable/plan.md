# MelaBridge UX Redesign + RBAC + Contact Info

This is a large change. I'll break it into four coordinated workstreams, all shipped together.

## 1. Role model & RBAC

**Data**
- New enum `app_role`: `planner`, `vendor`, `guest`, `admin`.
- New table `public.user_roles (user_id, role)` with proper GRANTs, RLS, and unique `(user_id, role)`.
- `has_role(_user_id, _role)` security-definer function.
- Auto-assign role on signup based on onboarding `account_type` (extend `handle_new_user` trigger or add a post-onboarding writer).
- Tighten existing RLS: events (planner owns), vendor_profiles (vendor owns), guest access via `event_members`.

**Client**
- `useRole()` hook reading `user_roles`, cached in React Query.
- `RoleGate` component + `requireRole` helper for route `beforeLoad`.
- Role-aware redirect from `/dashboard` → planner/vendor/guest/admin home.

## 2. Navigation redesign (AppShell rewrite)

Replace the current flat sidebar with a **grouped, collapsible sidebar** (shadcn `Sidebar`, `collapsible="icon"`) driven by role. ~10–12 top-level items per role, organized into sections.

**Planner sidebar**
- Dashboard: Home, My Events
- Planning: Guests, Vendors, Budget, Timeline, Tasks
- Communication: Messages, Team
- Resources: Files
- Account: Profile, Subscription, Settings, Help

**Vendor sidebar**
- Dashboard: Home
- Business: Leads, Bookings, Calendar, Payments, Contracts
- Communication: Messages
- Resources: Files
- Account: Business Profile, Reviews, Settings, Help

**Guest sidebar** (minimal top bar, no side nav)
- Event Details, RSVP, Schedule, Travel, Registry, Photos, Messages

**Admin sidebar**
- Dashboard: Overview
- Platform: Users, Vendors, Events, Marketplace, Payments, Analytics, Reports
- System: AdminOS, AI Command Center, Ecosystem Map
- AI & Memory (single item → hub page)
- Settings: Platform Settings, Subscription Management, Feature Flags

## 3. Feature consolidation

- New `/ai-memory` hub page presenting BridgeLive, BridgeVault, Digital Twin, BridgeGraph, BridgeWorld, BridgeDNA, Bridge Intelligence as cards with descriptions. Admin-only in nav.
- New `/marketplace-hub` (or reuse existing `/marketplace`) that groups Vendor Search, Contracts, Payments as cards for planners.
- Existing branded routes stay reachable by URL but are removed from top-level nav.

## 4. Dashboards

- **Planner** `/dashboard`: Upcoming Events, Tasks Due Today, Budget Snapshot, Recent Messages, Vendor Activity, Timeline Progress, Quick Actions (Create Event, Invite Guests, Find Vendors). No empty enterprise modules.
- **Vendor** `/vendor`: already exists — trim modules, keep leads/bookings/payments focus.
- **Guest** `/guest-portal`: already exists — verify simplicity.
- **Admin** `/admin`: already exists — reorganize to match new nav.

## 5. Global contact info updates

Replace across codebase:
- Email → `hello@melabridge.com`
- Phone → `+1 (256) 784-8427` (with `tel:+12567848427`)
- Facebook links → `https://www.facebook.com/melabridge` with `target="_blank" rel="noopener noreferrer"`

Files touched: `contact.tsx`, `site-footer.tsx`, `help.tsx`, `privacy.tsx`, `terms.tsx`, marketing pages, any notification/email templates. I'll grep to catch everything.

---

## Technical notes

- New migration for `app_role` enum, `user_roles` table, `has_role()`, RLS updates, and onboarding trigger.
- `AppShell` becomes role-aware — accepts no `active` prop change, just filters `NAV_GROUPS` by role.
- Guest portal keeps its own minimal shell (no sidebar).
- Route guards: keep integration-managed `_authenticated/route.tsx`; add per-route `beforeLoad` role checks where relevant (admin routes, vendor routes).
- Existing routes not in the new nav remain accessible via URL — no dead links, but hidden from sidebar.

## Out of scope (call out)

- Building brand-new full pages for admin sub-items (Users, Feature Flags, etc.) — I'll wire nav + stub pages where they don't exist, but deep functionality is a follow-up.
- Sending actual transactional emails — I'll update templates/strings only.

Approve and I'll ship it in one pass.