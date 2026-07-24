import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * MelaAssist turn — extends `askMelaAssist` with:
 *   - conversation history (so follow-ups don't repeat context)
 *   - workspace memory (current task / event / vendor)
 *   - structured actions and next-step suggestions in the response
 *
 * The legacy `askMelaAssist` server function is left intact for backward compat.
 */

const ROLE_KINDS: Record<string, string[]> = {
  vendor: [
    "update_business_description",
    "create_package",
    "create_faq",
    "draft_message",
  ],
  personal: [
    "update_event_notes",
    "create_budget_item",
    "create_task",
    "generate_timeline",
    "generate_budget",
    "recommend_vendors",
    "draft_message",
  ],
  organization: [
    "update_event_notes",
    "create_budget_item",
    "create_task",
    "generate_timeline",
    "generate_budget",
    "recommend_vendors",
    "draft_message",
  ],
  admin: [],
  guest: [],
};

const HistoryMsg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

const MemoryShape = z
  .object({
    currentTask: z.string().max(200).nullable().optional(),
    currentDraft: z.string().max(4000).nullable().optional(),
    currentPackageId: z.string().max(80).nullable().optional(),
    currentEventId: z.string().uuid().nullable().optional(),
    currentVendorId: z.string().uuid().nullable().optional(),
    currentPlannerId: z.string().uuid().nullable().optional(),
    scratch: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  })
  .partial()
  .optional();

const TurnInput = z.object({
  question: z.string().trim().min(2).max(2000),
  eventId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  role: z.enum(["personal", "organization", "vendor", "admin", "guest"]).optional(),
  pathname: z.string().max(200).optional(),
  history: z.array(HistoryMsg).max(20).optional(),
  memory: MemoryShape,
});

type SupabaseCtx = { supabase: any; userId: string };

async function loadEventContext(ctx: SupabaseCtx, eventId?: string | null) {
  const targetId = eventId ?? undefined;
  let resolved = targetId;
  if (!resolved) {
    const { data } = await ctx.supabase
      .from("events")
      .select("id")
      .eq("owner_id", ctx.userId)
      .is("deleted_at", null)
      .order("event_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    resolved = data?.id;
  }
  if (!resolved) return null;
  const [e, g, t, b] = await Promise.all([
    ctx.supabase
      .from("events")
      .select("id, name, event_type, event_date, event_time, location, budget_target, guest_target")
      .eq("id", resolved)
      .maybeSingle(),
    ctx.supabase.from("guests").select("id, rsvp_status").eq("event_id", resolved).is("deleted_at", null),
    ctx.supabase.from("tasks").select("id, status, due_date").eq("event_id", resolved).is("deleted_at", null),
    ctx.supabase
      .from("budget_items")
      .select("category, estimated_amount, paid_amount")
      .eq("event_id", resolved)
      .is("deleted_at", null),
  ]);
  if (!e.data) return null;
  const guests = (g.data ?? []) as any[];
  const tasks = (t.data ?? []) as any[];
  const budget = (b.data ?? []) as any[];
  return {
    event: e.data,
    counts: {
      guests_total: guests.length,
      guests_confirmed: guests.filter((r) => r.rsvp_status === "yes").length,
      tasks_total: tasks.length,
      tasks_open: tasks.filter((r) => r.status !== "done").length,
      budget_estimated: budget.reduce((s, r) => s + Number(r.estimated_amount ?? 0), 0),
      budget_paid: budget.reduce((s, r) => s + Number(r.paid_amount ?? 0), 0),
    },
  };
}

async function loadVendorContext(ctx: SupabaseCtx) {
  const { data } = await ctx.supabase
    .from("vendor_profiles")
    .select("id, business_name, business_category, business_description, city, state, starting_price")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  return data ?? null;
}

function extractJsonBlock(raw: string): unknown | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  // Try full parse first
  try {
    return JSON.parse(candidate);
  } catch {
    /* try substring */
  }
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const slice = candidate.slice(first, last + 1);
    try {
      return JSON.parse(slice);
    } catch {
      return null;
    }
  }
  return null;
}

