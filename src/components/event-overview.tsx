import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity, Archive, ArrowRight, Calendar, CheckCircle2, ClipboardList, Clock,
  Copy, DollarSign, Heart, Lock, Map, MapPin, MoreHorizontal, PartyPopper, Plus,
  Sparkles, Store, Ticket, Timer, Trash2, TrendingUp, Users, Wallet, Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useFeatureGate } from "@/hooks/use-feature-gate";
import { UpgradeModal } from "@/components/upgrade-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { NeedsAttention } from "@/components/needs-attention";
import { ProactiveSuggestions } from "@/components/proactive-suggestions";
import { PlanningReadiness } from "@/components/planning-readiness";
import { useMelaAssistOptional } from "@/components/melaassist/context";

type Event = Database["public"]["Tables"]["events"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type BudgetItem = Database["public"]["Tables"]["budget_items"]["Row"];
type Guest = Database["public"]["Tables"]["guests"]["Row"];
type Activity = Database["public"]["Tables"]["activity_log"]["Row"];

export function EventOverview({
  event, tasks, budget, guests, onOpenTab, onArchive, onDelete, onDuplicate,
}: {
  event: Event;
  tasks: Task[];
  budget: BudgetItem[];
  guests: Guest[];
  onOpenTab: (tab: string) => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}) {
  const navigate = useNavigate();
  const [activity, setActivity] = useState<Activity[]>([]);
  const { allowed: ticketingAllowed, loading: ticketingLoading } = useFeatureGate("ticketing");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    let cancel = false;
    supabase.from("activity_log")
      .select("*").eq("event_id", event.id)
      .order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => { if (!cancel) setActivity(data ?? []); });
    return () => { cancel = true; };
  }, [event.id]);

  const countdown = useMemo(() => {
    if (!event.event_date) return null;
    return Math.ceil((new Date(event.event_date).getTime() - Date.now()) / 86400000);
  }, [event.event_date]);

  const countdownLabel = countdown === null ? "TBD"
    : countdown === 0 ? "Today"
    : countdown === 1 ? "Tomorrow"
    : countdown > 1 ? `${countdown}` : `${Math.abs(countdown)}`;
  const countdownSub = countdown === null ? "Set a date" : countdown > 1 ? "days to go"
    : countdown < 0 ? "days ago" : countdown === 0 ? "the big day" : "one day away";

  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const openTasks = tasks.length - doneTasks;
  const taskPct = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0;

  const budgetTarget = event.budget_target ? Number(event.budget_target)
    : budget.reduce((s, b) => s + Number(b.estimated_amount), 0);
  const budgetSpent = budget.reduce((s, b) => s + Number(b.actual_amount), 0);
  const budgetPaid = budget.reduce((s, b) => s + Number(b.paid_amount), 0);
  const budgetPct = budgetTarget > 0 ? Math.min(100, Math.round((budgetSpent / budgetTarget) * 100)) : 0;

  const rsvpYes = guests.filter((g) => g.rsvp_status === "yes").length;
  const rsvpPending = guests.filter((g) => g.rsvp_status === "pending").length;
  const guestTarget = event.guest_target ?? guests.length;
  const rsvpPct = guestTarget > 0 ? Math.round((rsvpYes / guestTarget) * 100) : 0;

  // Overall planning progress: weighted mix
  const planningPct = Math.round(
    (tasks.length ? taskPct : 40) * 0.4
    + (budget.length ? Math.min(100, budgetPct) : 30) * 0.25
    + (guests.length ? rsvpPct : 20) * 0.25
    + (event.location && event.event_date ? 100 : 40) * 0.1,
  );

  // Health score
  const health = useMemo(() => {
    let score = 100;
    const reasons: string[] = [];
    const overdue = tasks.filter((t) => t.status !== "done" && t.due_date && new Date(t.due_date) < new Date()).length;
    if (overdue > 0) { score -= Math.min(30, overdue * 8); reasons.push(`${overdue} overdue task${overdue > 1 ? "s" : ""}`); }
    if (budgetTarget > 0 && budgetSpent > budgetTarget) { score -= 20; reasons.push("Over budget"); }
    if (countdown !== null && countdown < 30 && taskPct < 60) { score -= 15; reasons.push("Tasks lagging near event date"); }
    if (guestTarget > 0 && rsvpPending > guestTarget * 0.4) { score -= 10; reasons.push("Many pending RSVPs"); }
    if (!event.event_date) { score -= 15; reasons.push("Event date not set"); }
    if (!event.location) { score -= 10; reasons.push("Location not confirmed"); }
    score = Math.max(0, Math.min(100, score));
    const label = score >= 85 ? "Excellent" : score >= 70 ? "On track" : score >= 50 ? "Needs attention" : "At risk";
    const tone = score >= 85 ? "emerald" : score >= 70 ? "sky" : score >= 50 ? "amber" : "rose";
    return { score, label, tone, reasons: reasons.slice(0, 3) };
  }, [tasks, budgetTarget, budgetSpent, countdown, taskPct, rsvpPending, guestTarget, event.event_date, event.location]);

  // Recommendations are now handled by the server-driven ProactiveSuggestions component.

  const todayISO = new Date().toISOString().slice(0, 10);
  const timeline = useMemo(() => {
    const upcoming = tasks
      .filter((t) => t.status !== "done" && t.due_date)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .slice(0, 5);
    return upcoming;
  }, [tasks]);

  const activityFeed = useMemo(() => {
    if (activity.length > 0) return activity.map((a) => ({
      id: a.id, title: a.summary || a.action, when: a.created_at,
    }));
    // Derive from tasks/budget/guests updates when no activity_log rows
    const derived = [
      ...tasks.slice(0, 3).map((t) => ({
        id: `t-${t.id}`,
        title: t.status === "done" ? `Completed “${t.title}”` : `Task added: ${t.title}`,
        when: t.completed_at ?? t.created_at,
      })),
      ...budget.slice(0, 2).map((b) => ({
        id: `b-${b.id}`, title: `Budget item: ${b.label}`, when: b.created_at,
      })),
      ...guests.slice(0, 2).map((g) => ({
        id: `g-${g.id}`, title: `Guest added: ${g.full_name}`, when: g.created_at,
      })),
    ].sort((a, b) => (a.when < b.when ? 1 : -1)).slice(0, 6);
    return derived;
  }, [activity, tasks, budget, guests]);

  const melaAssist = useMelaAssistOptional();

  return (
    <div className="space-y-6">
      {/* ============ HERO COMMAND HEADER ============ */}
      <Card className="relative overflow-hidden border-border/60 bg-hero-radial p-5 shadow-elegant sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5 border-primary/20 bg-primary/5 text-primary">
                <PartyPopper className="h-3 w-3" /> {event.event_type || "Event"}
              </Badge>
              <Badge variant="outline" className="capitalize">{event.status}</Badge>
            </div>
            <h1 className="font-display text-3xl font-semibold leading-tight sm:text-5xl">
              {event.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {event.event_date
                  ? new Date(event.event_date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                  : "Date to be set"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {event.location || "Location TBD"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {rsvpYes} confirmed of {guestTarget || guests.length || 0}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
                <span>Planning progress</span>
                <span className="font-semibold text-foreground">{planningPct}%</span>
              </div>
              <Progress value={planningPct} className="h-2" />
            </div>
          </div>

          <div className="grid place-items-center">
            <div className="relative rounded-3xl border border-primary/20 bg-background/70 px-8 py-6 text-center shadow-soft backdrop-blur">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Countdown</div>
              <div className="mt-1 font-display text-6xl font-semibold leading-none text-gradient sm:text-7xl">
                {countdownLabel}
              </div>
              <div className="mt-1 text-xs font-medium text-muted-foreground">{countdownSub}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* ============ NEEDS ATTENTION ============ */}
      <NeedsAttention
        event={event}
        tasks={tasks}
        budget={budget}
        guests={guests}
        onOpenTab={onOpenTab}
      />

      {/* ============ EDITABLE QUICK CARDS ============ */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <QuickCard icon={Calendar} label="Date" tone="primary" onEdit={() => onOpenTab("details")}
          value={event.event_date ? new Date(event.event_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Set date"}
          sub={event.event_time ? event.event_time.slice(0, 5) : "Add time"} />
        <QuickCard icon={MapPin} label="Location" tone="gold" onEdit={() => onOpenTab("details")}
          value={event.location || "Add location"}
          sub={event.venue_city ? `${event.venue_city}${event.venue_state ? `, ${event.venue_state}` : ""}` : "Venue"} />
        <QuickCard icon={Users} label="Guests" tone="sky" onEdit={() => onOpenTab("guests")}
          value={`${rsvpYes}/${guestTarget || guests.length || 0}`}
          sub={`${rsvpPending} pending`} />
        <QuickCard icon={Wallet} label="Budget" tone="emerald" onEdit={() => onOpenTab("budget")}
          value={`$${(budgetSpent / 1000).toFixed(1)}k`}
          sub={budgetTarget ? `of $${(budgetTarget / 1000).toFixed(0)}k` : "no target"} />
        <QuickCard icon={TrendingUp} label="Progress" tone="rose" onEdit={() => onOpenTab("tasks")}
          value={`${planningPct}%`} sub={`${doneTasks}/${tasks.length || 0} tasks`} />
      </div>

      {/* ============ READINESS + AI PANEL ROW ============ */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Planning Readiness */}
        <Card className="border-border/60 p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3 className="font-display text-lg font-semibold">Planning Readiness</h3>
          </div>
          <PlanningReadiness
            event={event}
            tasks={tasks}
            budget={budget}
            guests={guests}
            onOpenTab={onOpenTab}
          />
        </Card>

        {/* MelaAssist AI Panel */}
        <Card className="relative overflow-hidden border-primary/20 bg-hero-radial p-5 shadow-elegant">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-primary">MelaAssist™</div>
                <h3 className="font-display text-lg font-semibold">Proactive recommendations</h3>
              </div>
            </div>
            {melaAssist && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-primary hover:bg-primary/5"
                onClick={() => melaAssist.openAssistant()}
              >
                Ask <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <ProactiveSuggestions eventId={event.id} onOpenTab={onOpenTab} />
        </Card>
      </div>

      {/* ============ QUICK ACTIONS ============ */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Quick actions</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <QuickAction icon={Plus} label="Add Task" onClick={() => onOpenTab("tasks")} />
          <QuickAction icon={Users} label="Invite Guests" onClick={() => onOpenTab("guests")} />
          <QuickAction icon={Store} label="Find Vendors" onClick={() => navigate({ to: "/marketplace" })} />
          <QuickAction
            icon={Ticket}
            label="Sell Tickets"
            locked={!ticketingLoading && !ticketingAllowed}
            onClick={() => ticketingAllowed ? onOpenTab("tickets") : setUpgradeOpen(true)}
          />
          {/* Event Day button — shows within 48 h of the event */}
          {countdown !== null && countdown >= 0 && countdown <= 2 && (
            <QuickAction
              icon={Zap}
              label="Event Day"
              highlight
              onClick={() => navigate({ to: `/event-day/${event.id}` as never })}
            />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="group text-left">
                <Card className="flex h-full items-center gap-3 border-border/60 p-3.5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-elegant">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-medium">More</span>
                </Card>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {onDuplicate && (
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="mr-2 h-4 w-4" aria-hidden="true" /> Duplicate event
                </DropdownMenuItem>
              )}
              {onDuplicate && (onArchive || onDelete) && <DropdownMenuSeparator />}
              {onArchive && (
                <DropdownMenuItem onClick={() => setArchiveConfirmOpen(true)}>
                  <Archive className="mr-2 h-4 w-4" aria-hidden="true" /> Archive event
                </DropdownMenuItem>
              )}
              {onArchive && onDelete && <DropdownMenuSeparator />}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Delete event
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <UpgradeModal feature="ticketing" open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      <ConfirmDialog
        open={archiveConfirmOpen}
        onOpenChange={(v) => !v && setArchiveConfirmOpen(false)}
        title="Archive this event?"
        description={<p>&ldquo;{event.name}&rdquo; will be hidden from Active events but kept for future reference. You can restore it anytime from the Archived tab.</p>}
        confirmLabel="Archive"
        onConfirm={async () => { onArchive?.(); }}
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(v) => !v && setDeleteConfirmOpen(false)}
        destructive
        title="Delete this event?"
        description={<p>You&rsquo;re about to delete &ldquo;{event.name}&rdquo;. This event will be moved to Trash and can be restored for 30&nbsp;days. After that it&rsquo;s permanently removed.</p>}
        confirmLabel="Move to Trash"
        onConfirm={async () => { onDelete?.(); }}
      />

      {/* ============ TASK PROGRESS + TIMELINE + ACTIVITY ============ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Task tracker */}
        <Card className="border-border/60 p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <h3 className="font-display text-lg font-semibold">Task tracker</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onOpenTab("tasks")} className="gap-1 text-xs">
              Open <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative grid h-24 w-24 shrink-0 place-items-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" className="stroke-muted" strokeWidth="3" />
                <circle cx="18" cy="18" r="16" fill="none" strokeLinecap="round" strokeWidth="3"
                  className="stroke-primary transition-all"
                  strokeDasharray={`${(taskPct / 100) * 100.53} 100.53`} />
              </svg>
              <div className="text-center">
                <div className="font-display text-xl font-semibold">{taskPct}%</div>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2 text-sm">
              <Row label="Completed" value={doneTasks} tone="emerald" />
              <Row label="Remaining" value={openTasks} tone="primary" />
              <Row label="Overdue" tone="rose"
                value={tasks.filter((t) => t.status !== "done" && t.due_date && new Date(t.due_date) < new Date()).length} />
            </div>
          </div>
        </Card>

        {/* Today's timeline */}
        <Card className="border-border/60 p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="font-display text-lg font-semibold">Up next</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onOpenTab("tasks")} className="gap-1 text-xs">
              All <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled tasks yet. Add due dates to see them here.</p>
          ) : (
            <ul className="space-y-2.5">
              {timeline.map((t) => {
                const isToday = t.due_date === todayISO;
                const isOverdue = t.due_date! < todayISO;
                return (
                  <li key={t.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      isOverdue ? "bg-rose-500/10 text-rose-600"
                      : isToday ? "bg-amber-500/10 text-amber-600"
                      : "bg-primary/10 text-primary"
                    }`}>
                      <Timer className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {isOverdue ? "Overdue" : isToday ? "Today" : new Date(t.due_date!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        {" • "}<span className="capitalize">{t.priority}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Recent activity */}
        <Card className="border-border/60 p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-display text-lg font-semibold">Recent activity</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/notifications" })} className="gap-1 text-xs">
              All <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          {activityFeed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Activity will show here as you plan.</p>
          ) : (
            <ul className="space-y-3">
              {activityFeed.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.when).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function QuickCard({ icon: Icon, label, value, sub, tone, onEdit }: {
  icon: typeof Zap; label: string; value: string; sub: string;
  tone: "primary" | "gold" | "sky" | "emerald" | "rose";
  onEdit: () => void;
}) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-gold/15 text-gold-foreground",
    sky: "bg-sky-500/10 text-sky-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    rose: "bg-rose-500/10 text-rose-600",
  };
  return (
    <button
      onClick={onEdit}
      className="group text-left"
    >
      <Card className="h-full border-border/60 p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant">
        <div className="mb-3 flex items-center justify-between">
          <div className={`grid h-9 w-9 place-items-center rounded-xl ${toneMap[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-0 transition group-hover:opacity-100">Edit</span>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="truncate font-display text-xl font-semibold">{value}</div>
        <div className="truncate text-xs text-muted-foreground">{sub}</div>
      </Card>
    </button>
  );
}

function QuickAction({
  icon: Icon, label, onClick, locked = false, highlight = false,
}: {
  icon: typeof Zap;
  label: string;
  onClick: () => void;
  locked?: boolean;
  highlight?: boolean;
}) {
  return (
    <button onClick={onClick} className="group text-left">
      <Card className={`flex h-full items-center gap-3 p-3.5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elegant ${
        highlight
          ? "border-amber-400/60 bg-amber-50/60 hover:border-amber-500/60 dark:bg-amber-950/20"
          : "border-border/60 hover:border-primary/40 hover:bg-primary/5"
      }`}>
        <div className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${
          highlight
            ? "bg-amber-400/20 text-amber-600 group-hover:bg-amber-500 group-hover:text-white dark:text-amber-400"
            : locked
            ? "bg-muted text-muted-foreground group-hover:bg-muted/80"
            : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
        }`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
          {locked && (
            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 shadow-sm">
              <Lock className="h-2 w-2 text-white" aria-label="Premium feature" />
            </span>
          )}
        </div>
        <span className={`text-sm font-medium ${highlight ? "text-amber-700 dark:text-amber-300" : locked ? "text-muted-foreground" : ""}`}>{label}</span>
      </Card>
    </button>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone: "emerald" | "primary" | "rose" }) {
  const toneMap: Record<string, string> = {
    emerald: "bg-emerald-500", primary: "bg-primary", rose: "bg-rose-500",
  };
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${toneMap[tone]}`} /> {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
