import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft, Calendar, MapPin, Users, Wallet, Trash2, Plus, Check, Circle,
  Loader2, Sparkles, ClipboardList, PartyPopper, Save, Pencil,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { EventDashboardPreview, type DashboardData } from "@/components/event-dashboard-preview";

type Event = Database["public"]["Tables"]["events"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type BudgetItem = Database["public"]["Tables"]["budget_items"]["Row"];
type Guest = Database["public"]["Tables"]["guests"]["Row"];

export const Route = createFileRoute("/_authenticated/events/$eventId")({
  head: () => ({ meta: [{ title: "Event — MelaBridge" }] }),
  component: EventDetailPage,
});

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null | undefined>(undefined);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [budget, setBudget] = useState<BudgetItem[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [tab, setTab] = useState("overview");

  async function reload() {
    const [ev, t, b, g] = await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
      supabase.from("tasks").select("*").eq("event_id", eventId).order("created_at"),
      supabase.from("budget_items").select("*").eq("event_id", eventId).order("created_at"),
      supabase.from("guests").select("*").eq("event_id", eventId).order("created_at"),
    ]);
    if (ev.error) toast.error(ev.error.message);
    setEvent(ev.data ?? null);
    setTasks(t.data ?? []);
    setBudget(b.data ?? []);
    setGuests(g.data ?? []);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const countdown = useMemo(() => {
    if (!event?.event_date) return null;
    const diff = Math.ceil((new Date(event.event_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [event?.event_date]);

  const taskProgress = tasks.length
    ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100)
    : 0;

  const budgetTotals = useMemo(() => {
    const est = budget.reduce((s, b) => s + Number(b.estimated_amount), 0);
    const act = budget.reduce((s, b) => s + Number(b.actual_amount), 0);
    const paid = budget.reduce((s, b) => s + Number(b.paid_amount), 0);
    return { est, act, paid };
  }, [budget]);

  const rsvpCounts = useMemo(() => {
    const counts = { yes: 0, no: 0, maybe: 0, pending: 0 };
    guests.forEach((g) => { counts[g.rsvp_status]++; });
    return counts;
  }, [guests]);

  const dashboardData = useMemo<DashboardData | null>(() => {
    if (!event) return null;
    const actualBudget = budgetTotals.act || budgetTotals.est || 0;
    const totalBudget = event.budget_target ? Number(event.budget_target) : Math.max(actualBudget, 1);
    const visibleTasks = tasks.length
      ? tasks.slice(0, 5).map((task) => ({
          id: task.id,
          title: task.title,
          done: task.status === "done",
          due: task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "2-digit" }) : undefined,
        }))
      : [{ id: "first-task", title: "Add your first planning task", done: false }];
    const vendorsFromBudget = budget
      .filter((item) => item.vendor_name || item.category)
      .slice(0, 4)
      .map((item) => ({
        name: item.vendor_name || item.label,
        role: item.category,
        status: item.status === "paid" ? "confirmed" as const : item.status === "quoted" ? "quoted" as const : "pending" as const,
      }));
    const timeline = [
      { date: "Start", label: "Event created", done: true },
      { date: "Plan", label: "Tasks drafted", done: tasks.length > 0 },
      { date: "Invite", label: "Guests added", done: guests.length > 0 },
      { date: "Book", label: "Vendors tracked", done: budget.length > 0 },
      { date: "Live", label: "Event day", done: countdown !== null && countdown <= 0 },
    ];
    return {
      eventName: event.name,
      eventType: event.event_type || "Event",
      location: event.location || "Location to be confirmed",
      daysRemaining: Math.max(0, countdown ?? 0),
      guests: {
        invited: Math.max(guests.length, event.guest_target ?? guests.length, 1),
        confirmed: rsvpCounts.yes,
        pending: rsvpCounts.pending + rsvpCounts.maybe,
        declined: rsvpCounts.no,
      },
      budget: { spent: actualBudget, total: Math.max(totalBudget, actualBudget, 1) },
      tasks: visibleTasks,
      vendors: vendorsFromBudget.length
        ? vendorsFromBudget
        : [{ name: "Add vendor quotes", role: "Planning", status: "pending" as const }],
      aiRecommendation:
        tasks.filter((task) => task.status !== "done").length > 0
          ? "Focus on the next open task, then update guests and vendor quotes so your plan stays current."
          : "Your core task list is clear. Add budget items, guests, and vendors to unlock richer planning guidance.",
      activity: [
        { who: "MelaBridge", what: "synced this dashboard from your event workspace", when: "now" },
        ...tasks.slice(0, 2).map((task) => ({ who: task.status === "done" ? "Task completed" : "Open task", what: task.title, when: task.due_date ? new Date(task.due_date).toLocaleDateString() : "unscheduled" })),
      ],
      notifications: [
        { title: `${tasks.filter((task) => task.status !== "done").length} open tasks`, body: "Your live planning board is tracking the next steps.", when: "live" },
        { title: `${rsvpCounts.pending + rsvpCounts.maybe} RSVP follow-ups`, body: "Guest responses update automatically as you add people.", when: "live" },
      ],
      timeline,
      decisions: [
        { title: "Planning priorities", options: Math.max(tasks.length, 1), votes: tasks.filter((task) => task.status === "done").length },
        { title: "Budget choices", options: Math.max(budget.length, 1), votes: budget.filter((item) => item.status === "paid").length },
      ],
    };
  }, [budget, budgetTotals.act, budgetTotals.est, countdown, event, guests.length, rsvpCounts.maybe, rsvpCounts.no, rsvpCounts.pending, rsvpCounts.yes, tasks]);

  async function handleDelete() {
    if (!event) return;
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) return toast.error(error.message);
    toast.success("Event deleted");
    navigate({ to: "/events" });
  }

  async function handleArchive() {
    if (!event) return;
    const { error } = await supabase.from("events").update({ status: "archived" }).eq("id", event.id);
    if (error) return toast.error(error.message);
    toast.success("Event archived");
    navigate({ to: "/events" });
  }

  if (event === undefined) {
    return (
      <AppShell active="/events">
        <div className="grid min-h-[40vh] place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }
  if (event === null) {
    return (
      <AppShell active="/events">
        <Card className="border-border/60 p-10 text-center shadow-soft">
          <h2 className="font-display text-xl font-semibold">Event not found</h2>
          <p className="mt-1 text-sm text-muted-foreground">It may have been deleted or you don't have access.</p>
          <Button asChild className="mt-4"><Link to="/events">Back to events</Link></Button>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell active="/events">
      <div className="space-y-6">
        <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All events
        </Link>

        <PageHeader
          eyebrow={event.event_type || "Event"}
          title={event.name}
          description={event.description || "Your planning workspace — everything in one place."}
          icon={PartyPopper}
          actions={
            <div className="flex flex-wrap gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">Archive</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archive this event?</AlertDialogTitle>
                    <AlertDialogDescription>You can restore it later from settings.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                    <AlertDialogDescription>This permanently removes the event and all its tasks, budget items, and guests. This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete permanently</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          }
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex w-full flex-wrap gap-1 sm:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="guests">Guests ({guests.length})</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            {dashboardData && (
              <div className="mb-6">
                <EventDashboardPreview data={dashboardData} />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Calendar} label="Countdown">
                {countdown === null ? "No date set" : countdown < 0 ? "Past" : `${countdown} day${countdown === 1 ? "" : "s"}`}
              </StatCard>
              <StatCard icon={ClipboardList} label="Task progress">
                {taskProgress}% <Progress value={taskProgress} className="mt-2" />
              </StatCard>
              <StatCard icon={Wallet} label="Budget used">
                ${budgetTotals.act.toLocaleString()}
                <p className="text-xs text-muted-foreground">of ${(event.budget_target ? Number(event.budget_target) : budgetTotals.est).toLocaleString()}</p>
              </StatCard>
              <StatCard icon={Users} label="Guests confirmed">
                {rsvpCounts.yes}
                <p className="text-xs text-muted-foreground">of {guests.length} invited</p>
              </StatCard>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Card className="border-border/60 p-5 shadow-soft">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">Upcoming tasks</h3>
                  <Button size="sm" variant="ghost" onClick={() => setTab("tasks")}>Open</Button>
                </div>
                {tasks.filter((t) => t.status !== "done").slice(0, 5).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open tasks. Add your first one from the Tasks tab.</p>
                ) : (
                  <ul className="space-y-2">
                    {tasks.filter((t) => t.status !== "done").slice(0, 5).map((t) => (
                      <li key={t.id} className="flex items-center gap-2 text-sm">
                        <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate">{t.title}</span>
                        {t.due_date && <span className="text-xs text-muted-foreground">{new Date(t.due_date).toLocaleDateString()}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="border-border/60 p-5 shadow-soft">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">RSVP snapshot</h3>
                  <Button size="sm" variant="ghost" onClick={() => setTab("guests")}>Open</Button>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(["yes", "maybe", "pending", "no"] as const).map((k) => (
                    <div key={k} className="rounded-lg border border-border/60 p-3">
                      <div className="text-xl font-semibold">{rsvpCounts[k]}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <TasksTab eventId={eventId} tasks={tasks} reload={reload} />
          </TabsContent>
          <TabsContent value="budget" className="mt-6">
            <BudgetTab eventId={eventId} items={budget} totals={budgetTotals} target={event.budget_target ? Number(event.budget_target) : null} reload={reload} />
          </TabsContent>
          <TabsContent value="guests" className="mt-6">
            <GuestsTab eventId={eventId} guests={guests} reload={reload} />
          </TabsContent>
          <TabsContent value="details" className="mt-6">
            <DetailsTab event={event} onSaved={reload} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/60 p-4 shadow-soft">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="font-display text-2xl font-semibold">{children}</div>
    </Card>
  );
}

// ============= TASKS =============
function TasksTab({ eventId, tasks, reload }: { eventId: string; tasks: Task[]; reload: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [dueDate, setDueDate] = useState("");
  const [filter, setFilter] = useState<"all" | Task["status"]>("all");
  const [busy, setBusy] = useState(false);

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const t = z.string().trim().min(1).max(200).parse(title);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("tasks").insert({
        event_id: eventId,
        title: t,
        priority,
        due_date: dueDate || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      setTitle(""); setDueDate("");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add task");
    } finally { setBusy(false); }
  }

  async function toggleTask(t: Task) {
    const next = t.status === "done" ? "todo" : "done";
    const { error } = await supabase.from("tasks").update({
      status: next,
      completed_at: next === "done" ? new Date().toISOString() : null,
    }).eq("id", t.id);
    if (error) return toast.error(error.message);
    await reload();
  }

  async function removeTask(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await reload();
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60 p-4 shadow-soft">
        <form onSubmit={addTask} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <Input placeholder="Add a task…" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
            <SelectTrigger className="sm:w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="sm:w-40" />
          <Button type="submit" disabled={busy} className="gap-1.5"><Plus className="h-4 w-4" /> Add</Button>
        </form>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {(["all", "todo", "in_progress", "done"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
            {f.replace("_", " ")}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="border-border/60 p-10 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">No tasks yet. Add one above.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <Card key={t.id} className="flex items-center gap-3 border-border/60 p-3 shadow-soft">
              <button onClick={() => toggleTask(t)} aria-label={t.status === "done" ? "Mark incomplete" : "Mark done"}>
                {t.status === "done"
                  ? <Check className="h-5 w-5 text-primary" />
                  : <Circle className="h-5 w-5 text-muted-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="capitalize">{t.priority}</Badge>
                  {t.due_date && <span>Due {new Date(t.due_date).toLocaleDateString()}</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeTask(t.id)} aria-label="Delete task">
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============= BUDGET =============
function BudgetTab({ eventId, items, totals, target, reload }: {
  eventId: string; items: BudgetItem[]; totals: { est: number; act: number; paid: number }; target: number | null; reload: () => Promise<void>;
}) {
  const [category, setCategory] = useState("Venue");
  const [label, setLabel] = useState("");
  const [estimated, setEstimated] = useState("");
  const [actual, setActual] = useState("");
  const [paid, setPaid] = useState("");
  const [busy, setBusy] = useState(false);

  const over = target !== null && totals.act > target;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const lbl = z.string().trim().min(1).max(120).parse(label);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("budget_items").insert({
        event_id: eventId,
        category,
        label: lbl,
        estimated_amount: estimated ? Number(estimated) : 0,
        actual_amount: actual ? Number(actual) : 0,
        paid_amount: paid ? Number(paid) : 0,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      setLabel(""); setEstimated(""); setActual(""); setPaid("");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add item");
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("budget_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Wallet} label="Estimated">${totals.est.toLocaleString()}</StatCard>
        <StatCard icon={Wallet} label="Actual">${totals.act.toLocaleString()}</StatCard>
        <StatCard icon={Wallet} label="Paid">${totals.paid.toLocaleString()}</StatCard>
      </div>
      {over && (
        <Card className="border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Heads up — actual spend has passed your ${target?.toLocaleString()} target by ${(totals.act - (target ?? 0)).toLocaleString()}.
        </Card>
      )}

      <Card className="border-border/60 p-4 shadow-soft">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-6">
          <Input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="sm:col-span-1" />
          <Input placeholder="What is this?" value={label} onChange={(e) => setLabel(e.target.value)} required className="sm:col-span-2" />
          <Input type="number" min="0" step="0.01" placeholder="Est." value={estimated} onChange={(e) => setEstimated(e.target.value)} />
          <Input type="number" min="0" step="0.01" placeholder="Actual" value={actual} onChange={(e) => setActual(e.target.value)} />
          <div className="flex gap-2">
            <Input type="number" min="0" step="0.01" placeholder="Paid" value={paid} onChange={(e) => setPaid(e.target.value)} />
            <Button type="submit" disabled={busy} size="icon" aria-label="Add"><Plus className="h-4 w-4" /></Button>
          </div>
        </form>
      </Card>

      {items.length === 0 ? (
        <Card className="border-border/60 p-10 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">No budget items yet. Add categories like Venue, Catering, Photography.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/60 shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-right">Estimated</th>
                  <th className="px-3 py-2 text-right">Actual</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-border/60">
                    <td className="px-3 py-2">{it.category}</td>
                    <td className="px-3 py-2">{it.label}</td>
                    <td className="px-3 py-2 text-right">${Number(it.estimated_amount).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">${Number(it.actual_amount).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">${Number(it.paid_amount).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(it.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============= GUESTS =============
function GuestsTab({ eventId, guests, reload }: { eventId: string; guests: Guest[]; reload: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [household, setHousehold] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const n = z.string().trim().min(1).max(120).parse(name);
      const em = email ? z.string().trim().email().parse(email) : null;
      const { error } = await supabase.from("guests").insert({
        event_id: eventId,
        full_name: n,
        email: em,
        household: household || null,
      });
      if (error) throw error;
      setName(""); setEmail(""); setHousehold("");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add guest");
    } finally { setBusy(false); }
  }

  async function updateRsvp(id: string, rsvp: Guest["rsvp_status"]) {
    const { error } = await supabase.from("guests").update({ rsvp_status: rsvp }).eq("id", id);
    if (error) return toast.error(error.message);
    await reload();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("guests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await reload();
  }

  function exportCsv() {
    const rows = [["Name", "Email", "Household", "RSVP", "Plus ones", "Meal"]];
    guests.forEach((g) => rows.push([g.full_name, g.email ?? "", g.household ?? "", g.rsvp_status, String(g.plus_ones), g.meal_choice ?? ""]));
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "guests.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60 p-4 shadow-soft">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-4">
          <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input placeholder="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Household" value={household} onChange={(e) => setHousehold(e.target.value)} />
          <Button type="submit" disabled={busy} className="gap-1.5"><Plus className="h-4 w-4" /> Add guest</Button>
        </form>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={guests.length === 0}>Export CSV</Button>
      </div>

      {guests.length === 0 ? (
        <Card className="border-border/60 p-10 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">No guests yet.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/60 shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Guest</th>
                  <th className="px-3 py-2 text-left">Contact</th>
                  <th className="px-3 py-2 text-left">Household</th>
                  <th className="px-3 py-2 text-left">RSVP</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => (
                  <tr key={g.id} className="border-t border-border/60">
                    <td className="px-3 py-2 font-medium">{g.full_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{g.email || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{g.household || "—"}</td>
                    <td className="px-3 py-2">
                      <Select value={g.rsvp_status} onValueChange={(v) => updateRsvp(g.id, v as Guest["rsvp_status"])}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="maybe">Maybe</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(g.id)} aria-label="Delete guest"><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============= DETAILS (edit) =============
function DetailsTab({ event, onSaved }: { event: Event; onSaved: () => Promise<void> }) {
  const [f, setF] = useState({
    name: event.name,
    type: event.event_type ?? "",
    date: event.event_date ?? "",
    time: event.event_time ?? "",
    location: event.location ?? "",
    guest_target: event.guest_target?.toString() ?? "",
    budget_target: event.budget_target?.toString() ?? "",
    description: event.description ?? "",
  });
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const name = z.string().trim().min(1).max(120).parse(f.name);
      const { error } = await supabase.from("events").update({
        name,
        event_type: f.type || null,
        event_date: f.date || null,
        event_time: f.time || null,
        location: f.location || null,
        guest_target: f.guest_target ? parseInt(f.guest_target, 10) : null,
        budget_target: f.budget_target ? Number(f.budget_target) : null,
        description: f.description || null,
      }).eq("id", event.id);
      if (error) throw error;
      toast.success("Event updated");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally { setBusy(false); }
  }

  return (
    <Card className="border-border/60 p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Pencil className="h-4 w-4 text-primary" />
        <h3 className="font-display text-lg font-semibold">Edit event details</h3>
      </div>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-1.5"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Type</Label><Input value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Location</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Time</Label><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Guest target</Label><Input type="number" min="0" value={f.guest_target} onChange={(e) => setF({ ...f, guest_target: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Budget target ($)</Label><Input type="number" min="0" value={f.budget_target} onChange={(e) => setF({ ...f, budget_target: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Vision</Label><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="flex justify-end">
          <Button type="submit" disabled={busy} className="gap-1.5"><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save changes"}</Button>
        </div>
      </form>
    </Card>
  );
}
