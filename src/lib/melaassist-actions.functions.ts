import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAi, aiErrorMessage, hasAiProvider } from "@/lib/ai-client.server";
import {
  isClearlyOutsideMelaAssistScope,
  OUT_OF_SCOPE_MELAASSIST_ANSWER,
} from "@/lib/melaassist-scope";

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
  ],
  personal: [
    "update_event_notes",
    "create_budget_item",
    "create_task",
    "generate_timeline",
    "generate_budget",
    "recommend_vendors",
    "create_event_draft",
    "add_timeline_milestone",
  ],
  organization: [
    "update_event_notes",
    "create_budget_item",
    "create_task",
    "generate_timeline",
    "generate_budget",
    "recommend_vendors",
    "create_event_draft",
    "add_timeline_milestone",
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
  builderMode: z.enum(["event_builder"]).optional(),
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

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "{}";
  }
}

export const melaAssistTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => TurnInput.parse(input))
  .handler(async ({ data, context }) => {
    type OutAction = { kind: string; title: string; summary: string | null; payloadJson: string };
    type TurnResult = { answer: string; actions: OutAction[]; nextSteps: string[]; degraded: boolean };
    const makeResult = (r: TurnResult): TurnResult => r;

    if (isClearlyOutsideMelaAssistScope(data.question)) {
      return makeResult({
        answer: OUT_OF_SCOPE_MELAASSIST_ANSWER,
        actions: [],
        nextSteps: [],
        degraded: false,
      });
    }

    if (!hasAiProvider()) {
      console.error(
        "[MelaAssist] melaAssistTurn: No AI provider configured. Add GEMINI_API_KEY to Replit Secrets.",
      );
      return makeResult({
        answer: "MelaAssist is temporarily unavailable. Please try again shortly.",
        actions: [],
        nextSteps: [],
        degraded: true,
      });
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

    const builderAddendum =
      data.builderMode === "event_builder"
        ? `\n\nEVENT BUILDER MODE:
- The user is creating a brand new event conversationally.
- Extract: name, event_type, event_date (YYYY-MM-DD), event_time (HH:MM 24h), city, venue, guest_target (int), budget_target (number), theme, notes.
- If the user has given AT LEAST a rough event_type + name (or clear intent like "a wedding"), immediately propose ONE 'create_event_draft' action with every field you have so far (unknown fields as null). Keep it editable.
- After (or alongside) the draft, propose:
    * 3-6 'add_timeline_milestone' actions with fields { title, months_before?, weeks_before?, days_before?, priority: "low"|"medium"|"high" }. Use months_before/weeks_before/days_before relative to the event_date so the executor can compute due_date.
    * 4-8 'create_budget_item' actions with { category, estimated_amount } — if budget is unknown, estimate percentages of a $10000 baseline and note it in summary.
    * 4-8 'create_task' actions covering setup/logistics.
    * One 'recommend_vendors' preview action with { categories: string[], notes: string } appropriate for the event_type.
- If a required field is missing (event_type, event_date, guest_target, city), ask ONE concise follow-up question in the answer AND still return the actions you can with what you have.
- Do not invent vendor names. Do not set prices as fixed unless the user provided a budget.`
        : "";

    const system = `You are MelaAssist, the AI concierge inside MelaBridge.

Personality: warm, professional, encouraging, confident, and concise. Sound like a thoughtful human planner — never robotic, never verbose. Use plain prose, contractions, and specifics. No emojis unless the user uses them first.

You are aware of workspace context (user, role, page, current event, current vendor, current task).

When the user asks for a concrete change (create, update, draft, generate, add, rewrite), respond with:
  (1) a short conversational answer (1-3 sentences, plain prose, no markdown headings or bullet lists),
  (2) a strict JSON block at the end of the message wrapped in \`\`\`json ... \`\`\`.

For each proposed action, put a one-sentence "why" in the "summary" field — briefly explain what it's based on (e.g. "Based on your wedding category and Nairobi location"). Never leave summary empty.

JSON schema:
{
  "answer": string,
  "actions": [
    { "kind": "<one of the allowed kinds>", "title": string, "summary": string, "payload": { } }
  ],
  "nextSteps": [string]
}

Follow-up handling (critical):
- Treat these as edits to the LAST proposed action(s), not fresh requests: "make it more elegant", "make it luxury", "shorten it", "make it family friendly", "rewrite for corporate clients", "warmer tone", "more casual", "give me three options", "another one", "different angle".
- When asked for N options, return N distinct actions of the same kind, each with a different tone/angle noted in summary.
- Never ask the user to repeat context you already have in workspace memory or prior turns.

Rules:
- ${actionSchemaHint}
- Never invent vendor names, prices, or contracts.
- Do NOT execute anything. You only propose. The user approves or edits.
- If the user just wants to chat or ask a question, return actions: [] and give a helpful answer.
- Keep nextSteps to 2-4 short, tappable suggestions the user can send back verbatim.${builderAddendum}`;

    const historyMessages = (data.history ?? []).slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const userMessage = `Workspace (JSON):\n${JSON.stringify(workspace)}\n\nUser message: ${data.question}`;

    const aiResult = await callAi(
      [
        { role: "system", content: system },
        ...historyMessages,
        { role: "user", content: userMessage },
      ],
      {
        isAcceptable: (text) => {
          const parsed = extractJsonBlock(text);
          return Boolean(
            parsed &&
              typeof parsed === "object" &&
              typeof (parsed as { answer?: unknown }).answer === "string",
          );
        },
      },
    );

    if (!aiResult.ok) {
      return makeResult({
        answer: aiErrorMessage(aiResult.error),
        actions: [],
        nextSteps: [],
        degraded: true,
      });
    }

    const raw = aiResult.text;

    const parsed = extractJsonBlock(raw) as
        | { answer?: string; actions?: unknown[]; nextSteps?: unknown[] }
        | null;

      if (!parsed || typeof parsed.answer !== "string" || !parsed.answer.trim()) {
        return makeResult({
          answer: "MelaAssist returned an incomplete response. Please try again.",
          actions: [],
          nextSteps: [],
          degraded: true,
        });
      }

      let answer = parsed?.answer;
      if (!answer) {
        answer = raw.replace(/```(?:json)?\s*[\s\S]*?```/i, "").trim();
      }

      const validKinds = new Set(kinds);
      const rawActions = Array.isArray(parsed?.actions) ? parsed!.actions : [];
      const actions: OutAction[] = [];
      for (const a of rawActions) {
        if (!a || typeof a !== "object") continue;
        const obj = a as Record<string, unknown>;
        const kind = typeof obj.kind === "string" ? obj.kind : "";
        const title = typeof obj.title === "string" ? obj.title : "";
        if (!validKinds.has(kind) || !title) continue;
        const payload =
          obj.payload && typeof obj.payload === "object" && !Array.isArray(obj.payload)
            ? (obj.payload as Record<string, unknown>)
            : { text: String(obj.payload ?? "") };
        actions.push({
          kind,
          title: title.slice(0, 140),
          summary: typeof obj.summary === "string" ? obj.summary.slice(0, 240) : null,
          payloadJson: safeStringify(payload),
        });
        if (actions.length >= (data.builderMode === "event_builder" ? 24 : 6)) break;
      }

      const rawSteps = Array.isArray(parsed?.nextSteps) ? parsed!.nextSteps : [];
      const nextSteps: string[] = [];
      for (const s of rawSteps) {
        if (typeof s === "string") nextSteps.push(s);
        if (nextSteps.length >= 6) break;
      }

    return makeResult({
      answer: answer || "I don't have a good answer for that yet — try rephrasing.",
      actions,
      nextSteps,
      degraded: false,
    });
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
    "create_event_draft",
    "add_timeline_milestone",
  ]),
  payload: z.record(z.unknown()),
  eventId: z.string().uuid().optional(),
});

