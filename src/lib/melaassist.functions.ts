import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  question: z.string().trim().min(2).max(1000),
  eventId: z.string().uuid().optional(),
});

type SupabaseCtx = { supabase: any; userId: string };

async function loadEventContext(ctx: SupabaseCtx, eventId?: string) {
  if (!eventId) {
    const { data } = await ctx.supabase
      .from("events")
      .select("id, name, event_type, event_date, budget_target, guest_target")
      .eq("owner_id", ctx.userId)
      .is("deleted_at", null)
      .order("event_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    eventId = data.id;
  }
  const [e, g, t, b] = await Promise.all([
    ctx.supabase.from("events").select("id, name, event_type, event_date, event_time, location, budget_target, guest_target").eq("id", eventId).maybeSingle(),
    ctx.supabase.from("guests").select("id, rsvp_status, plus_ones").eq("event_id", eventId).is("deleted_at", null),
    ctx.supabase.from("tasks").select("id, title, status, priority, due_date").eq("event_id", eventId).is("deleted_at", null),
    ctx.supabase.from("budget_items").select("category, estimated_amount, actual_amount, paid_amount, vendor_name").eq("event_id", eventId).is("deleted_at", null),
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
      tasks_overdue: tasks.filter((r) => r.status !== "done" && r.due_date && new Date(r.due_date) < new Date()).length,
      budget_estimated: budget.reduce((s, r) => s + Number(r.estimated_amount ?? 0), 0),
      budget_paid: budget.reduce((s, r) => s + Number(r.paid_amount ?? 0), 0),
      budget_categories: budget.map((r) => r.category).filter(Boolean),
    },
  };
}

export const askMelaAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { answer: "MelaAssist is temporarily unavailable. Please try again shortly.", degraded: true };

    const ctxData = await loadEventContext(context as SupabaseCtx, data.eventId);

    const system = `You are MelaAssist, MelaBridge's warm, expert AI event-planning concierge.
Answer the user's question in 1-4 short paragraphs of plain prose. Concrete, actionable, specific to the event context when provided.
- No markdown headings, no bullets unless the user explicitly asks for a list.
- Never invent vendor names, prices, or contracts.
- If the question is outside event planning, gently redirect.
- If context is missing, still answer with best-practice guidance and note what would sharpen the advice.`;

    const userMessage = ctxData
      ? `Event context (JSON):\n${JSON.stringify(ctxData)}\n\nQuestion: ${data.question}`
      : `The planner has not created an event yet.\n\nQuestion: ${data.question}`;

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: userMessage },
          ],
        }),
      });
      if (resp.status === 429) return { answer: "MelaAssist is busy right now — please try again in a moment.", degraded: true };
      if (resp.status === 402) return { answer: "MelaAssist is temporarily paused on this workspace. Please contact your admin.", degraded: true };
      if (!resp.ok) return { answer: "MelaAssist couldn't reach the planning engine. Please try again.", degraded: true };
      const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const answer = (json.choices?.[0]?.message?.content ?? "").trim();
      return { answer: answer || "I don't have a good answer for that yet — try rephrasing.", degraded: false };
    } catch {
      return { answer: "MelaAssist couldn't reach the planning engine. Please try again.", degraded: true };
    }
  });
