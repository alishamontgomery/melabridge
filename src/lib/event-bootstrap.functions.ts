import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getEventTemplate, getShoppingTemplate, getInvitationGuidance, type EventTemplate, type ShoppingTemplate } from "./event-templates";
import { callAi } from "@/lib/ai-client.server";

/**
 * AI-first event bootstrap.
 *
 * Given an event the caller owns, produce a complete starter plan:
 *   - tasks (with due dates)
 *   - budget items (allocated across categories)
 *   - runsheet items (event-day minute-by-minute)
 *   - vendor needs (required / recommended / optional per event type)
 *
 * The AI is asked to expand on a deterministic per-type template. If the
 * AI call fails (missing key, rate limit, bad JSON, provider error), we
 * insert the deterministic template so the workspace is NEVER blank.
 *
 * Idempotent-ish: with `only_if_empty` (default true) we skip inserts on
 * any surface that already has rows, so re-runs can't spam duplicates.
 */

const TaskPriority = z.enum(["low", "medium", "high", "urgent"]);
const TaskStatus = z.enum(["todo", "in_progress", "done"]);

const BootstrapSchema = z.object({
  summary: z.string().max(500).optional().default(""),
  tasks: z
    .array(
      z.object({
        title: z.string().min(2).max(160),
        description: z.string().max(500).optional().default(""),
        priority: TaskPriority.optional().default("medium"),
        status: TaskStatus.optional().default("todo"),
        due_date: z.string().nullable().optional(),
        days_before_event: z.number().int().min(-365).max(730).nullable().optional(),
      }),
    )
    .max(120)
    .default([]),
  budget_items: z
    .array(
      z.object({
        category: z.string().min(2).max(80),
        label: z.string().min(2).max(160),
        estimated_amount: z.number().min(0).max(10_000_000).default(0),
        notes: z.string().max(400).optional().default(""),
      }),
    )
    .max(40)
    .default([]),
  runsheet: z
    .array(
      z.object({
        title: z.string().min(2).max(160),
        offset_min: z.number().int().min(-720).max(1440),
        duration_min: z.number().int().min(5).max(600).default(30),
        owner: z.string().max(80).optional().nullable(),
        notes: z.string().max(400).optional().nullable(),
      }),
    )
    .max(60)
    .default([]),
  vendor_needs: z
    .array(
      z.object({
        category: z.string().min(2).max(80),
        status: z.enum(["required", "recommended", "optional"]).default("recommended"),
        priority: z.number().int().min(1).max(9).default(3),
        notes: z.string().max(400).optional().nullable(),
      }),
    )
    .max(30)
    .default([]),
  shopping_list: z
    .array(
      z.object({
        category: z.string().min(1).max(60).default("General"),
        item: z.string().min(1).max(160),
        quantity: z.string().max(80).optional().nullable(),
        notes: z.string().max(300).optional().nullable(),
      }),
    )
    .max(60)
    .default([]),
  invitation_guidance: z.string().max(800).optional().default(""),
});

type BootstrapPlan = z.infer<typeof BootstrapSchema>;

const Input = z.object({
  event_id: z.string().uuid(),
  only_if_empty: z.boolean().optional().default(true),
});

/** Convert a deterministic template + event context into the same shape the AI returns. */
function templateToPlan(
  template: EventTemplate,
  totalBudget: number,
  shopping: ShoppingTemplate[],
  invitationGuidance: string,
): BootstrapPlan {
  const budget_items = template.budget.map((b) => ({
    category: b.category,
    label: b.label,
    estimated_amount: totalBudget > 0 ? Math.round(totalBudget * b.share) : 0,
    notes: b.notes ?? "",
  }));
  return {
    summary: "",
    tasks: template.tasks.map((t) => ({
      title: t.title,
      description: t.description ?? "",
      priority: t.priority,
      status: "todo" as const,
      due_date: null,
      days_before_event: t.days_before,
    })),
    budget_items,
    runsheet: template.runsheet.map((r) => ({
      title: r.title,
      offset_min: r.offset_min,
      duration_min: r.duration_min,
      owner: r.owner ?? null,
      notes: r.notes ?? null,
    })),
    vendor_needs: template.vendors.map((v) => ({
      category: v.category,
      status: v.status,
      priority: v.priority,
      notes: v.notes ?? null,
    })),
    shopping_list: shopping.map((s) => ({
      category: s.category,
      item: s.item,
      quantity: s.quantity ?? null,
      notes: s.notes ?? null,
    })),
    invitation_guidance: invitationGuidance,
  };
}