export const executeMelaAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ExecInput.parse(input))
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
      case "create_event_draft": {
        const name = String((p.name ?? p.title ?? "") as string).trim().slice(0, 120);
        if (name.length < 1) throw new Error("Event name is required.");
        const eventType = String((p.event_type ?? p.type ?? "Other") as string).slice(0, 60) || "Other";
        const eventDate = normalizeDate(p.event_date ?? p.date);
        const eventTime = normalizeTime(p.event_time ?? p.time);
        const city = p.city ? String(p.city).slice(0, 120) : null;
        const venue = p.venue ? String(p.venue).slice(0, 200) : null;
        const location = venue && city ? `${venue}, ${city}` : venue ?? city ?? null;
        const guestTarget = p.guest_target != null ? Number(p.guest_target) || null : null;
        const budgetTarget = p.budget_target != null ? Number(p.budget_target) || null : null;
        const notesPieces: string[] = [];
        if (p.theme) notesPieces.push(`Theme: ${String(p.theme).slice(0, 200)}`);
        if (p.notes) notesPieces.push(String(p.notes).slice(0, 800));
        const notes = notesPieces.length ? notesPieces.join("\n\n") : null;

        const { data: inserted, error } = await supabase
          .from("events")
          .insert({
            owner_id: userId,
            name,
            event_type: eventType,
            event_date: eventDate,
            event_time: eventTime,
            ceremony_start_time: eventTime,
            location,
            venue_city: city,
            guest_target: guestTarget,
            budget_target: budgetTarget,
            event_notes: notes,
            status: "confirmed",
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return { ok: true, eventId: inserted.id as string };
      }
      case "add_timeline_milestone": {
        const eventId = await resolveEventId();
        if (!eventId) throw new Error("No event selected.");
        const title = String((p.title ?? p.name ?? p.text ?? "") as string).trim().slice(0, 200);
        if (!title) throw new Error("Milestone title required.");
        const priority = (p.priority ?? "medium") as string;

        // Resolve base date from event
        const { data: evt } = await supabase
          .from("events")
          .select("event_date")
          .eq("id", eventId)
          .maybeSingle();
        const base = evt?.event_date ? new Date(evt.event_date) : null;
        let dueDate: string | null = normalizeDate(p.due_date);
        if (!dueDate && base) {
          const months = Number(p.months_before ?? 0) || 0;
          const weeks = Number(p.weeks_before ?? 0) || 0;
          const days = Number(p.days_before ?? 0) || 0;
          const d = new Date(base);
          d.setMonth(d.getMonth() - months);
          d.setDate(d.getDate() - weeks * 7 - days);
          dueDate = d.toISOString().slice(0, 10);
        }
        const description = p.category ? `Timeline: ${String(p.category).slice(0, 80)}` : null;
        const { error } = await supabase.from("tasks").insert({
          event_id: eventId,
          title,
          status: "todo",
          priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
          due_date: dueDate,
          description,
        });
        if (error) throw new Error(error.message);
        return { ok: true };
      }
      default:
        throw new Error("Unsupported action kind.");
    }
  });

function normalizeDate(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  const trimmed = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeTime(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  const trimmed = v.trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) return trimmed.slice(0, 5);
  return null;
}
