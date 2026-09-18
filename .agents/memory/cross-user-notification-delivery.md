---
name: Cross-user notification delivery
description: Authorization and failure-isolation rules for delivering account notifications to another user.
---

Authorize the originating event, booking, or calendar action with the caller's authenticated client, but perform recipient preference/profile reads and notification writes with the service client.

**Why:** Recipient rows are owner-scoped and notification inserts are service-role-only. A caller-scoped client can pass the business action while silently failing every cross-user delivery.

**How to apply:** Keep the trusted delivery call after the action's ownership checks. Do not loosen RLS. Attempt in-app and email channels independently so one failed channel cannot suppress another enabled channel.