export const melaAssistTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TurnInput.parse(input))
  .handler(async ({ data, context }) => {
    type OutAction = { kind: string; title: string; summary?: string; payload: Record<string, unknown> };
    type TurnResult = { answer: string; actions: OutAction[]; nextSteps: string[]; degraded: boolean };
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      const r: TurnResult = {
        answer: "MelaAssist is temporarily unavailable. Please try again shortly.",
        actions: [],
        nextSteps: [],
        degraded: true,
      };
      return r;
    }

    const supaCtx = context as SupabaseCtx;
    const role = data.role ?? "personal";
    const kinds = ROLE_KINDS[role] ?? ROLE_KINDS.personal;

    const [eventCtx, vendorCtx] = await Promise.all([
      role === "personal" || role === "organization" || role === "admin"
        ? loadEventContext(supaCtx, data.memory?.currentEventId ?? data.eventId ?? null)
        : Promise.resolve(null),
      role === "vendor" ? loadVendorContext(supaCtx) : Promise.resolve(null),
    ]);

    const workspace = {
      role,
      pathname: data.pathname ?? null,
      currentTask: data.memory?.currentTask ?? null,
      currentDraft: data.memory?.currentDraft ?? null,
      currentEventId: eventCtx?.event?.id ?? data.memory?.currentEventId ?? null,
      currentVendorId: vendorCtx?.id ?? data.memory?.currentVendorId ?? null,
      event: eventCtx,
      vendor: vendorCtx,
    };

    const actionSchemaHint =
      kinds.length > 0
        ? `Available action kinds: ${kinds.join(", ")}. Only use these kinds. Include actions ONLY when the user's request calls for a concrete change; otherwise return an empty array.`
        : `Do not propose actions for this role. Return an empty actions array.`;

    const system = `You are MelaAssist, the AI concierge inside MelaBridge.
You are aware of workspace context (user, role, page, current event, current vendor, current task).
When the user asks for a concrete change (create, update, draft, generate, add, rewrite), respond with:
  (1) a short conversational answer (2-4 sentences, plain prose, no markdown headings/bullets),
  (2) a strict JSON block at the end of the message wrapped in \`\`\`json ... \`\`\`.

JSON schema:
{
  "answer": string,               // same as the prose above; short
  "actions": [
    {
      "kind": "<one of the allowed kinds>",
      "title": string,             // human-facing card title
      "summary": string,           // one-line description
      "payload": {                 // free-form structured content the user will approve
        // For text-heavy actions include a "text" or "description" string.
      }
    }
  ],
  "nextSteps": [string]            // 2-4 short next-step labels the user could tap
}

Rules:
- ${actionSchemaHint}
- Never invent vendor names, prices, or contracts.
- Do NOT execute anything. You only propose. The user approves or edits.
- Follow up naturally on prior conversation and the current task in workspace memory.
- If the user says "another one", "make them premium", "shorten this", assume they mean the last action/topic.
- If you have nothing to change, return actions: [] and give a helpful answer.`;

    const historyMessages = (data.history ?? []).slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const userMessage = `Workspace (JSON):
${JSON.stringify(workspace)}

User message: ${data.question}`;

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            ...historyMessages,
            { role: "user", content: userMessage },
          ],
        }),
      });
      if (resp.status === 429)
        return { answer: "MelaAssist is busy right now — please try again in a moment.", actions: [], nextSteps: [], degraded: true };
      if (resp.status === 402)
        return { answer: "MelaAssist is temporarily paused on this workspace. Please contact your admin.", actions: [], nextSteps: [], degraded: true };
      if (!resp.ok)
        return { answer: "MelaAssist couldn't reach the planning engine. Please try again.", actions: [], nextSteps: [], degraded: true };

      const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = (json.choices?.[0]?.message?.content ?? "").trim();

      // Parse structured block if present.
      const parsed = extractJsonBlock(raw) as
        | { answer?: string; actions?: any[]; nextSteps?: string[] }
        | null;

      let answer = parsed?.answer;
      if (!answer) {
        // Strip fenced JSON block from prose so the user only sees the answer.
        answer = raw.replace(/```(?:json)?\s*[\s\S]*?```/i, "").trim();
      }

      const validKinds = new Set(kinds);
      const actions = Array.isArray(parsed?.actions)
        ? parsed!.actions
            .filter(
              (a: any): a is { kind: string; title: string; summary?: string; payload?: any } =>
                a && typeof a.kind === "string" && typeof a.title === "string" && validKinds.has(a.kind),
            )
            .slice(0, 6)
            .map((a: any) => ({
              kind: a.kind,
              title: String(a.title).slice(0, 140),
              summary: typeof a.summary === "string" ? a.summary.slice(0, 240) : undefined,
              payload:
                a.payload && typeof a.payload === "object" && !Array.isArray(a.payload)
                  ? a.payload
                  : { text: String(a.payload ?? "") },
            }))
        : [];

      const nextSteps = Array.isArray(parsed?.nextSteps)
        ? parsed!.nextSteps.filter((s: unknown): s is string => typeof s === "string").slice(0, 6)
        : [];

      return {
        answer: answer || "I don't have a good answer for that yet — try rephrasing.",
        actions,
        nextSteps,
        degraded: false,
      };
    } catch {
      return {
        answer: "MelaAssist couldn't reach the planning engine. Please try again.",
        actions: [],
        nextSteps: [],
        degraded: true,
      };
    }
  });

