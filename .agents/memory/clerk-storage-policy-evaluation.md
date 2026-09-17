---
name: Clerk Storage policy evaluation
description: Avoid UUID-casting policy expressions across shared Supabase Storage operations when Clerk supplies the JWT subject.
---

Every Supabase Storage policy for a given operation must be safe to evaluate with a Clerk `sub`. Do not leave `auth.uid()` in any INSERT policy on a shared bucket when Clerk subjects use `user_...`; the same rule applies independently to UPDATE and DELETE policies.

**Why:** PostgreSQL may evaluate multiple permissive policies for one operation. An unrelated path policy that calls `auth.uid()` can raise an invalid-UUID error before another policy authorizes the correct path, so a valid owner-scoped upload still fails.

**How to apply:** Compare raw Clerk-owned path segments to `auth.jwt() ->> 'sub'`. Use `current_app_user_id()` only when checking UUID-owned relational records, and make every same-operation Storage policy safe for Clerk JWTs.

Qualify the Storage object path as `objects.name` inside policy subqueries. An unqualified `name` can bind to a joined table's column (such as an event or package name), making every ownership check fail even when the outer path is valid.