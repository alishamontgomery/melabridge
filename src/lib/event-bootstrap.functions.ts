import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * AI-first event bootstrap.
 *
 * Given an existing event the caller owns, ask Lovable AI to draft a
 * starter plan (tasks + budget categories) tailored to that event's type,
 * date, guest count and budget. Idempotent-ish: it skips insert if the
 * event already has tasks or budget items so a re-run can't spam duplicates.
 */

const TaskPriority = z.enum(["low", "medium", "high", "urgent"]);
const TaskStatus = z.enum(["todo", "in_progress", "done"]);

const BootstrapSchema = z.object({
  summary: z.string().max(400).optional().default(""),
  tasks: z
    .array(
      z.object({
        title: z.string().min(2).max(160),
        description: z.string().max(500).optional().default(""),
        priority: TaskPriority.optional().default("medium"),
        status: TaskStatus.optional().default("todo"),
        // ISO date OR null (AI may not know)
        due_date: z.string().nullable().optional(),
        // Days before event start; used when `due_date` is null and event has a date
        days_before_event: z.number().int().min(0).max(365).nullable().optional(),
      }),
    )
    .max(40)
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
    .max(30)
    .default([]),
});

export type BootstrapPlan = z.infer<typeof BootstrapSchema>;

const Input = z.object({
  event_id: z.string().uuid(),
  /** Skip AI and insert only if empty (safe to call on every event creation). */
  only_if_empty: z.boolean().optional().default(true),
});

export const bootstrapEventPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: event, error: evErr } = await supabase
      .from("events")
      .select(
        "id,owner_id,name,event_type,event_date,guest_target,budget_target,location,description,event_notes",
      )
      .eq("id", data.event_id)
      .maybeSingle();
    if (evErr) throw new Error(evErr.message);
    if (!event) throw new Error("Event not found");
    if (event.owner_id !== userId) throw new Error("Not authorized");

    if (data.only_if_empty) {
      const [{ count: taskCount }, { count: budgetCount }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("event_id", event.id),
        supabase
          .from("budget_items")
          .select("id", { count: "exact", head: true })
          .eq("event_id", event.id),
      ]);
      if ((taskCount ?? 0) > 0 || (budgetCount ?? 0) > 0) {
        return { ok: true, skipped: true, tasksInserted: 0, budgetInserted: 0, summary: "" };
      }
    }

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const eventContext = {
      name: event.name,
      event_type: event.event_type ?? "Event",
      event_date: event.event_date ?? "unknown",
      guest_target: event.guest_target ?? null,
      budget_target: event.budget_target ?? null,
      location: event.location ?? null,
      notes: event.event_notes ?? event.description ?? null,
    };

    const system = `You are MelaAssist, the AI event planner for MelaBridge.
Given an event's basics, produce a realistic starter plan tailored to that event's type, date, guest count and budget.
Return ONLY JSON with this exact shape:
{
  "summary": "one paragraph, warm and specific to this event",
  "tasks": [
    { "title": "...", "description": "...", "priority": "low|medium|high|urgent", "days_before_event": 60 }
  ],
  "budget_items": [
    { "category": "Venue", "label": "Ceremony venue", "estimated_amount": 12000, "notes": "" }
  ]
}
Rules:
- 8 to 16 tasks, ordered from earliest (largest days_before_event) to latest.
- Prefer days_before_event over absolute dates so the plan works even if the date changes.
- 6 to 12 budget items across the categories most relevant to the event type. Sum of estimated_amount should be near the event budget_target if provided; otherwise use reasonable numbers for the guest count.
- Use concise, plainspoken language. No emojis. No markdown.`;

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
          { role: "user", content: JSON.stringify(eventContext) },
        ],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`AI plan generation failed [${resp.status}]: ${body}`);
    }

    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    const plan = BootstrapSchema.parse(parsed);

    // Compute due_date from days_before_event when needed.
    const eventDate = event.event_date ? new Date(event.event_date + "T00:00:00Z") : null;
    const taskRows = plan.tasks.map((t) => {
      let due: string | null = t.due_date ?? null;
      if (!due && eventDate && typeof t.days_before_event === "number") {
        const d = new Date(eventDate);
        d.setUTCDate(d.getUTCDate() - t.days_before_event);
        due = d.toISOString().slice(0, 10);
      }
      return {
        event_id: event.id,
        title: t.title,
        description: t.description || null,
        priority: t.priority,
        status: t.status,
        due_date: due,
        created_by: userId,
      };
    });

    const budgetRows = plan.budget_items.map((b) => ({
      event_id: event.id,
      category: b.category,
      label: b.label,
      estimated_amount: b.estimated_amount,
      notes: b.notes || null,
      created_by: userId,
    }));

    let tasksInserted = 0;
    let budgetInserted = 0;

    if (taskRows.length > 0) {
      const { error, count } = await supabase.from("tasks").insert(taskRows, { count: "exact" });
      if (error) throw new Error(`Task insert: ${error.message}`);
      tasksInserted = count ?? taskRows.length;
    }
    if (budgetRows.length > 0) {
      const { error, count } = await supabase
        .from("budget_items")
        .insert(budgetRows, { count: "exact" });
      if (error) throw new Error(`Budget insert: ${error.message}`);
      budgetInserted = count ?? budgetRows.length;
    }

    return {
      ok: true,
      skipped: false,
      tasksInserted,
      budgetInserted,
      summary: plan.summary ?? "",
    };
  });
