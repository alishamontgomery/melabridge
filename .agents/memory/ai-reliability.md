---
name: Shared MelaAssist reliability
description: Production rules for keeping MelaBridge AI entry points reliable and safe.
---

All MelaBridge AI entry points must use the shared production Gemini client, with bounded retries, explicit supported model selection, fallback handling, timeouts, and schema-aware response validation. Invalid or empty structured output must never be persisted or presented as a successful AI result.

**Why:** Separate preview gateways and retired model aliases previously produced generic provider failures, while permissive JSON parsing allowed low-information drafts to continue as if generation succeeded.

**How to apply:** When adding or changing planner, event, vendor, or bootstrap AI flows, route requests through the shared client and keep deterministic fallbacks explicitly labeled as non-AI.