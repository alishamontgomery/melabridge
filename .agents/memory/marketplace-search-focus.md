---
name: Marketplace search focus
description: Focus stability constraint for the Marketplace search input.
---

The Marketplace search wrapper must be a stable top-level component. Defining the shell component inside MarketplacePage creates a new React component type on every query update, which remounts the search input and loses iPhone focus.

**Why:** Typing the first character changed query state, recreated the inline shell type, and replaced the input DOM node; subsequent digits were dropped.

**How to apply:** Keep MarketplaceShell outside MarketplacePage and avoid keys or conditional wrappers around the search control that change during typing. Focus-recovery timers must not run after the user moves to another field; guard against another active element and verify focus after each digit at a 390px viewport.