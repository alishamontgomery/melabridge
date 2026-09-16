---
name: Public view anonymous access
description: RLS behavior for public Supabase views used by logged-out marketplace pages
---

Public-facing Supabase views must use an explicit, redacted projection and `security_invoker = false` when the underlying table's RLS is owner-scoped. Keep the `WHERE` clause defensive for test and draft rows.

**Why:** Security-invoker views inherited the private vendor table policy and made logged-out Marketplace requests return 401 even though the view was intended to be public.

**How to apply:** When adding public marketplace/profile columns, update the view projection and its migration grants together; never expose private contact fields or owner identifiers just to avoid the RLS issue.