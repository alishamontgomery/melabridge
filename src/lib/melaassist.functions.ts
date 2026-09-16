import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAi, aiErrorMessage, hasAiProvider } from "@/lib/ai-client.server";
import {
  isClearlyOutsideMelaAssistScope,
  OUT_OF_SCOPE_MELAASSIST_ANSWER,
} from "@/lib/melaassist-scope";

const Input = z.object({
  question: z.string().trim().min(2).max(1000),
  eventId: z.string().uuid().optional(),
});

type SupabaseCtx = { supabase: any; userId: string };

type QuestionFocus = {
  guests: boolean;
  tasks: boolean;
  budget: boolean;
};

function getQuestionFocus(question: string): QuestionFocus {
  const q = question.toLowerCase();
  return {
    guests: /\b(guest|rsvp|invite|invitation|diet|meal|allerg|plus.?one|seating)\b/.test(q),
    tasks: /\b(task|timeline|schedule|checklist|deadline|due|focus|priority|week|today|run.?sheet)\b/.test(q),
    budget: /\b(budget|spend|cost|price|pay|payment|flower|floral|expense|afford|amount|dollar|\$)\b/.test(q),
  };
}

async function loadEventContext(ctx: SupabaseCtx, eventId: string | undefined, question: string) {
  const focus = getQuestionFocus(question);
  if (!eventId) {
    const { data } = await ctx.supabase
      .from("events")
      .select("id")
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
    focus.guests
      ? ctx.supabase.from("guests").select("rsvp_status, plus_ones, meal_choice").eq("event_id", eventId).is("deleted_at", null).limit(500)
      : Promise.resolve({ data: [] }),
    focus.tasks
      ? ctx.supabase.from("tasks").select("title, status, priority, due_date").eq("event_id", eventId).is("deleted_at", null).order("due_date", { ascending: true, nullsFirst: false }).limit(30)
      : Promise.resolve({ data: [] }),
    focus.budget
      ? ctx.supabase.from("budget_items").select("category, estimated_amount, actual_amount, paid_amount, vendor_name").eq("event_id", eventId).is("deleted_at", null).limit(60)
      : Promise.resolve({ data: [] }),
  ]);
  if (!e.data) return null;
  const guests = (g.data ?? []) as any[];
  const tasks = (t.data ?? []) as any[];
  const budget = (b.data ?? []) as any[];

  const budgetTerms = question.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  const relevantBudget = budget.filter((row) => {
    const haystack = `${row.category ?? ""} ${row.vendor_name ?? ""}`.toLowerCase();
    return budgetTerms.some((term) => haystack.includes(term));
  });

  return {
    event: e.data,
    ...(focus.guests ? {
      guests: {
        total: guests.length,
        confirmed: guests.filter((r) => r.rsvp_status === "yes").length,
        pending: guests.filter((r) => r.rsvp_status === "pending").length,
        declined: guests.filter((r) => r.rsvp_status === "no").length,
        plusOnes: guests.reduce((sum, row) => sum + Number(row.plus_ones ?? 0), 0),
        dietaryResponses: guests.filter((r) => r.meal_choice).length,
      },
    } : {}),
    ...(focus.tasks ? {
      tasks: {
        total: tasks.length,
        open: tasks.filter((r) => !["done", "completed"].includes(r.status)).length,
        overdue: tasks.filter((r) => !["done", "completed"].includes(r.status) && r.due_date && new Date(r.due_date) < new Date()).length,
        upcoming: tasks.filter((r) => !["done", "completed"].includes(r.status)).slice(0, 12),
      },
    } : {}),
    ...(focus.budget ? {
      budget: {
        estimated: budget.reduce((s, r) => s + Number(r.estimated_amount ?? 0), 0),
        paid: budget.reduce((s, r) => s + Number(r.paid_amount ?? 0), 0),
        categories: [...new Set(budget.map((r) => r.category).filter(Boolean))],
        relevantItems: relevantBudget.slice(0, 12),
      },
    } : {}),
  };
}

export const askMelaAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    if (isClearlyOutsideMelaAssistScope(data.question)) {
      return { answer: OUT_OF_SCOPE_MELAASSIST_ANSWER, degraded: false };
    }

    if (!hasAiProvider()) {
      console.error(
        "[MelaAssist] askMelaAssist: No AI provider configured. Add GEMINI_API_KEY to Replit Secrets.",
      );
      return {
        answer: "MelaAssist is temporarily unavailable. Please try again shortly.",
        degraded: true,
      };
    }

    const ctxData = await loadEventContext(context as SupabaseCtx, data.eventId, data.question);

    const system = `You are MelaAssist, MelaBridge's warm, expert AI event-planning concierge.
Answer the user's question in 1-4 short paragraphs of plain prose. Concrete, actionable, specific to the event context when provided.
- No markdown headings, no bullets unless the user explicitly asks for a list.
- Never invent vendor names, prices, or contracts.
- If the question is outside event planning, gently redirect.
- If context is missing, still answer with best-practice guidance and note what would sharpen the advice.`;

    const userMessage = ctxData
      ? `Event context (JSON):\n${JSON.stringify(ctxData)}\n\nQuestion: ${data.question}`
      : `The planner has not created an event yet.\n\nQuestion: ${data.question}`;

    const result = await callAi([
      { role: "system", content: system },
      { role: "user", content: userMessage },
    ]);

    if (!result.ok) {
      return { answer: aiErrorMessage(result.error), degraded: true };
    }

    return {
      answer: result.text || "I don't have a good answer for that yet — try rephrasing.",
      degraded: false,
    };
  });
