---
name: Gemini model versions
description: Which Gemini API models are available vs deprecated as of Aug 2026
---

# Gemini model availability (August 2026)

## Working models (confirmed via API key)
- `gemini-3.5-flash` — fast, cheap, general purpose ✓ (use this as default)
- `gemini-3.5-flash-lite` — lighter variant ✓
- `gemini-3.1-flash-lite` — ✓
- `gemini-3-flash-preview` — ✓
- `gemini-flash-latest` — alias that follows latest flash ✓
- `gemini-flash-lite-latest` — alias ✓

## NOT available (return 404)
- `gemini-2.0-flash` — "no longer available"
- `gemini-2.0-flash-lite` — "no longer available"
- `gemini-2.0-flash-exp` — not found
- `gemini-2.5-flash` — "no longer available to new users"
- `gemini-2.5-flash-lite` — "no longer available"
- `gemini-1.5-flash` — not found for v1beta
- `gemini-2.5-flash-preview-05-20` — not found

## Current default in ai-client.server.ts
`gemini-3.5-flash`

**Why:** All 2.0 and 2.5 series models deprecated for new API keys as of Aug 2026. 3.x series is the active generation.

## Lovable gateway (event-bootstrap, event-drafts)
These use `fetch` to `https://ai.gateway.lovable.dev/v1/chat/completions` with prefix `google/`.
Model names there: `google/gemini-3.5-flash`, `google/gemini-3-flash-preview` — different format from direct SDK.
