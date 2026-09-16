/**
 * PostEventRecap — visible after the event date + 24 h or when status is "completed".
 * Aggregates attendance, budget, tickets, tasks, and vendors into a single dashboard.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Users, Wallet, Ticket, ClipboardList, Store, Loader2,
  TrendingUp, AlertCircle, CheckCircle2, Clock, Copy, RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { getEventRecap } from "@/lib/event-comms.functions";
import { cn } from "@/lib/utils";

type Recap = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof getEventRecap>>>>;

interface Props {
  eventId: string;
  onDuplicate?: () => void;
}

/** Auto-refresh interval in milliseconds (30 s). */
const POLL_INTERVAL_MS = 30_000;

function fmtMoney(cents: number, suffix = "") {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${suffix}`;
}

function fmtDollars(n: number) {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function useSecondsAgo(timestamp: number | null): number {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (timestamp === null) return;
    const update = () => setSecs(Math.floor((Date.now() - timestamp) / 1000));
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [timestamp]);
  return secs;
}

export function PostEventRecap({ eventId, onDuplicate }: Props) {
  const getFn = useServerFn(getEventRecap);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [recap, setRecap] = useState<Recap | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secsAgo = useSecondsAgo(lastFetched);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setState((s) => (s === "ok" ? "ok" : "loading"));
    if (silent) setRefreshing(true);
    try {
      const r = await getFn({ data: { eventId } });
      setRecap(r);
      setState("ok");
      setLastFetched(Date.now());
    } catch {
      if (!silent) setState("error");
    } finally {
      if (silent) setRefreshing(false);
    }
  }, [eventId, getFn]);

  // Initial load + polling with Page Visibility pause
  useEffect(() => {
    fetch(false);

    const startPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === "visible") fetch(true);
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetch(true); // immediate refresh on tab focus
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [eventId, fetch]);

  if (state === "loading") {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "error" || !recap) {
    return (
      <Card className="border-border/60 p-10 text-center shadow-soft">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Could not load recap. Try refreshing.</p>
      </Card>
    );
  }

  const { attendance, budget, tickets, tasks, vendors, runsheet } = recap;

  const rsvpTotal = attendance.totalGuests || 1;
  const confirmedPct = Math.round((attendance.confirmedGuests / rsvpTotal) * 100);
  const declinedPct = Math.round((attendance.declinedGuests / rsvpTotal) * 100);
  const pendingPct = 100 - confirmedPct - declinedPct;

  const checkinPct = attendance.totalAttendees > 0
    ? Math.round((attendance.checkedIn / attendance.totalAttendees) * 100)
    : null;

  const taskPct = tasks.total > 0 ? Math.round((tasks.completed / tasks.total) * 100) : 100;

  const budgetPct = budget.target > 0
    ? Math.min(120, Math.round((budget.actual / budget.target) * 100))
    : null;

  const overBudget = budget.target > 0 && budget.actual > budget.target;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{recap.event.name}</h2>
          <p className="text-sm text-muted-foreground">
            Post-event recap
            {recap.event.event_date ? ` · ${new Date(recap.event.event_date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Live update indicator */}
          {lastFetched && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {refreshing
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>}
              <span>
                {refreshing ? "Refreshing…" : secsAgo < 10 ? "Just updated" : `Updated ${secsAgo}s ago`}
              </span>
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={refreshing}
            onClick={() => fetch(true)}
            title="Refresh now"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
          {onDuplicate && (
            <Button variant="outline" className="gap-2" onClick={onDuplicate}>
              <Copy className="h-4 w-4" /> Duplicate this event
            </Button>
          )}
        </div>
      </div>

      {/* Key stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RecapCard
          icon={Users}
          label="Attendance"
          value={attendance.checkedIn > 0 ? `${attendance.checkedIn}/${attendance.totalAttendees}` : `${attendance.confirmedGuests}/${attendance.totalGuests}`}
          sub={attendance.checkedIn > 0 ? `${checkinPct}% check-in rate` : `${confirmedPct}% RSVP confirmed`}
          tone="primary"
        />
        <RecapCard
          icon={Wallet}
          label="Total spend"
          value={fmtDollars(budget.actual)}
          sub={budget.target > 0 ? `of ${fmtDollars(budget.target)} budget${overBudget ? " · over budget" : ""}` : "no budget set"}
          tone={overBudget ? "rose" : "emerald"}
        />
        {tickets.revenueCents > 0 && (
          <RecapCard
            icon={Ticket}
            label="Ticket revenue"
            value={fmtMoney(tickets.revenueCents)}
            sub={`${tickets.sold} ticket${tickets.sold !== 1 ? "s" : ""} sold`}
            tone="sky"
          />
        )}
        <RecapCard
          icon={ClipboardList}
          label="Tasks"
          value={`${tasks.completed}/${tasks.total}`}
          sub={`${taskPct}% completed`}
          tone={tasks.open > 0 ? "amber" : "emerald"}
        />
      </div>

      {/* RSVP breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 p-5 shadow-soft">
          <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold">
            <Users className="h-4 w-4 text-primary" /> RSVP breakdown
          </h3>
          <div className="space-y-3">
            <BarRow label="Confirmed" count={attendance.confirmedGuests} total={rsvpTotal} color="bg-emerald-500" />
            <BarRow label="Declined" count={attendance.declinedGuests} total={rsvpTotal} color="bg-rose-500" />
            <BarRow label="Pending" count={attendance.pendingGuests} total={rsvpTotal} color="bg-amber-400" />
          </div>
          {attendance.plusOnes > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              +{attendance.plusOnes} plus-one{attendance.plusOnes !== 1 ? "s" : ""} included
            </p>
          )}
        </Card>

        {/* Budget by category */}
        <Card className="border-border/60 p-5 shadow-soft">
          <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold">
            <Wallet className="h-4 w-4 text-primary" /> Budget by category
          </h3>
          {Object.keys(budget.byCategory).length === 0 ? (
            <p className="text-sm text-muted-foreground">No budget items recorded.</p>
          ) : (
            <div className="space-y-2.5 text-sm max-h-60 overflow-y-auto pr-1">
              {Object.entries(budget.byCategory)
                .sort((a, b) => b[1].actual - a[1].actual)
                .map(([cat, vals]) => (
                  <div key={cat} className="flex items-center justify-between gap-3">
                    <span className="truncate text-muted-foreground">{cat}</span>
                    <div className="text-right shrink-0">
                      <span className="font-semibold">{fmtDollars(vals.actual)}</span>
                      {vals.estimated > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">/ {fmtDollars(vals.estimated)}</span>
                      )}
                    </div>
                  </div>
                ))}
              <div className="border-t border-border/60 pt-2 flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{fmtDollars(budget.actual)}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Vendors */}
      {vendors.length > 0 && (
        <Card className="border-border/60 p-5 shadow-soft">
          <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold">
            <Store className="h-4 w-4 text-primary" /> Vendors used
          </h3>
          <div className="space-y-2">
            {vendors.map((v: { id: string; category: string | null; notes: string | null; status: string | null; priority: number | null }) => (
              <div key={v.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <span className="font-medium">{v.category || "Vendor"}</span>
                  {v.notes && <span className="ml-1 text-muted-foreground">— {v.notes}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {v.priority != null && (
                    <span className="text-xs text-muted-foreground">P{v.priority}</span>
                  )}
                  <StatusBadge status={v.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Open follow-ups */}
      {(tasks.open > 0 || budget.unpaidItems.length > 0) && (
        <Card className="border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 p-5 shadow-soft">
          <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4" /> Open follow-ups
          </h3>
          <div className="space-y-1.5 text-sm">
            {tasks.open > 0 && (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{tasks.open}</span> task{tasks.open !== 1 ? "s" : ""} not completed
              </p>
            )}
            {budget.unpaidItems.map((item: any, i: number) => (
              <p key={i} className="text-muted-foreground">
                Unpaid: <span className="font-medium text-foreground">{item.label}</span>
                {" — "}{fmtDollars(item.unpaid)} outstanding
              </p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function RecapCard({ icon: Icon, label, value, sub, tone }: {
  icon: typeof Users;
  label: string;
  value: string;
  sub: string;
  tone: "primary" | "emerald" | "rose" | "sky" | "amber";
}) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600",
    rose: "bg-rose-500/10 text-rose-600",
    sky: "bg-sky-500/10 text-sky-600",
    amber: "bg-amber-500/10 text-amber-600",
  };
  return (
    <Card className="border-border/60 p-4 shadow-soft">
      <div className={cn("mb-3 grid h-9 w-9 place-items-center rounded-xl", toneMap[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-display text-2xl font-semibold">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{count} <span className="font-normal text-muted-foreground">({pct}%)</span></span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, string> = {
    booked: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
    confirmed: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
    pending: "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
    declined: "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30",
    cancelled: "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] capitalize", map[status.toLowerCase()] ?? "")}>
      {status}
    </Badge>
  );
}
