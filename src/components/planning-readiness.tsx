/**
 * Planning Readiness Panel
 *
 * Replaces the abstract 0-100 "Event Health" score with a grouped,
 * actionable readiness checklist. Signals are bucketed into:
 *   ✅ Confirmed  — the item is done or on track
 *   ⚠️ Needs attention — something needs action soon
 *   ⬜ Not started — nothing recorded yet
 *
 * Each signal is a tap target that navigates to the relevant tab.
 */

import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, Circle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type BudgetItem = Database["public"]["Tables"]["budget_items"]["Row"];
type Guest = Database["public"]["Tables"]["guests"]["Row"];

export type ReadinessSignal = {
  key: string;
  label: string;
  status: "confirmed" | "attention" | "not_started";
  detail?: string;
  tab?: string;
};

function computeSignals(
  event: Event,
  tasks: Task[],
  budget: BudgetItem[],
  guests: Guest[],
): ReadinessSignal[] {
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = tasks.filter(
    (t) => t.status !== "done" && t.due_date && t.due_date < today,
  );
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const rsvpYes = guests.filter((g) => g.rsvp_status === "yes").length;
  const rsvpPending = guests.filter((g) => g.rsvp_status === "pending").length;
  const guestTarget = event.guest_target ?? guests.length;
  const budgetTarget = event.budget_target ? Number(event.budget_target) : null;
  const budgetSpent = budget.reduce((s, b) => s + Number(b.actual_amount), 0);
  const budgetCommitted = budget.reduce((s, b) => s + Number(b.estimated_amount), 0);

  const signals: ReadinessSignal[] = [];

  // Date
  if (event.event_date) {
    signals.push({ key: "date", label: "Event date confirmed", status: "confirmed",
      detail: new Date(event.event_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      tab: "details" });
  } else {
    signals.push({ key: "date", label: "Event date not set", status: "attention",
      detail: "Vendors and guests need a date", tab: "details" });
  }

  // Location
  if (event.location) {
    signals.push({ key: "location", label: "Venue confirmed", status: "confirmed",
      detail: event.location.split(",")[0], tab: "details" });
  } else {
    signals.push({ key: "location", label: "No venue set", status: "not_started",
      tab: "details" });
  }

  // Tasks
  if (tasks.length === 0) {
    signals.push({ key: "tasks", label: "No planning tasks yet", status: "not_started", tab: "tasks" });
  } else if (overdueTasks.length > 0) {
    signals.push({ key: "tasks", label: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""}`,
      status: "attention", detail: `${doneTasks}/${tasks.length} done`, tab: "tasks" });
  } else {
    signals.push({ key: "tasks", label: `Tasks on track`, status: "confirmed",
      detail: `${doneTasks}/${tasks.length} done`, tab: "tasks" });
  }

  // Budget
  if (budget.length === 0) {
    signals.push({ key: "budget", label: "Budget not started", status: "not_started", tab: "budget" });
  } else if (budgetTarget && budgetCommitted > budgetTarget) {
    signals.push({ key: "budget", label: "Over budget", status: "attention",
      detail: `$${(budgetCommitted / 1000).toFixed(1)}k of $${(budgetTarget / 1000).toFixed(0)}k`, tab: "budget" });
  } else {
    signals.push({ key: "budget", label: "Budget tracked", status: "confirmed",
      detail: budgetTarget ? `$${(budgetSpent / 1000).toFixed(1)}k spent of $${(budgetTarget / 1000).toFixed(0)}k` : `${budget.length} categories`,
      tab: "budget" });
  }

  // Guests / RSVPs
  if (guests.length === 0) {
    signals.push({ key: "guests", label: "No guests added", status: "not_started", tab: "guests" });
  } else if (rsvpPending > 0 && guestTarget > 0 && rsvpPending > guestTarget * 0.3) {
    signals.push({ key: "guests", label: `${rsvpPending} pending RSVPs`,
      status: "attention", detail: `${rsvpYes} confirmed of ${guestTarget}`, tab: "guests" });
  } else {
    signals.push({ key: "guests", label: `${rsvpYes} guests confirmed`,
      status: rsvpYes > 0 ? "confirmed" : "not_started",
      detail: rsvpPending > 0 ? `${rsvpPending} still pending` : "All responded", tab: "guests" });
  }

  // Vendors
  signals.push({ key: "vendors", label: "Vendor needs", status: "not_started",
    detail: "Tap to review vendor requirements", tab: "vendors" });

  // Runsheet
  signals.push({ key: "runsheet", label: "Day-of runsheet",
    status: "not_started", detail: "Tap to build your timeline", tab: "runsheet" });

  return signals;
}

const STATUS_ICON = {
  confirmed: CheckCircle2,
  attention: AlertTriangle,
  not_started: Circle,
};

const STATUS_COLOR = {
  confirmed: "text-emerald-600 dark:text-emerald-400",
  attention: "text-amber-600 dark:text-amber-400",
  not_started: "text-muted-foreground/50",
};

const STATUS_ROW_BG = {
  confirmed: "",
  attention: "bg-amber-50/60 dark:bg-amber-950/20",
  not_started: "",
};

const BUCKET_LABEL: Record<ReadinessSignal["status"], string> = {
  confirmed: "On track",
  attention: "Needs attention",
  not_started: "Not started",
};

const BUCKET_BADGE: Record<ReadinessSignal["status"], string> = {
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  attention: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  not_started: "bg-muted text-muted-foreground",
};

export function PlanningReadiness({
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
  const signals = useMemo(
    () => computeSignals(event, tasks, budget, guests),
    [event, tasks, budget, guests],
  );

  const confirmed = signals.filter((s) => s.status === "confirmed");
  const attention = signals.filter((s) => s.status === "attention");
  const notStarted = signals.filter((s) => s.status === "not_started");

  const readinessPct = Math.round((confirmed.length / signals.length) * 100);

  const allBuckets: Array<{ status: ReadinessSignal["status"]; items: ReadinessSignal[] }> = [
    { status: "attention" as const, items: attention },
    { status: "confirmed" as const, items: confirmed },
    { status: "not_started" as const, items: notStarted },
  ];
  const buckets = allBuckets.filter((b) => b.items.length > 0);

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-semibold text-gradient">{readinessPct}%</span>
            <span className="text-sm text-muted-foreground">planning readiness</span>
          </div>
          <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all"
              style={{ width: `${readinessPct}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {(["confirmed", "attention", "not_started"] as const).map((s) => {
            const count = signals.filter((x) => x.status === s).length;
            if (count === 0) return null;
            return (
              <span key={s} className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", BUCKET_BADGE[s])}>
                {count} {BUCKET_LABEL[s]}
              </span>
            );
          })}
        </div>
      </div>

      {/* Signal rows */}
      <div className="divide-y divide-border/40 rounded-xl border border-border/60 overflow-hidden">
        {buckets.map(({ status, items }) =>
          items.map((signal) => {
            const Icon = STATUS_ICON[signal.status];
            return (
              <button
                key={signal.key}
                type="button"
                onClick={() => signal.tab && onOpenTab(signal.tab)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/40",
                  STATUS_ROW_BG[signal.status],
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", STATUS_COLOR[signal.status])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{signal.label}</p>
                  {signal.detail && (
                    <p className="text-xs text-muted-foreground">{signal.detail}</p>
                  )}
                </div>
                {signal.tab && (
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
