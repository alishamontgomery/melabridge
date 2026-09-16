---
name: Marketplace postal search
description: Postal-only Marketplace searches must be sent to Google as location intent.
---

Numeric Marketplace input should not trigger Google business-keyword searches while a ZIP is still being typed. Wait for a complete five-digit postal value, pass it as location intent, and use a known center when available.

**Why:** Partial ZIP requests caused unnecessary Google calls and raw numeric business searches. A completed 35756 search returned a relevant Madison, AL event-services mix when sent as location intent.

**How to apply:** Keep postal detection separate from service text, preserve Google attribution, and verify the completed ZIP makes one bounded request with more than a trivial result set.