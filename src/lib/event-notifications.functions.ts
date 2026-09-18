/**
 * Server-side helpers that fire in-app notifications for budget warnings,
 * batched RSVP activity, task deadlines, and compute proactive MelaAssist
 * suggestions for the event overview.
 *
 * All notification writes are idempotent within their respective time-windows
 * so rapid saves cannot spam the planner's inbox.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ────────────────────────────────────────────────────────────
// Budget warning notification
// ────────────────────────────────────────────────────────────

/**
 * Fire a budget-warning notification when the event crosses 80 % or 100 % of
 * its budget target.  Deduplicates within a 24-hour window so saving many
 * budget items in quick succession does not create duplicate alerts.
 */
export const checkBudgetWarning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ eventId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { dispatchNotification } = await import("./notification-delivery.server");

    // Load event + budget items
    const [{ data: event }, { data: items }] = await Promise.all([
      supabase
        .from("events")
        .select("id, name, budget_target, owner_id")
        .eq("id", data.eventId)
        .single(),
      supabase
        .from("budget_items")
        .select("estimated_amount")
        .eq("event_id", data.eventId)
        .is("deleted_at", null),
    ]);

    if (!event) return { ok: false };

    const target = Number(event.budget_target ?? 0);
    if (target <= 0) return { ok: false }; // no target set — nothing to warn about

    const committed = (items ?? []).reduce(
      (s, i) => s + Number(i.estimated_amount ?? 0),
      0,
    );
    const pct = committed / target;

    let threshold: "80" | "100" | null = null;
    if (pct >= 1.0) threshold = "100";
    else if (pct >= 0.8) threshold = "80";
    if (!threshold) return { ok: false };

    // De-duplicate: only one notification per threshold per 24 h
    const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", event.owner_id ?? userId)
      .eq("category", "budget")
      .eq("entity_type", "event")
      .eq("entity_id", data.eventId)
      .ilike("title", `%${threshold === "100" ? "over budget" : "80%"}%`)
      .gte("created_at", oneDayAgo)
      .limit(1)
      .maybeSingle();

    if (existing) return { ok: false }; // already notified

    const title =
      threshold === "100"
        ? `${event.name} is over budget`
        : `${event.name} is at 80 % of budget`;
    const body =
      threshold === "100"
        ? `Committed spend ($${committed.toLocaleString()}) has exceeded your $${target.toLocaleString()} target. Review your budget to stay on track.`
        : `You've committed $${committed.toLocaleString()} of your $${target.toLocaleString()} target. Consider reviewing before adding more items.`;

    await dispatchNotification({
      userId: event.owner_id ?? userId,
      category: "budget",
      title,
      body,
      href: `/events/${data.eventId}`,
      entityType: "event",
      entityId: data.eventId,
      idempotencyKey: `budget:${data.eventId}:${threshold}:${new Date().toISOString().slice(0, 10)}`,
    });

    return { ok: true };
  });

// ────────────────────────────────────────────────────────────
// Batched RSVP notification
// ────────────────────────────────────────────────────────────

/**
 * Fire (or update) a batched RSVP notification so that rapid RSVP activity
 * collapses into a single item in the planner's inbox rather than one per
 * guest.  Within a rolling 1-hour window, the notification is updated in-place.
 */