/**
 * Execute an approved MelaAssist action. Dispatches by kind.
 * Only kinds with real executors are supported here — preview-only kinds
 * are handled on the client (copy to clipboard) and never call this endpoint.
 */
const ExecInput = z.object({
  kind: z.enum([
    "update_business_description",
    "update_event_notes",
    "create_budget_item",
    "create_task",
  ]),
  payload: z.record(z.unknown()),
  eventId: z.string().uuid().optional(),
});

export const executeMelaAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExecInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const p = data.payload as Record<string, unknown>;

    async function resolveEventId(): Promise<string | null> {
      if (data.eventId) return data.eventId;
      const { data: e } = await supabase
        .from("events")
        .select("id")
        .eq("owner_id", userId)
        .is("deleted_at", null)
        .order("event_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      return e?.id ?? null;
    }

    switch (data.kind) {
      case "update_business_description": {
        const text = (p.text ?? p.description ?? p.content) as string | undefined;
        if (!text || typeof text !== "string" || text.trim().length < 5)
          throw new Error("Description is too short.");
        const { data: existing } = await supabase
          .from("vendor_profiles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!existing) throw new Error("Create a vendor profile first.");
        const { error } = await supabase
          .from("vendor_profiles")
          .update({ business_description: text.trim() })
          .eq("user_id", userId);
        if (error) throw new Error(error.message);
        return { ok: true };
      }
      case "update_event_notes": {
        const text = (p.text ?? p.notes ?? p.content) as string | undefined;
        if (!text || typeof text !== "string") throw new Error("Notes cannot be empty.");
        const eventId = await resolveEventId();
        if (!eventId) throw new Error("No event selected.");
        const { error } = await supabase
          .from("events")
          .update({ event_notes: text })
          .eq("id", eventId)
          .eq("owner_id", userId);
        if (error) throw new Error(error.message);
        return { ok: true };
      }
      case "create_budget_item": {
        const eventId = await resolveEventId();
        if (!eventId) throw new Error("No event selected.");
        const category = (p.category ?? p.name ?? "Uncategorized") as string;
        const estimated = Number(p.estimated_amount ?? p.amount ?? 0) || 0;
        const vendorName = (p.vendor_name ?? null) as string | null;
        const { error } = await supabase.from("budget_items").insert({
          event_id: eventId,
          category: String(category).slice(0, 120),
          estimated_amount: estimated,
          vendor_name: vendorName,
        });
        if (error) throw new Error(error.message);
        return { ok: true };
      }
      case "create_task": {
        const eventId = await resolveEventId();
        if (!eventId) throw new Error("No event selected.");
        const title = (p.title ?? p.text ?? p.name) as string | undefined;
        if (!title) throw new Error("Task title required.");
        const dueDate = (p.due_date ?? null) as string | null;
        const priority = (p.priority ?? "medium") as string;
        const { error } = await supabase.from("tasks").insert({
          event_id: eventId,
          title: String(title).slice(0, 200),
          status: "todo",
          priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
          due_date: dueDate,
        });
        if (error) throw new Error(error.message);
        return { ok: true };
      }
      default:
        throw new Error("Unsupported action kind.");
    }
  });
