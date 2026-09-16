---
name: Stripe subscription page Realtime crash
description: The /subscription page crashed for all authenticated users due to Supabase Realtime .on() throwing synchronously inside a React StrictMode double-invoked useEffect.
---

## The rule

Supabase Realtime `.channel().on()` can throw synchronously if:
1. The table is not in the `supabase_realtime` publication.
2. React StrictMode double-invokes the effect (cleanup + re-run) and the channel is in a bad state on the second run.

Always wrap the realtime channel setup block in try/catch inside `useEffect`. A thrown error inside a `useEffect` body propagates to React and triggers the nearest error boundary.

**Why:** In dev mode React StrictMode mounts → unmounts → remounts every component. The second `.on()` call during the re-mount can throw, crashing the entire page into the error boundary even though the realtime listener is non-essential.

**How to apply:** Any `supabase.channel().on().subscribe()` block that lives inside a `useEffect` should be wrapped:
```ts
let channel = null;
try {
  channel = supabase.channel(...).on(...).subscribe();
} catch (e) {
  console.warn("Realtime setup failed:", e);
}
return () => { if (channel) supabase.removeChannel(channel); };
```

Also, the table must be added to the publication:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.<table_name>;
```
This was applied live to `public.subscriptions` via Supabase Management API.
