/**
 * NeedsAttention
 *
 * Shows a compact, scannable list of the most important planning signals
 * for an event — all computed deterministically from already-loaded data,
 * no extra fetches needed.  Every item links to the exact screen that
 * resolves it.  When nothing needs attention the section shows a positive
 * empty state instead of disappearing.
 */

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Calendar,
  MapPin,
  Users,
  Wallet,
  CheckSquare,
  Store,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type BudgetItem = Database["public"]["Tables"]["budget_items"]["Row"];
type Guest = Database["public"]["Tables"]["guests"]["Row"];

type AttentionItem = {
  id: string;
  severity: "error" | "warning" | "info";
  icon: typeof AlertTriangle;
  message: string;
  actionLabel: string;
  onAction: () => void;
};

const SEVERITY_STYLES = {
  error: {
    icon: "bg-rose-500/10 text-rose-600",
    border: "border-rose-200/60 dark:border-rose-800/40",
    bg: "bg-rose-50/60 dark:bg-rose-950/20",
  },
  warning: {
    icon: "bg-amber-500/10 text-amber-600",
    border: "border-amber-200/60 dark:border-amber-800/40",
    bg: "bg-amber-50/60 dark:bg-amber-950/20",
  },
  info: {
    icon: "bg-primary/10 text-primary",
    border: "border-border/60",
    bg: "bg-muted/20",
  },
} as const;

export function NeedsAttention({
  event,
  tasks,
  budget,
  guests,
  onOpenTab,
}: {
  event: Event;
  tasks: Task[];
  budget: BudgetItem[];
  guests: Guest[];
  onOpenTab: (tab: string) => void;
}) {
  const items = useMemo<AttentionItem[]>(() => {
    const list: AttentionItem[] = [];

    // ── Overdue tasks ────────────────────────────────────────────────
    const overdue = tasks.filter(
      (t) =>
        t.status !== "done" &&
        t.due_date &&
        new Date(t.due_date) < new Date(),
    );
    if (overdue.length > 0) {
      list.push({
        id: "overdue-tasks",
        severity: "error",
        icon: CheckSquare,
        message:
          overdue.length === 1
            ? `"${overdue[0].title}" is overdue.`
            : `${overdue.length} tasks are past their due date.`,
        actionLabel: "View tasks",
        onAction: () => onOpenTab("tasks"),
      });
    }

    // ── Budget target exceeded ───────────────────────────────────────
    const budgetTarget = event.budget_target ? Number(event.budget_target) : 0;
    const committed = budget.reduce(
      (s, b) => s + Number(b.estimated_amount ?? 0),
      0,
    );
    if (budgetTarget > 0 && committed > budgetTarget) {
      const over = committed - budgetTarget;
      list.push({
        id: "over-budget",
        severity: "error",
        icon: Wallet,
        message: `Committed spend is $${over.toLocaleString()} over your $${budgetTarget.toLocaleString()} budget target.`,
        actionLabel: "Review budget",
        onAction: () => onOpenTab("budget"),
      });
    } else if (budgetTarget > 0 && committed > budgetTarget * 0.8) {
      list.push({
        id: "budget-warning",
        severity: "warning",
        icon: Wallet,
        message: `Budget is at ${Math.round((committed / budgetTarget) * 100)}% — nearing your $${budgetTarget.toLocaleString()} target.`,
        actionLabel: "Review budget",
        onAction: () => onOpenTab("budget"),
      });
    }

    // ── Many pending RSVPs near event date ──────────────────────────
    const pendingGuests = guests.filter((g) => g.rsvp_status === "pending");
    const daysToEvent = event.event_date
      ? Math.ceil(
          (new Date(event.event_date).getTime() - Date.now()) / 86_400_000,
        )
      : null;

    if (
      pendingGuests.length >= 5 &&
      daysToEvent !== null &&
      daysToEvent < 45 &&
      daysToEvent > 0
    ) {
      list.push({
        id: "pending-rsvps",
        severity: "warning",
        icon: Users,
        message: `${pendingGuests.length} guests haven't responded — event is in ${daysToEvent} day${daysToEvent === 1 ? "" : "s"}.`,
        actionLabel: "Send reminders",
        onAction: () => onOpenTab("guests"),
      });
    }

    // ── No event date set ────────────────────────────────────────────
    if (!event.event_date) {
      list.push({
        id: "no-date",
        severity: "warning",
        icon: Calendar,
        message: "Event date isn't set — vendors and guests need it to plan ahead.",
        actionLabel: "Set date",
        onAction: () => onOpenTab("details"),
      });
    }

    // ── No location set ──────────────────────────────────────────────
    if (!event.location) {
      list.push({
        id: "no-location",
        severity: "info",
        icon: MapPin,
        message: "Location hasn't been confirmed yet.",
        actionLabel: "Add location",
        onAction: () => onOpenTab("details"),
      });
    }

    // ── No vendor needs / budget ─────────────────────────────────────
    if (budget.length === 0 && (daysToEvent === null || daysToEvent > 7)) {
      list.push({
        id: "no-budget",
        severity: "info",
        icon: Store,
        message: "No budget items added yet — starting with venue and catering helps estimate costs.",
        actionLabel: "Add budget",
        onAction: () => onOpenTab("budget"),
      });
    }

    // Keep the list focused — show only top 4 most important items
    return list.slice(0, 4);
  }, [event, tasks, budget, guests, onOpenTab]);

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/60 bg-emerald-50/60 px-5 py-3.5 dark:border-emerald-800/40 dark:bg-emerald-950/20">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
          Everything looks great for{" "}
          <span className="font-semibold">{event.name}</span> — you're on track!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Needs attention
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const s = SEVERITY_STYLES[item.severity];
          const Icon = item.icon;
          return (
            <Card
              key={item.id}
              className={`flex items-start gap-3 border p-3.5 shadow-none ${s.border} ${s.bg}`}
            >
              <div
                className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${s.icon}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{item.message}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={item.onAction}
                className="shrink-0 gap-1 text-xs"
              >
                {item.actionLabel}{" "}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
