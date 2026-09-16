---
name: Gemini model availability
description: The shared MelaAssist provider must use the currently available explicit Gemini model rather than a retired alias.
---

Use an explicit, currently available Gemini model for MelaAssist and verify it with a non-secret provider call when AI responses suddenly become unavailable.

**Why:** The previous configured model was retired by Google and returned a 404; the generic classifier made that failure look like a transient busy/rate-limit response.

**How to apply:** When changing or debugging the AI client, check provider model availability and keep graceful, specific failure messages for missing keys, quota, provider errors, and network failures.