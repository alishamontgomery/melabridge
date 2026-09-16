---
name: Vite dep optimization crash — TanStack Router context split
description: Why the app crashes with "Invalid hook call" in OutletImpl and how to prevent it.
---

## The Problem

Installing a new Node.js-only package (e.g. `@google/genai`) causes Vite's dep scanner to re-scan
on first page load and lazily discover TanStack Router's subpath exports
(`@tanstack/router-core/isServer`, `/ssr/client`, `/ssr/server`, `@tanstack/history`, `seroval`,
`h3-v2`). Vite then re-bundles those packages and forces a hot reload mid-session.

After the reload, `OutletImpl` from the new chunk calls `useRouter` which looks for `RouterContext`
from a *different module instance* than the one `RouterProvider` registered → `useContext` returns
`undefined` → React throws "Invalid hook call" (its generic catch-all for a null dispatcher).

**This is not a duplicate-React bug.** Only one React instance exists. The problem is that
TanStack Router's own contexts get split across old and new Vite module instances during the
lazy re-bundle reload.

## The Fix (applied in vite.config.ts)

```ts
optimizeDeps: {
  include: [
    "@tanstack/react-router",
    "@tanstack/router-core",
    "@tanstack/router-core/isServer",
    "@tanstack/router-core/ssr/client",
    "@tanstack/router-core/ssr/server",
    "@tanstack/history",
    "seroval",
    "h3-v2",
  ],
  exclude: [
    "@google/genai",
    "google-auth-library",
    "protobufjs",
    "ws",
  ],
}
```

- `include`: Forces pre-bundling at startup so these packages are never lazily discovered mid-session.
- `exclude`: Prevents the client optimizer from trying to process Node.js-only deps (which would
  add them to the scan surface and re-trigger lazy bundling of router packages).

**Why:** Whenever a new Node.js package is added, re-check whether its transitive deps appear in
the lazy-optimization log (`[optimizer] bundling dependencies...` followed by
`optimized dependencies changed. reloading`). If they do, add the router subpath packages to
`optimizeDeps.include` again (they sometimes get reset if the base config changes).

## Secondary fix: ErrorComponent must not call useRouter()

`__root.tsx`'s `ErrorComponent` previously called `useRouter()` at the top level. When this
component is rendered because the router context is broken, the hook fails a second time,
masking the real error. Replaced `router.invalidate(); reset()` with `window.location.reload()`
so the error boundary always recovers safely.

**How to apply:** Any error component registered on a root or near-root route should never call
router hooks (`useRouter`, `useNavigate`, `useLocation`). Use `window.location.href` for
navigation and `window.location.reload()` for recovery.