export const fireRsvpBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ eventId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { dispatchNotification, getNotificationPreference } = await import("./notification-delivery.server");

    const { data: event } = await supabase
      .from("events")
      .select("id, name, owner_id")
      .eq("id", data.eventId)
      .single();
    if (!event) return { ok: false };

    const ownerId = event.owner_id ?? userId;
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();

    // Count guests who responded in the last hour
    const { data: recentGuests } = await supabase
      .from("guests")
      .select("id, full_name, rsvp_status")
      .eq("event_id", data.eventId)
      .in("rsvp_status", ["yes", "no"])
      .gte("updated_at", oneHourAgo);

    const count = recentGuests?.length ?? 1;
    const yesCount = (recentGuests ?? []).filter((g) => g.rsvp_status === "yes").length;
    const noCount = count - yesCount;

    const title =
      count === 1
        ? `New RSVP for ${event.name}`
        : `${count} new RSVPs for ${event.name}`;

    const parts: string[] = [];
    if (yesCount > 0) parts.push(`${yesCount} confirmed`);
    if (noCount > 0) parts.push(`${noCount} declined`);
    const body = parts.length > 0 ? parts.join(", ") + " in the last hour." : "Recent RSVP activity on your event.";

    // Check for a recent notification to update instead of inserting a duplicate
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", ownerId)
      .eq("category", "rsvp")
      .eq("entity_type", "event")
      .eq("entity_id", data.eventId)
      .gte("created_at", oneHourAgo)
      .limit(1)
      .maybeSingle();

    const preference = await getNotificationPreference(ownerId, "rsvp");
    if (existing && preference.in_app_enabled) {
      await supabase
        .from("notifications")
        .update({ title, body, read_at: null })
        .eq("id", existing.id);
    }
    await dispatchNotification({
        userId: ownerId,
        category: "rsvp",
        title,
        body,
        href: `/events/${data.eventId}`,
        entityType: "event",
        entityId: data.eventId,
        idempotencyKey: `rsvp:${data.eventId}:${Math.floor(Date.now() / 3_600_000)}`,
        skipInApp: Boolean(existing),
    });

    return { ok: true };
  });

// ────────────────────────────────────────────────────────────
// Proactive MelaAssist suggestions
// ────────────────────────────────────────────────────────────

export type EventSuggestion = {
  /** Stable key used for localStorage dismiss tracking */
  key: string;
  type: "warning" | "tip" | "action";
  message: string;
  ctaLabel: string;
  /** Tab to switch to in the event detail page */
  ctaTab?: string;
  /** Full route to navigate to */
  ctaRoute?: string;
  /** Pre-loaded MelaAssist prompt */
  ctaPrompt?: string;
};

/**
 * Compute up to 5 proactive planning suggestions for an event.
 * These are deterministic heuristics — no AI call involved.
 * The component layer caps and dismisses them client-side.
 */
