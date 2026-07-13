import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ---------- List calendar connections ---------- */

export const listCalendarConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("calendar_connections")
      .select(
        "id, provider, external_account_email, external_calendar_id, sync_direction, last_synced_at, last_error, is_active, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* ---------- Disconnect provider ---------- */

export const disconnectCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ provider: z.enum(["google", "outlook"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calendar_connections")
      .delete()
      .eq("user_id", context.userId)
      .eq("provider", data.provider);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- Get or create ICS subscription URL ---------- */

function randomToken(len = 32): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const getIcsUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rotate: z.boolean().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("ics_token")
      .eq("id", context.userId)
      .single();
    if (pErr) throw new Error(pErr.message);

    let token = profile?.ics_token ?? null;
    if (!token || data.rotate) {
      token = randomToken(24);
      const { error: uErr } = await context.supabase
        .from("profiles")
        .update({ ics_token: token })
        .eq("id", context.userId);
      if (uErr) throw new Error(uErr.message);
    }

    return { token };
  });