/** Compose ISO date from event_date + days_before offset. */
function computeDueDate(eventDate: string | null, daysBefore: number | null | undefined): string | null {
  if (!eventDate || typeof daysBefore !== "number") return null;
  const d = new Date(eventDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - daysBefore);
  return d.toISOString().slice(0, 10);
}

/** Convert offset minutes from a base start time into a HH:MM:SS string, clamped to same day. */
function computeRunsheetTime(baseStart: string | null, offsetMin: number): string | null {
  const base = baseStart ?? "17:00"; // default 5pm start when the user hasn't set one
  const [bh = 0, bm = 0] = base.split(":").map((n) => Number(n) || 0);
  let total = bh * 60 + bm + offsetMin;
  // Wrap into 0..24*60
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:00`;
}

async function callAI(
  eventContext: Record<string, unknown>,
  template: EventTemplate,
  totalBudget: number,
  shopping: ShoppingTemplate[],
  invitationGuidance: string,
): Promise<BootstrapPlan | null> {
  const system = `You are MelaAssist, MelaBridge's AI event planner.
Given an event's basics AND a deterministic starter template, return a COMPLETE plan tailored to this specific event.
Return ONLY JSON with this exact shape:
{
  "summary": "one warm, specific paragraph about how you shaped the plan",
  "tasks": [{ "title": "...", "description": "...", "priority": "low|medium|high|urgent", "days_before_event": 30 }],
  "budget_items": [{ "category": "Venue", "label": "Venue rental", "estimated_amount": 12000, "notes": "" }],
  "runsheet": [{ "title": "Guests arrive", "offset_min": 0, "duration_min": 30, "owner": "Ushers", "notes": "" }],
  "vendor_needs": [{ "category": "Photographer", "status": "required|recommended|optional", "priority": 1, "notes": "" }],
  "shopping_list": [{ "category": "Reception", "item": "Table numbers", "quantity": "1 per table", "notes": "" }],
  "invitation_guidance": "2-4 short sentences on WHEN and HOW to invite guests for this specific event"
}
Rules:
- Tasks: adapt count to event scale (birthday ~20, wedding 40+, corporate ~20). Order by days_before_event descending. Include "day of" (0) and post-event follow-ups (negative).
- Budget: sum of estimated_amount should be close to the event's budget_target when provided; otherwise use reasonable numbers for the guest count.
- Runsheet: offset_min is minutes from event start (negative = setup before start). Include vendor arrival, guest arrival, program, food, entertainment, teardown.
- Vendor needs: only categories that make sense for this event type.
- Shopping list: 8-20 concrete physical items the planner must buy or bring. Never repeat vendor deliverables.
- Invitation guidance: specific to guest count and event type. Include timing (weeks out), channel (paper/digital), and what to include.
- Never omit any array or field.
- No markdown. No emojis. Plain concise language.`;

  const response = await callAi(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: JSON.stringify({
          event: eventContext,
          starter_template: templateToPlan(template, totalBudget, shopping, invitationGuidance),
        }),
      },
    ],
    {
      jsonMode: true,
      isAcceptable: (text) => {
        try {
          const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
          return Boolean(parsed && typeof parsed === "object");
        } catch {
          return false;
        }
      },
    },
  );
  if (!response.ok) return null;

  try {
    const parsed = JSON.parse(response.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
    return BootstrapSchema.parse(parsed);
  } catch (error) {
    console.error("[MelaAssist] event bootstrap response validation failed:", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}


export const bootstrapEventPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: event, error: evErr } = await supabase
      .from("events")
      .select(
        "id,owner_id,name,event_type,event_date,event_time,start_time,end_time,guest_target,budget_target,location,description,event_notes",
      )
      .eq("id", data.event_id)
      .maybeSingle();
    if (evErr) throw new Error(evErr.message);
    if (!event) throw new Error("Event not found");
    if (event.owner_id !== userId) throw new Error("Not authorized");

    // Check emptiness per surface (respect only_if_empty for each independently).
    const [{ count: taskCount }, { count: budgetCount }, { count: runsheetCount }, { count: needsCount }] =
      await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("event_id", event.id),
        supabase.from("budget_items").select("id", { count: "exact", head: true }).eq("event_id", event.id),
        supabase.from("event_runsheet_items").select("id", { count: "exact", head: true }).eq("event_id", event.id),
        supabase.from("event_vendor_needs").select("id", { count: "exact", head: true }).eq("event_id", event.id),
      ]);

    const template = getEventTemplate(event.event_type);
    const totalBudget = Number(event.budget_target ?? 0);
    const eventContext = {
      name: event.name,
      event_type: event.event_type ?? "Event",
      event_date: event.event_date ?? "unknown",
      guest_target: event.guest_target ?? null,
      budget_target: totalBudget || null,
      location: event.location ?? null,
      notes: event.event_notes ?? event.description ?? null,
    };

    const shopping = getShoppingTemplate(event.event_type);
    const invitationGuidanceDefault = getInvitationGuidance(event.event_type);
    const aiPlan = await callAI(eventContext, template, totalBudget, shopping, invitationGuidanceDefault);
    const plan = aiPlan ?? templateToPlan(template, totalBudget, shopping, invitationGuidanceDefault);
    const usedFallback = aiPlan === null;

    // Prefer the explicit ceremony start (when the "main event" actually
    // begins). Fall back to event_time / start_time. This is what runsheet
    // offsets are anchored to: negative offsets are setup BEFORE, offset 0
    // is the main event.
    const baseStart =
      (event as { ceremony_start_time?: string | null }).ceremony_start_time ??
      event.event_time ??
      event.start_time ??
      null;

    // TASKS
    let tasksInserted = 0;
    if ((data.only_if_empty ? (taskCount ?? 0) === 0 : true) && plan.tasks.length > 0) {
      const rows = plan.tasks.map((t) => ({
        event_id: event.id,
        title: t.title,
        description: t.description || null,
        priority: t.priority,
        status: t.status,
        due_date: t.due_date ?? computeDueDate(event.event_date, t.days_before_event ?? null),
        created_by: userId,
      }));
      const { error, count } = await supabase.from("tasks").insert(rows, { count: "exact" });
      if (error) throw new Error(`Task insert: ${error.message}`);
      tasksInserted = count ?? rows.length;
    }

    // BUDGET
    let budgetInserted = 0;
    if ((data.only_if_empty ? (budgetCount ?? 0) === 0 : true) && plan.budget_items.length > 0) {
      const rows = plan.budget_items.map((b) => ({
        event_id: event.id,
        category: b.category,
        label: b.label,
        estimated_amount: b.estimated_amount,
        notes: b.notes || null,
        created_by: userId,
      }));
      const { error, count } = await supabase.from("budget_items").insert(rows, { count: "exact" });
      if (error) throw new Error(`Budget insert: ${error.message}`);
      budgetInserted = count ?? rows.length;
    }

    // RUNSHEET
    let runsheetInserted = 0;
    if ((data.only_if_empty ? (runsheetCount ?? 0) === 0 : true) && plan.runsheet.length > 0) {
      const rows = plan.runsheet.map((r, idx) => ({
        event_id: event.id,
        title: r.title,
        start_time: computeRunsheetTime(baseStart, r.offset_min),
        duration_min: r.duration_min,
        owner: r.owner ?? null,
        notes: r.notes ?? null,
        sort_order: idx,
        ai_generated: true,
        created_by: userId,
      }));
      const { error, count } = await supabase.from("event_runsheet_items").insert(rows, { count: "exact" });
      if (error) throw new Error(`Runsheet insert: ${error.message}`);
      runsheetInserted = count ?? rows.length;
    }

    // VENDOR NEEDS
    let vendorNeedsInserted = 0;
    if ((data.only_if_empty ? (needsCount ?? 0) === 0 : true) && plan.vendor_needs.length > 0) {
      const rows = plan.vendor_needs.map((v, idx) => ({
        event_id: event.id,
        category: v.category,
        status: v.status,
        priority: v.priority,
        notes: v.notes ?? null,
        sort_order: idx,
        created_by: userId,
      }));
      const { error, count } = await supabase
        .from("event_vendor_needs")
        .upsert(rows, { onConflict: "event_id,category", ignoreDuplicates: true, count: "exact" });
      if (error) throw new Error(`Vendor needs insert: ${error.message}`);
      vendorNeedsInserted = count ?? rows.length;
    }

    // SHOPPING LIST
    let shoppingInserted = 0;
    const { count: shoppingCount } = await supabase
      .from("event_shopping_items")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);
    if ((data.only_if_empty ? (shoppingCount ?? 0) === 0 : true) && plan.shopping_list.length > 0) {
      const rows = plan.shopping_list.map((s, idx) => ({
        event_id: event.id,
        category: s.category || "General",
        item: s.item,
        quantity: s.quantity ?? null,
        notes: s.notes ?? null,
        sort_order: idx,
        created_by: userId,
      }));
      const { error, count } = await supabase.from("event_shopping_items").insert(rows, { count: "exact" });
      if (error) throw new Error(`Shopping insert: ${error.message}`);
      shoppingInserted = count ?? rows.length;
    }

    // INVITATION GUIDANCE (only write when empty, unless caller opted out of only_if_empty)
    if (plan.invitation_guidance && (!data.only_if_empty || !(event as { invitation_guidance?: string | null }).invitation_guidance)) {
      await supabase.from("events").update({ invitation_guidance: plan.invitation_guidance }).eq("id", event.id);
    }

    return {
      ok: true,
      skipped:
        tasksInserted + budgetInserted + runsheetInserted + vendorNeedsInserted + shoppingInserted === 0,
      tasksInserted,
      budgetInserted,
      runsheetInserted,
      vendorNeedsInserted,
      shoppingInserted,
      summary: plan.summary ?? "",
      usedFallback,
    };
  });

/**
 * Regenerate the day-of runsheet, preserving locked items.
 *
 * - Locked items are kept as-is (title, time, duration, owner, assignments,
 *   notes, status).
 * - Non-locked items are deleted and replaced with a fresh AI (or template)
 *   plan anchored to the event's ceremony start time.
 * - New rows are inserted with sort_order that interleaves them around the
 *   locked ones by chronological start_time.
 */
export const regenerateRunsheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: event, error: evErr } = await supabase
      .from("events")
      .select(
        "id,owner_id,name,event_type,event_date,event_time,start_time,end_time,ceremony_start_time,guest_target,budget_target,location,description,event_notes",
      )
      .eq("id", data.event_id)
      .maybeSingle();
    if (evErr) throw new Error(evErr.message);
    if (!event) throw new Error("Event not found");
    if (event.owner_id !== userId) throw new Error("Not authorized");

    // Delete only non-locked runsheet items.
    const { error: delErr } = await supabase
      .from("event_runsheet_items")
      .delete()
      .eq("event_id", event.id)
      .eq("locked", false);
    if (delErr) throw new Error(delErr.message);

    const template = getEventTemplate(event.event_type);
    const totalBudget = Number(event.budget_target ?? 0);
    const eventContext = {
      name: event.name,
      event_type: event.event_type ?? "Event",
      event_date: event.event_date ?? "unknown",
      guest_target: event.guest_target ?? null,
      budget_target: totalBudget || null,
      location: event.location ?? null,
      notes: event.event_notes ?? event.description ?? null,
    };

    const shopping = getShoppingTemplate(event.event_type);
    const invitationGuidanceDefault = getInvitationGuidance(event.event_type);
    const aiPlan = await callAI(eventContext, template, totalBudget, shopping, invitationGuidanceDefault);
    const plan = aiPlan ?? templateToPlan(template, totalBudget, shopping, invitationGuidanceDefault);
    const baseStart =
      (event as { ceremony_start_time?: string | null }).ceremony_start_time ??
      event.event_time ??
      event.start_time ??
      null;

    // Fetch locked items so we can skip duplicate titles + choose sort_order.
    const { data: locked } = await supabase
      .from("event_runsheet_items")
      .select("id,title,sort_order")
      .eq("event_id", event.id)
      .eq("locked", true);
    const lockedTitles = new Set((locked ?? []).map((r) => r.title.toLowerCase().trim()));
    const startSort = (locked ?? []).reduce((m, r) => Math.max(m, r.sort_order), -1) + 1;

    const rows = plan.runsheet
      .filter((r) => !lockedTitles.has(r.title.toLowerCase().trim()))
      .map((r, idx) => ({
        event_id: event.id,
        title: r.title,
        start_time: computeRunsheetTime(baseStart, r.offset_min),
        duration_min: r.duration_min,
        owner: r.owner ?? null,
        notes: r.notes ?? null,
        sort_order: startSort + idx,
        ai_generated: true,
        created_by: userId,
      }));

    let inserted = 0;
    if (rows.length > 0) {
      const { error, count } = await supabase
        .from("event_runsheet_items")
        .insert(rows, { count: "exact" });
      if (error) throw new Error(error.message);
      inserted = count ?? rows.length;
    }

    return { ok: true, inserted, keptLocked: (locked ?? []).length, usedFallback: aiPlan === null };
  });