export const computeEventSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ eventId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId: _userId } = context;

    const [
      { data: event },
      { data: tasks },
      { data: guests },
      { data: budget },
    ] = await Promise.all([
      supabase
        .from("events")
        .select("id, name, event_type, event_date, location, budget_target, guest_target")
        .eq("id", data.eventId)
        .single(),
      supabase
        .from("tasks")
        .select("id, title, status, priority, due_date, completed_at")
        .eq("event_id", data.eventId)
        .is("deleted_at", null),
      supabase
        .from("guests")
        .select("id, rsvp_status")
        .eq("event_id", data.eventId)
        .is("deleted_at", null),
      supabase
        .from("budget_items")
        .select("category, estimated_amount")
        .eq("event_id", data.eventId)
        .is("deleted_at", null),
    ]);

    if (!event) return { suggestions: [] as EventSuggestion[] };

    const suggestions: EventSuggestion[] = [];

    const daysToEvent = event.event_date
      ? Math.ceil(
          (new Date(event.event_date).getTime() - Date.now()) / 86_400_000,
        )
      : null;

    const guestList = guests ?? [];
    const taskList = tasks ?? [];
    const budgetList = budget ?? [];

    const confirmed = guestList.filter((g) => g.rsvp_status === "yes").length;
    const pending = guestList.filter((g) => g.rsvp_status === "pending").length;
    const total = guestList.length;
    const guestTarget = event.guest_target ?? total;

    const target = Number(event.budget_target ?? 0);
    const committed = budgetList.reduce(
      (s, i) => s + Number(i.estimated_amount ?? 0),
      0,
    );

    const doneTasks = taskList.filter(
      (t) => t.status === "done" || !!t.completed_at,
    ).length;
    const overdueTasks = taskList.filter(
      (t) =>
        t.status !== "done" &&
        !t.completed_at &&
        t.due_date &&
        new Date(t.due_date) < new Date(),
    );

    const budgetCategories = budgetList
      .map((b) => (b.category ?? "").toLowerCase())
      .filter(Boolean);

    // ── 1. Missing vendor categories ────────────────────────────────
    const ESSENTIAL = [
      { key: "venue", terms: ["venue", "hall", "ballroom", "garden"] },
      { key: "catering", terms: ["catering", "caterer", "food", "dining"] },
      {
        key: "photography",
        terms: ["photo", "photographer", "videograph", "film"],
      },
    ];

    for (const cat of ESSENTIAL) {
      const found = budgetCategories.some((c) =>
        cat.terms.some((t) => c.includes(t)),
      );
      if (!found && daysToEvent !== null && daysToEvent > 0) {
        suggestions.push({
          key: `missing-vendor-${cat.key}`,
          type: "action",
          message: `You haven't added a ${cat.key} vendor yet — ${daysToEvent} day${daysToEvent === 1 ? "" : "s"} to go.`,
          ctaLabel: "Browse vendors",
          ctaRoute: "/marketplace",
          ctaPrompt: `Help me find a ${cat.key} vendor for my ${event.event_type ?? "event"}. What should I look for?`,
        });
      }
    }

    // ── 2. Pending RSVPs ────────────────────────────────────────────
    if (pending > 0 && guestTarget > 0 && daysToEvent !== null && daysToEvent < 60) {
      suggestions.push({
        key: "rsvp-reminder",
        type: "tip",
        message: `${pending} guest${pending === 1 ? "" : "s"} haven't responded yet — ${daysToEvent} days to go.`,
        ctaLabel: "Review guests",
        ctaTab: "guests",
         ctaPrompt: `Help me review the ${pending} pending RSVPs for my event and decide what guest-list details need attention.`,
      });
    }

    // ── 3. Budget concern ───────────────────────────────────────────
    if (target > 0 && committed > target * 0.8) {
      const pct = Math.round((committed / target) * 100);
      suggestions.push({
        key: "budget-concern",
        type: "warning",
        message:
          committed > target
            ? `You're ${pct - 100}% over your $${target.toLocaleString()} budget target.`
            : `You've committed ${pct}% of your budget with more items likely coming.`,
        ctaLabel: "Review budget",
        ctaTab: "budget",
        ctaPrompt: "Help me identify where I can trim budget to get back on target.",
      });
    }

    // ── 4. Overdue tasks ────────────────────────────────────────────
    if (overdueTasks.length > 0) {
      suggestions.push({
        key: "overdue-tasks",
        type: "warning",
        message: `${overdueTasks.length} task${overdueTasks.length === 1 ? "" : "s"} past their due date — clearing ${overdueTasks.length === 1 ? "it" : "them"} keeps momentum.`,
        ctaLabel: "Open tasks",
        ctaTab: "tasks",
        ctaPrompt: `I have ${overdueTasks.length} overdue tasks. Help me prioritize which to tackle first.`,
      });
    }

    // ── 5. Event approaching with tasks lagging ─────────────────────
    if (
      daysToEvent !== null &&
      daysToEvent > 0 &&
      daysToEvent < 30 &&
      taskList.length > 0 &&
      doneTasks / taskList.length < 0.6
    ) {
      suggestions.push({
        key: "tasks-lagging-near-date",
        type: "warning",
        message: `${daysToEvent} days out — only ${Math.round((doneTasks / taskList.length) * 100)}% of tasks are done. A focused push this week helps.`,
        ctaLabel: "Open tasks",
        ctaTab: "tasks",
        ctaPrompt: "My event is less than 30 days away and I have a lot of tasks left. Help me make a sprint plan.",
      });
    }

    // ── 6. No event date set ─────────────────────────────────────────
    if (!event.event_date) {
      suggestions.push({
        key: "no-event-date",
        type: "action",
        message: "Your event date isn't set yet — vendors and guests need it to plan.",
        ctaLabel: "Set date",
        ctaTab: "details",
      });
    }

    // ── 7. Under 2 weeks — confirm vendor arrivals ───────────────────
    if (daysToEvent !== null && daysToEvent > 0 && daysToEvent <= 14 && confirmed > 0) {
      suggestions.push({
        key: "confirm-vendor-arrivals",
        type: "tip",
        message: `Under two weeks out — confirm vendor arrival times and finalize your day-of runsheet.`,
        ctaLabel: "View runsheet",
        ctaTab: "runsheet",
        ctaPrompt: "I'm two weeks from my event. What should I confirm with vendors and put on my runsheet?",
      });
    }

    return { suggestions: suggestions.slice(0, 5) };
  });
