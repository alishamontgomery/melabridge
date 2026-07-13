import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ---------------- Types ---------------- */

const ExtractedSchema = z
  .object({
    name: z.string().nullable().optional(),
    event_type: z.string().nullable().optional(),
    event_date: z.string().nullable().optional(),
    start_time: z.string().nullable().optional(),
    end_time: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    venue_street: z.string().nullable().optional(),
    venue_city: z.string().nullable().optional(),
    venue_state: z.string().nullable().optional(),
    venue_zip: z.string().nullable().optional(),
    client_name: z.string().nullable().optional(),
    client_email: z.string().nullable().optional(),
    client_phone: z.string().nullable().optional(),
    guest_target: z.number().nullable().optional(),
    deposit_required: z.number().nullable().optional(),
    event_notes: z.string().nullable().optional(),
    status: z
      .enum(["inquiry", "quote_sent", "confirmed", "draft", "planning", "consultation_scheduled", "tentative"])
      .nullable()
      .optional(),
  })
  .partial();

export type ExtractedEvent = z.infer<typeof ExtractedSchema>;

/* ---------------- List ---------------- */

export const listDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("event_drafts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* ---------------- Extract via Lovable AI ---------------- */

const ExtractInput = z.object({
  raw_input: z.string().trim().min(4).max(8000),
  source: z
    .enum(["email", "message", "voice", "manual_paste", "assistant"])
    .default("manual_paste"),
  source_reference: z.string().max(300).optional(),
});

export const extractDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const system = `You extract event booking details from vendor communications for an Indian/South Asian event platform (MelaBridge).
Return ONLY strict JSON with keys: name, event_type, event_date (YYYY-MM-DD), start_time (HH:MM 24h), end_time, location, venue_street, venue_city, venue_state, venue_zip, client_name, client_email, client_phone, guest_target (integer), deposit_required (number), event_notes, status, summary, confidence (0..1), field_confidences (object mapping each field to 0..1), suggested_next_actions (array of short strings).
Use null for anything not present. Do not invent details. Event types include Wedding, Sangeet, Mehndi, Reception, Engagement, Anniversary, Birthday, Corporate, Other.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.raw_input },
        ],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`AI extraction failed [${resp.status}]: ${body}`);
    }
    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    const extracted = ExtractedSchema.parse(
      Object.fromEntries(
        Object.entries(parsed).filter(([k]) =>
          [
            "name",
            "event_type",
            "event_date",
            "start_time",
            "end_time",
            "location",
            "venue_street",
            "venue_city",
            "venue_state",
            "venue_zip",
            "client_name",
            "client_email",
            "client_phone",
            "guest_target",
            "deposit_required",
            "event_notes",
            "status",
          ].includes(k),
        ),
      ),
    );

    const confidence = Math.max(
      0,
      Math.min(1, Number(parsed.confidence ?? 0.6) || 0.6),
    );
    const summary =
      typeof parsed.summary === "string" ? parsed.summary : null;
    const field_confidences =
      parsed.field_confidences && typeof parsed.field_confidences === "object"
        ? parsed.field_confidences
        : {};
    const suggested_next_actions = Array.isArray(parsed.suggested_next_actions)
      ? parsed.suggested_next_actions.filter(
          (x): x is string => typeof x === "string",
        )
      : [];

    const { data: inserted, error } = await context.supabase
      .from("event_drafts")
      .insert({
        owner_id: context.userId,
        status: "pending",
        source: data.source,
        source_reference: data.source_reference ?? null,
        raw_input: data.raw_input,
        confidence,
        field_confidences: field_confidences as never,
        extracted: extracted as never,
        summary,
        suggested_next_actions: suggested_next_actions as never,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return inserted;
  });

/* ---------------- Update ---------------- */

const UpdateInput = z.object({
  id: z.string().uuid(),
  extracted: ExtractedSchema.optional(),
  review_notes: z.string().max(1000).nullable().optional(),
});

export const updateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("event_drafts")
      .update({
        status: "edited",
        ...(data.extracted ? { extracted: data.extracted as never } : {}),
        ...(data.review_notes !== undefined ? { review_notes: data.review_notes } : {}),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* ---------------- Discard ---------------- */

export const discardDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("event_drafts")
      .update({ status: "discarded", reviewed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Approve → creates event ---------------- */

export const approveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: draft, error: dErr } = await context.supabase
      .from("event_drafts")
      .select("*")
      .eq("id", data.id)
      .single();
    if (dErr || !draft) throw new Error(dErr?.message ?? "Draft not found");

    const ex = (draft.extracted ?? {}) as ExtractedEvent;
    const name = (ex.name ?? "").trim() || "Untitled Event";

    const { data: event, error: eErr } = await context.supabase
      .from("events")
      .insert({
        owner_id: context.userId,
        name,
        event_type: ex.event_type ?? "Other",
        event_date: ex.event_date ?? null,
        event_time: ex.start_time ?? null,
        start_time: ex.start_time ?? null,
        end_time: ex.end_time ?? null,
        location: ex.location ?? null,
        venue_street: ex.venue_street ?? null,
        venue_city: ex.venue_city ?? null,
        venue_state: ex.venue_state ?? null,
        venue_zip: ex.venue_zip ?? null,
        client_name: ex.client_name ?? null,
        client_email: ex.client_email ?? null,
        client_phone: ex.client_phone ?? null,
        guest_target: ex.guest_target ?? null,
        deposit_required: ex.deposit_required ?? null,
        event_notes: ex.event_notes ?? null,
        description: ex.event_notes ?? null,
        status: ex.status ?? "inquiry",
        source_draft_id: draft.id,
      })
      .select("id")
      .single();
    if (eErr || !event) throw new Error(eErr?.message ?? "Could not create event");

    await context.supabase
      .from("event_drafts")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        approved_event_id: event.id,
      })
      .eq("id", draft.id);

    return { eventId: event.id };
  });
