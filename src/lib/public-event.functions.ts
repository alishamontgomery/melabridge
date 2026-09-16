/**
 * Server functions for the public event page (/e/:eventId).
 *
 * getPublicEventPage  — unauthenticated; calls security-definer RPCs
 *   get_public_event_page() and get_public_runsheet() that expose only the
 *   safe public-facing columns. The anon role has EXECUTE on those functions
 *   and no SELECT on the base tables.
 *
 * updatePublicPageSettings — authenticated planner only; uses requireSupabaseAuth
 *   so the user's JWT is forwarded and the existing events UPDATE RLS policy
 *   (owner_id = auth.uid()) enforces ownership — no extra check needed here.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ── Publishable-key (anon) client for public reads ────────────────────────────
function getPublicClient() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
  return createClient<Database>(url, key);
}

export type PublicEventData = {
  id: string;
  name: string;
  event_type: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  description: string | null;
  public_description: string | null;
  public_faqs: Array<{ q: string; a: string }>;
  gift_registry_url: string | null;
  show_schedule_public: boolean;
  show_rsvp_public: boolean;
  cover_image_url: string | null;
  tickets_enabled: boolean;
  schedule: Array<{
    id: string;
    title: string;
    start_time: string | null;
    duration_min: number;
    owner: string | null;
    status: string;
  }>;
};

// ── Public read — no auth required ────────────────────────────────────────────
// Routes through security-definer RPCs so the anon role never touches the
// base events table directly and only receives the designated safe columns.
export const getPublicEventPage = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const db = getPublicClient();

    // Call the security-definer RPC — returns only published events, safe cols only.
    const { data: rows, error } = await db.rpc(
      // The function isn't in the generated types yet; cast to any.
      "get_public_event_page" as any,
      { p_event_id: data.eventId },
    );
    if (error || !rows || (rows as unknown[]).length === 0) return null;

    const event = (rows as any[])[0] as Record<string, unknown>;

    // Fetch schedule via the dedicated RPC if public schedule is enabled.
    let schedule: PublicEventData["schedule"] = [];
    if (event.show_schedule_public) {
      const { data: runsheet } = await db.rpc(
        "get_public_runsheet" as any,
        { p_event_id: data.eventId },
      );
      schedule = ((runsheet ?? []) as unknown[]).map((r) => {
        const row = r as Record<string, unknown>;
        return {
          id: row.id as string,
          title: row.title as string,
          start_time: row.start_time as string | null,
          duration_min: row.duration_min as number,
          owner: row.owner as string | null,
          status: row.status as string,
        };
      });
    }

    const faqs = Array.isArray(event.public_faqs)
      ? (event.public_faqs as Array<{ q: string; a: string }>)
      : [];

    return {
      id: event.id as string,
      name: event.name as string,
      event_type: event.event_type as string | null,
      event_date: event.event_date as string | null,
      event_time: event.event_time as string | null,
      location: event.location as string | null,
      description: event.description as string | null,
      public_description: event.public_description as string | null,
      public_faqs: faqs,
      gift_registry_url: event.gift_registry_url as string | null,
      show_schedule_public: (event.show_schedule_public as boolean) ?? true,
      show_rsvp_public: (event.show_rsvp_public as boolean) ?? true,
      cover_image_url: event.cover_image_url as string | null,
      tickets_enabled: (event.tickets_enabled as boolean) ?? false,
      schedule,
    } satisfies PublicEventData;
  });

// ── Authenticated update — planner only ───────────────────────────────────────
// requireSupabaseAuth validates the planner's Bearer token and injects a
// Supabase client that sends the user's JWT on every request, so the existing
// events UPDATE RLS policy (owner_id = auth.uid()) enforces ownership — no
// additional ownership check is needed here.
export const updatePublicPageSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      eventId: z.string().uuid(),
      is_published: z.boolean().optional(),
      public_description: z.string().max(2000).optional(),
      public_faqs: z
        .array(z.object({ q: z.string().max(200), a: z.string().max(1000) }))
        .max(12)
        .optional(),
      gift_registry_url: z.string().url().optional().or(z.literal("")),
      show_schedule_public: z.boolean().optional(),
      show_rsvp_public: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase; // authenticated client — JWT forwarded, RLS active
    const patch: Record<string, unknown> = {};
    if (data.is_published !== undefined) patch.is_published = data.is_published;
    if (data.public_description !== undefined) patch.public_description = data.public_description || null;
    if (data.public_faqs !== undefined) patch.public_faqs = data.public_faqs;
    if (data.gift_registry_url !== undefined) patch.gift_registry_url = data.gift_registry_url || null;
    if (data.show_schedule_public !== undefined) patch.show_schedule_public = data.show_schedule_public;
    if (data.show_rsvp_public !== undefined) patch.show_rsvp_public = data.show_rsvp_public;

    // Cast to any — patch uses new columns not yet reflected in generated types
    const { error } = await (db.from("events") as any)
      .update(patch)
      .eq("id", data.eventId);
    if (error) throw new Error((error as { message: string }).message);
    return { ok: true };
  });
