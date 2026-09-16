---
name: MelaBridge role routing
description: How personal/vendor/admin roles are separated in navigation, redirects, and route guards.
---

## Rule
Role separation has three layers — all three must stay in sync when adding new routes.

1. **NAV_BY_ROLE** (`src/components/app-shell.tsx`): maps `AppRole` → `NavGroup[]`. Determines what links a user sees in the sidebar.
2. **ROLE_EXCLUSIVE** (`src/components/app-shell.tsx`): prefix-based allow-list. If a user lands on a path they're not allowed on, `AppShell` redirects them to `roleHome(role)`.
3. Post-login routing and in-app role resolution must use the same priority: admin role first, then `profiles.account_type` as the active role, then legacy role/vendor fallbacks.
4. Signup metadata maps personal hosts to `personal`, professional planners to `organization`, and vendors to `vendor`.

**Why:** Conflicting role priorities caused redirect loops for users with historical role rows, and mapping hosts to organizations sent personal event hosts through the planner onboarding flow.

**How to apply:** Keep signup mapping, callback routing, role hooks, navigation, and route allow-lists aligned. Treat the profile role as active unless the user is an admin.
