import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft, AlertTriangle, Calendar, Wallet, Trash2, Plus, Check, Circle,
  Loader2, Sparkles, Save, Pencil, Upload, Download, Mail,
  Globe, Copy, Eye, EyeOff, X, Gift,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { EventOverview } from "@/components/event-overview";
import { TicketsTab, TicketingTeaser } from "@/components/tickets-tab";
import { FeatureGate } from "@/components/feature-gate";
import { RunsheetTab } from "@/components/runsheet-tab";
import { VendorNeedsTab } from "@/components/vendor-needs-tab";
import { ShoppingListTab } from "@/components/shopping-list-tab";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { parseCurrency } from "@/lib/parse-currency";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapEventPlan } from "@/lib/event-bootstrap.functions";
import { checkBudgetWarning, fireRsvpBatch } from "@/lib/event-notifications.functions";
import { updatePublicPageSettings } from "@/lib/public-event.functions";
import { Switch } from "@/components/ui/switch";
import { MessageComposer, CommunicationsHistory } from "@/components/message-composer";
import { PostEventRecap } from "@/components/post-event-recap";
import { EventExports } from "@/components/event-exports";
import { listEventCommunications, duplicatePlannerEvent } from "@/lib/event-comms.functions";
import { useAuth } from "@/lib/auth";
import { InvitationComposer } from "@/components/invitation-composer";
import { PremiumUpgradeGate } from "@/components/premium-upgrade-gate";
import { useFeatureGate } from "@/hooks/use-feature-gate";

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
  const [comms, setComms] = useState<Awaited<ReturnType<ReturnType<typeof useServerFn<typeof listEventCommunications>>>> >([]);
  const [commsLoaded, setCommsLoaded] = useState(false);
  const listCommsFn = useServerFn(listEventCommunications);
  const duplicateFn = useServerFn(duplicatePlannerEvent);
  const { allowed: communicationsAllowed } = useFeatureGate("communication_tools");

  async function reload() {
    const [ev, t, b, g] = await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).is("deleted_at", null).maybeSingle(),
      supabase.from("tasks").select("*").eq("event_id", eventId).is("deleted_at", null).order("created_at"),
      supabase.from("budget_items").select("*").eq("event_id", eventId).is("deleted_at", null).order("created_at"),
      supabase.from("guests").select("*").eq("event_id", eventId).is("deleted_at", null).order("created_at"),
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

  const budgetTotals = useMemo(() => {
    const est = budget.reduce((s, b) => s + Number(b.estimated_amount), 0);
    const act = budget.reduce((s, b) => s + Number(b.actual_amount), 0);
    const paid = budget.reduce((s, b) => s + Number(b.paid_amount), 0);
    return { est, act, paid };
  }, [budget]);

  const isRecapVisible = useMemo(() => {
    if (!event) return false;
    if (event.status === "completed") return true;
    if (!event.event_date) return false;
    return (Date.now() - new Date(event.event_date).getTime()) > 24 * 60 * 60 * 1000;
  }, [event]);


  async function handleDelete() {
    if (!event) return;
    const { error } = await supabase
      .from("events")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", event.id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Moved to Trash", { description: "You can restore it within 30 days." });
    navigate({ to: "/events" });
  }

  async function handleArchive() {
    if (!event) return;
    const { error } = await supabase.from("events").update({ status: "archived" }).eq("id", event.id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Event archived");
    navigate({ to: "/events" });
  }

  async function handleDuplicate() {
    if (!event) return;
    try {
      const result = await duplicateFn({ data: { eventId } });
      toast.success(`"${result.name}" created — update the date and name to finish setup.`);
      navigate({ to: `/events/${result.newEventId}` as never });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not duplicate event");
    }
  }

  async function loadComms() {
    if (commsLoaded || !communicationsAllowed) return;
    try {
      const rows = await listCommsFn({ data: { eventId } });
      setComms(rows);
      setCommsLoaded(true);
    } catch (_) { /* silent */ }
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

        <Tabs value={tab} onValueChange={setTab}>
          <div className="sm:hidden">
            <Label htmlFor="event-section" className="sr-only">Event section</Label>
            <Select value={tab} onValueChange={(value) => {
              setTab(value);
              if (value === "communicate") void loadComms();
            }}>
              <SelectTrigger id="event-section" className="h-11 w-full font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                <SelectItem value="tickets">Tickets</SelectItem>
                <SelectItem value="tasks">Tasks{tasks.length > 0 ? ` (${tasks.length})` : ""}</SelectItem>
                <SelectItem value="budget">Budget</SelectItem>
                <SelectItem value="guests">Guests{guests.length > 0 ? ` (${guests.length})` : ""}</SelectItem>
                <SelectItem value="runsheet">Runsheet</SelectItem>
                <SelectItem value="vendors">Vendors</SelectItem>
                <SelectItem value="shopping">Shopping</SelectItem>
                <SelectItem value="invitations">Invitations</SelectItem>
                <SelectItem value="communicate">Communicate</SelectItem>
                {isRecapVisible && <SelectItem value="recap">Recap</SelectItem>}
                <SelectItem value="details">Details</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TabsList className="hidden h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto p-1 sm:flex">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tickets" className="font-semibold">Tickets</TabsTrigger>
            <TabsTrigger value="tasks">Tasks{tasks.length > 0 ? ` (${tasks.length})` : ""}</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="guests">Guests{guests.length > 0 ? ` (${guests.length})` : ""}</TabsTrigger>
            <TabsTrigger value="runsheet">Runsheet</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="shopping">Shopping</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
            <TabsTrigger value="communicate" onClick={loadComms}>Communicate</TabsTrigger>
            {isRecapVisible && <TabsTrigger value="recap">Recap</TabsTrigger>}
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <EventOverview
              event={event}
              tasks={tasks}
              budget={budget}
              guests={guests}
              onOpenTab={setTab}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          </TabsContent>


          <TabsContent value="tasks" className="mt-6">
            <TasksTab eventId={eventId} tasks={tasks} reload={reload} />
          </TabsContent>
          <TabsContent value="budget" className="mt-6">
            <BudgetTab eventId={eventId} items={budget} totals={budgetTotals} target={event.budget_target ? Number(event.budget_target) : null} reload={reload} />
          </TabsContent>
          <TabsContent value="guests" className="mt-6">
            <GuestsTab eventId={eventId} eventName={event.name} guests={guests} reload={reload} />
          </TabsContent>
          <TabsContent value="runsheet" className="mt-6">
            <RunsheetTab eventId={eventId} />
          </TabsContent>
          <TabsContent value="vendors" className="mt-6">
            <VendorNeedsTab eventId={eventId} />
          </TabsContent>
          <TabsContent value="shopping" className="mt-6">
            <ShoppingListTab eventId={eventId} />
          </TabsContent>
          <TabsContent value="tickets" className="mt-6">
            <FeatureGate feature="ticketing" fallback={(onUpgrade) => <TicketingTeaser onUpgrade={onUpgrade} />}>
              <TicketsTab
                eventId={eventId}
                ticketsEnabled={event.tickets_enabled ?? false}
                onEventUpdated={reload}
              />
            </FeatureGate>
          </TabsContent>
          <TabsContent value="invitations" className="mt-6">
            <InvitationsTab event={event} guests={guests} onSaved={reload} />
          </TabsContent>
          <TabsContent value="communicate" className="mt-6">
            <PremiumUpgradeGate feature="communication_tools">
            <CommunicateTabContent
              eventId={eventId}
              eventName={event.name}
              comms={comms}
              commsLoaded={commsLoaded}
              onMessageSent={async () => {
                const rows = await listCommsFn({ data: { eventId } });
                setComms(rows);
                setCommsLoaded(true);
              }}
            />
            </PremiumUpgradeGate>
          </TabsContent>
          {isRecapVisible && (
            <TabsContent value="recap" className="mt-6 space-y-6">
              <PostEventRecap eventId={eventId} onDuplicate={handleDuplicate} />
              <EventExports eventId={eventId} eventName={event.name} guests={guests} budget={budget} />
            </TabsContent>
          )}
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


// --- TASKS ---
function TasksTab({ eventId, tasks, reload }: { eventId: string; tasks: Task[]; reload: () => Promise<void> }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [dueDate, setDueDate] = useState("");
  const [filter, setFilter] = useState<"all" | Task["status"]>("all");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const t = z.string().trim().min(1).max(200).parse(title);
      const { error } = await supabase.from("tasks").insert({
        event_id: eventId,
        title: t,
        priority,
        due_date: dueDate || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      setTitle(""); setDueDate("");
      toast.success("Task added");
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
    const { error } = await supabase
      .from("tasks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Task removed");
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
              <Button variant="ghost" size="icon" onClick={() => setPendingDelete(t)} aria-label="Delete task">
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        destructive
        title="Delete this task?"
        description={
          <>
            <p>&ldquo;{pendingDelete?.title}&rdquo; will be removed from your task list.</p>
            <p className="mt-1 text-xs text-muted-foreground">You can undo this by asking MelaAssist to re-add it.</p>
          </>
        }
        confirmLabel="Delete task"
        onConfirm={async () => { if (pendingDelete) await removeTask(pendingDelete.id); }}
      />
    </div>
  );
}

// --- BUDGET ---
function BudgetTab({ eventId, items, totals, target, reload }: {
  eventId: string; items: BudgetItem[]; totals: { est: number; act: number; paid: number }; target: number | null; reload: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [category, setCategory] = useState("");
  const [label, setLabel] = useState("");
  const [estimated, setEstimated] = useState("");
  const [actual, setActual] = useState("");
  const [paid, setPaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BudgetItem | null>(null);
  const [editItem, setEditItem] = useState<BudgetItem | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editBudgetOpen, setEditBudgetOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  const checkBudgetFn = useServerFn(checkBudgetWarning);

  // over-budget = committed (estimated) exceeds ceiling, not actual spend
  const over = target !== null && totals.est > target;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const lbl = z.string().trim().min(1).max(120).parse(label);
      // Over-budget pre-save warning (#12)
      const newEst = parseCurrency(estimated) ?? 0;
      if (target !== null && target > 0 && (totals.est + newEst) > target) {
        toast.warning(`This item will push your committed total $${((totals.est + newEst) - target).toLocaleString()} over your $${target.toLocaleString()} budget target.`);
      }
      const { error } = await supabase.from("budget_items").insert({
        event_id: eventId,
        category,
        label: lbl,
        estimated_amount: parseCurrency(estimated) ?? 0,
        actual_amount: parseCurrency(actual) ?? 0,
        paid_amount: parseCurrency(paid) ?? 0,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      setLabel(""); setEstimated(""); setActual(""); setPaid("");
      toast.success("Budget item added");
      await reload();
      // Fire budget-warning notification if threshold crossed (fire-and-forget)
      checkBudgetFn({ data: { eventId } }).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add item");
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("budget_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Budget item removed");
    await reload();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setEditBusy(true);
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const { error } = await supabase.from("budget_items").update({
      category: (fd.get("category") as string) || undefined,
      label: fd.get("label") as string,
      estimated_amount: parseCurrency(fd.get("estimated") as string) ?? 0,
      actual_amount: parseCurrency(fd.get("actual") as string) ?? 0,
      paid_amount: parseCurrency(fd.get("paid") as string) ?? 0,
    }).eq("id", editItem.id);
    setEditBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Budget item updated");
    setEditItem(null);
    await reload();
    // Fire budget-warning notification if threshold crossed by the edit (fire-and-forget)
    checkBudgetFn({ data: { eventId } }).catch(() => {});
  }

  const budgetTarget = target ?? totals.est;
  const remaining = Math.max(0, budgetTarget - totals.est);
  const plannedPct = budgetTarget > 0 ? Math.min(100, Math.round((totals.est / budgetTarget) * 100)) : 0;

  function exportCsv() {
    const rows = [["Category", "Description", "Budgeted", "Spent", "Paid"]];
    items.forEach((it) =>
      rows.push([
        it.category ?? "",
        it.label ?? "",
        String(Number(it.estimated_amount) || 0),
        String(Number(it.actual_amount) || 0),
        String(Number(it.paid_amount) || 0),
      ])
    );
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "budget.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function scrollToForm() {
    document.getElementById("budget-add-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("budget-add-category")?.focus();
  }

  async function saveBudgetTarget() {
    const val = parseCurrency(budgetInput);
    if (val === null) { toast.error("Enter a valid amount"); return; }
    setSavingBudget(true);
    const { error } = await supabase.from("events").update({ budget_target: val }).eq("id", eventId);
    setSavingBudget(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Budget target updated");
    setEditBudgetOpen(false);
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Budget card with inline edit (#11) */}
        <Card className="border-border/60 p-4 shadow-soft">
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
            <div className="flex items-center gap-2"><Wallet className="h-3.5 w-3.5" aria-hidden="true" /> Budget</div>
            <button
              onClick={() => { setBudgetInput(String(budgetTarget)); setEditBudgetOpen(true); }}
              className="rounded p-0.5 hover:bg-muted transition"
              aria-label="Edit budget target"
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
          <div className="font-display text-2xl font-semibold">${budgetTarget.toLocaleString()}</div>
        </Card>
        <StatCard icon={Wallet} label="Planned">${totals.est.toLocaleString()}</StatCard>
        <StatCard icon={Wallet} label="Paid to date">${totals.paid.toLocaleString()}</StatCard>
        <StatCard icon={Wallet} label="Remaining">${remaining.toLocaleString()}</StatCard>
      </div>

      <Card className="border-border/60 p-4 shadow-soft">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Budget used</span>
          <span>{plannedPct}% of ${budgetTarget.toLocaleString()} planned</span>
        </div>
        <Progress value={plannedPct} className={over ? "[&>div]:bg-destructive" : ""} />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Budget ${budgetTarget.toLocaleString()}</span>
          <span>Planned ${totals.est.toLocaleString()}</span>
          <span>Paid ${totals.paid.toLocaleString()}</span>
          <span>Remaining ${remaining.toLocaleString()}</span>
        </div>
      </Card>

      {over && (
        <Card className="border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Over budget — planned expenses of ${totals.est.toLocaleString()} exceed the ${target?.toLocaleString()} target by ${(totals.est - (target ?? 0)).toLocaleString()}.</span>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={scrollToForm} className="gap-1.5"><Plus className="h-4 w-4" /> Add Budget Item</Button>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={items.length === 0} className="gap-1.5"><Download className="h-4 w-4" /> Export CSV</Button>
      </div>

      <Card id="budget-add-form" className="border-border/60 p-4 shadow-soft">
        <form onSubmit={add} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="budget-add-category" className="text-xs">Category</Label>
              <Input id="budget-add-category" placeholder="e.g. Venue" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-add-label" className="text-xs">Description</Label>
              <Input id="budget-add-label" placeholder="e.g. Ballroom deposit" value={label} onChange={(e) => setLabel(e.target.value)} required />
            </div>
          </div>
          <div className="grid gap-3 grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="budget-add-est" className="text-xs">Budgeted</Label>
              <Input id="budget-add-est" type="text" inputMode="decimal" placeholder="0" value={estimated} onChange={(e) => setEstimated(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-add-act" className="text-xs">Spent</Label>
              <Input id="budget-add-act" type="text" inputMode="decimal" placeholder="0" value={actual} onChange={(e) => setActual(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-add-paid" className="text-xs">Paid</Label>
              <Input id="budget-add-paid" type="text" inputMode="decimal" placeholder="0" value={paid} onChange={(e) => setPaid(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy} className="gap-1.5"><Plus className="h-4 w-4" /> Add Budget Item</Button>
          </div>
        </form>
      </Card>

      {items.length === 0 ? (
        <Card className="border-border/60 p-10 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">No budget items yet. Add categories like Venue, Catering, Photography.</p>
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {items.map((it) => (
              <Card key={it.id} className="border-border/60 p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {it.category && <p className="text-xs text-muted-foreground">{it.category}</p>}
                    <p className="font-medium leading-tight">{it.label}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditItem(it)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPendingDelete(it)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-muted-foreground">Budgeted</p><p className="font-medium">${Number(it.estimated_amount).toLocaleString()}</p></div>
                  <div><p className="text-muted-foreground">Spent</p><p className="font-medium">${Number(it.actual_amount).toLocaleString()}</p></div>
                  <div><p className="text-muted-foreground">Paid</p><p className="font-medium">${Number(it.paid_amount).toLocaleString()}</p></div>
                </div>
              </Card>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block">
            <Card className="overflow-hidden border-border/60 shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">Budgeted</th>
                      <th className="px-3 py-2 text-right">Spent</th>
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
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditItem(it)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setPendingDelete(it)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        destructive
        title="Delete this budget item?"
        description={<p>&ldquo;{pendingDelete?.label}&rdquo; will be removed from your budget.</p>}
        confirmLabel="Delete item"
        onConfirm={async () => { if (pendingDelete) await remove(pendingDelete.id); }}
      />

      {editItem && (
        <Dialog open onOpenChange={(v) => !v && setEditItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Edit budget item</DialogTitle></DialogHeader>
            <form onSubmit={saveEdit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bi-cat" className="text-xs">Category</Label>
                  <Input id="bi-cat" name="category" defaultValue={editItem.category ?? ""} placeholder="e.g. Venue" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bi-lbl" className="text-xs">Description</Label>
                  <Input id="bi-lbl" name="label" defaultValue={editItem.label ?? ""} required placeholder="e.g. Ballroom deposit" />
                </div>
              </div>
              <div className="grid gap-3 grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bi-est" className="text-xs">Budgeted</Label>
                  <Input id="bi-est" name="estimated" type="text" inputMode="decimal" defaultValue={Number(editItem.estimated_amount)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bi-act" className="text-xs">Spent</Label>
                  <Input id="bi-act" name="actual" type="text" inputMode="decimal" defaultValue={Number(editItem.actual_amount)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bi-paid" className="text-xs">Paid</Label>
                  <Input id="bi-paid" name="paid" type="text" inputMode="decimal" defaultValue={Number(editItem.paid_amount)} />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
                <Button type="submit" disabled={editBusy} className="gap-1.5">
                  {editBusy && <Loader2 className="h-4 w-4 animate-spin" />}Save changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit budget target dialog (#11) */}
      <Dialog open={editBudgetOpen} onOpenChange={(v) => { if (!savingBudget) setEditBudgetOpen(v); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Edit budget target</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="ev-budget-input">Total budget ($)</Label>
            <Input id="ev-budget-input" type="text" inputMode="decimal" placeholder="e.g. 50000" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} autoFocus />
            <p className="text-xs text-muted-foreground">Your total spending goal. Add expenses below to see how much remains.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBudgetOpen(false)} disabled={savingBudget}>Cancel</Button>
            <Button onClick={saveBudgetTarget} disabled={savingBudget || !budgetInput} className="gap-1.5">
              {savingBudget && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- GUESTS ---
function GuestsTab({ eventId, eventName, guests, reload }: { eventId: string; eventName: string; guests: Guest[]; reload: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [household, setHousehold] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Guest | null>(null);
  const [editGuest, setEditGuest] = useState<Guest | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [invitationsOpen, setInvitationsOpen] = useState(false);

  const fireRsvpFn = useServerFn(fireRsvpBatch);

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
      toast.success("Guest added");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add guest");
    } finally { setBusy(false); }
  }

  async function updateRsvp(id: string, rsvp: Guest["rsvp_status"]) {
    const { error } = await supabase.from("guests").update({ rsvp_status: rsvp }).eq("id", id);
    if (error) return toast.error(error.message);
    await reload();
    // Batch-notify the planner about RSVP activity (fire-and-forget)
    if (rsvp === "yes" || rsvp === "no") {
      fireRsvpFn({ data: { eventId } }).catch(() => {});
    }
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("guests")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Guest removed");
    await reload();
  }

  async function saveGuestEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editGuest) return;
    setEditBusy(true);
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const { error } = await supabase.from("guests").update({
      full_name: fd.get("full_name") as string,
      email: (fd.get("email") as string) || null,
      household: (fd.get("household") as string) || null,
      rsvp_status: fd.get("rsvp") as Guest["rsvp_status"],
      plus_ones: parseInt(fd.get("plus_ones") as string, 10) || 0,
      meal_choice: (fd.get("meal_choice") as string) || null,
    }).eq("id", editGuest.id);
    setEditBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Guest updated");
    setEditGuest(null);
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
        <form onSubmit={add} className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input placeholder="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Household" value={household} onChange={(e) => setHousehold(e.target.value)} />
          <Button type="submit" disabled={busy} className="gap-1.5"><Plus className="h-4 w-4" /> Add guest</Button>
        </form>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" className="gap-1.5" onClick={() => setInvitationsOpen(true)} disabled={!guests.some((guest) => guest.email)}>
          <Mail className="h-4 w-4" /> Send invitations
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={guests.length === 0}>Export CSV</Button>
      </div>

      {guests.length === 0 ? (
        <Card className="border-border/60 p-10 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">No guests yet.</p>
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {guests.map((g) => (
              <Card key={g.id} className="border-border/60 p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setEditGuest(g)}
                      className="font-medium text-left hover:text-primary hover:underline transition-colors"
                    >
                      {g.full_name}
                    </button>
                    {g.email && <p className="text-xs text-muted-foreground truncate">{g.email}</p>}
                    {g.household && <p className="text-xs text-muted-foreground">{g.household}</p>}
                    {g.invited_at && <p className="mt-1 text-xs text-emerald-700">Invited {new Date(g.invited_at).toLocaleDateString()}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditGuest(g)} aria-label="Edit guest"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPendingDelete(g)} aria-label="Delete guest"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="mt-2">
                  <Select value={g.rsvp_status} onValueChange={(v) => updateRsvp(g.id, v as Guest["rsvp_status"])}>
                    <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="maybe">Maybe</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Card>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block">
            <Card className="overflow-hidden border-border/60 shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Guest</th>
                      <th className="px-3 py-2 text-left">Contact</th>
                      <th className="px-3 py-2 text-left">Household</th>
                      <th className="px-3 py-2 text-left">RSVP</th>
                      <th className="px-3 py-2 text-left">Invitation</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {guests.map((g) => (
                      <tr key={g.id} className="border-t border-border/60">
                        <td className="px-3 py-2 font-medium">
                          <button
                            type="button"
                            onClick={() => setEditGuest(g)}
                            className="text-left hover:text-primary hover:underline transition-colors"
                          >
                            {g.full_name}
                          </button>
                        </td>
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
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {g.invited_at ? new Date(g.invited_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Not sent"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditGuest(g)} aria-label="Edit guest"><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setPendingDelete(g)} aria-label="Delete guest"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}

      <InvitationComposer open={invitationsOpen} onClose={() => setInvitationsOpen(false)} eventId={eventId} eventName={eventName} guests={guests} onSent={reload} />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        destructive
        title="Remove this guest?"
        description={<p>&ldquo;{pendingDelete?.full_name}&rdquo; will be removed from your guest list.</p>}
        confirmLabel="Remove guest"
        onConfirm={async () => { if (pendingDelete) await remove(pendingDelete.id); }}
      />

      {editGuest && (
        <Dialog open onOpenChange={(v) => !v && setEditGuest(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Edit guest</DialogTitle></DialogHeader>
            <form onSubmit={saveGuestEdit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="eg-name">Full name</Label>
                <Input id="eg-name" name="full_name" defaultValue={editGuest.full_name} required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="eg-email">Email</Label>
                  <Input id="eg-email" name="email" type="email" defaultValue={editGuest.email ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="eg-household">Household / Group</Label>
                  <Input id="eg-household" name="household" defaultValue={editGuest.household ?? ""} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="eg-rsvp">RSVP status</Label>
                  <Select name="rsvp" defaultValue={editGuest.rsvp_status ?? "pending"}>
                    <SelectTrigger id="eg-rsvp"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="yes">Attending</SelectItem>
                      <SelectItem value="maybe">Maybe</SelectItem>
                      <SelectItem value="no">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="eg-plus">Plus-ones</Label>
                  <Input id="eg-plus" name="plus_ones" type="number" min="0" max="10" defaultValue={editGuest.plus_ones ?? 0} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eg-meal">Meal choice</Label>
                <Input id="eg-meal" name="meal_choice" defaultValue={editGuest.meal_choice ?? ""} placeholder="e.g. Vegetarian" />
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setEditGuest(null)}>Cancel</Button>
                <Button type="submit" disabled={editBusy} className="gap-1.5">
                  {editBusy && <Loader2 className="h-4 w-4 animate-spin" />}Save changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// --- DETAILS (edit) ---
function DetailsTab({ event, onSaved }: { event: Event; onSaved: () => Promise<void> }) {
  const [f, setF] = useState({
    name: event.name,
    type: event.event_type ?? "",
    date: event.event_date ?? "",
    time: event.event_time ?? "",
    end_time: event.end_time ?? "",
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
      if (f.time && f.end_time && f.end_time <= f.time) {
        throw new Error("Event end time must be after the start time");
      }
      const { error } = await supabase.from("events").update({
        name,
        event_type: f.type || null,
        event_date: f.date || null,
        event_time: f.time || null,
        end_time: f.end_time || null,
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
    <div className="space-y-6">
      <Card className="border-border/60 p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <Pencil className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg font-semibold">Edit event details</h3>
        </div>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Type</Label><Input value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Event location</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Venue, address, or city" /></div>
            <div className="space-y-1.5"><Label>Event date</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Start time</Label><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>End time</Label><Input type="time" min={f.time || undefined} value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Expected guests</Label><Input type="number" min="0" value={f.guest_target} onChange={(e) => setF({ ...f, guest_target: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Budget target ($)</Label><Input type="number" min="0" value={f.budget_target} onChange={(e) => setF({ ...f, budget_target: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Vision</Label><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy} className="gap-1.5"><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </Card>

      <PublicPageSection event={event} onSaved={onSaved} />
    </div>
  );
}

// --- PUBLIC PAGE SECTION ---
function PublicPageSection({ event, onSaved }: { event: Event; onSaved: () => Promise<void> }) {
  // New columns don't exist on the generated Event type yet — read via unknown cast
  const ev = event as unknown as Record<string, unknown>;

  const [published, setPublished] = useState<boolean>((ev.is_published as boolean) ?? false);
  const [publicDesc, setPublicDesc] = useState<string>((ev.public_description as string) ?? "");
  const [giftUrl, setGiftUrl] = useState<string>((ev.gift_registry_url as string) ?? "");
  const [showSchedule, setShowSchedule] = useState<boolean>((ev.show_schedule_public as boolean) ?? true);
  const [showRsvp, setShowRsvp] = useState<boolean>((ev.show_rsvp_public as boolean) ?? true);
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>(
    Array.isArray(ev.public_faqs)
      ? (ev.public_faqs as { q: string; a: string }[])
      : [],
  );
  const [saving, setSaving] = useState(false);
  const updateFn = useServerFn(updatePublicPageSettings);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/e/${event.id}`
    : `/e/${event.id}`;

  async function save(patch: Partial<{
    is_published: boolean; public_description: string; gift_registry_url: string;
    show_schedule_public: boolean; show_rsvp_public: boolean;
    public_faqs: { q: string; a: string }[];
  }>) {
    setSaving(true);
    try {
      await updateFn({ data: { eventId: event.id, ...patch } });
      toast.success("Public page updated");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally { setSaving(false); }
  }

  async function handleTogglePublish(v: boolean) {
    setPublished(v);
    await save({ is_published: v });
  }

  async function handleSaveContent(e: React.FormEvent) {
    e.preventDefault();
    await save({
      public_description: publicDesc,
      gift_registry_url: giftUrl,
      show_schedule_public: showSchedule,
      show_rsvp_public: showRsvp,
      public_faqs: faqs,
    });
  }

  function addFaq() { setFaqs([...faqs, { q: "", a: "" }]); }
  function removeFaq(i: number) { setFaqs(faqs.filter((_, idx) => idx !== i)); }
  function updateFaq(i: number, field: "q" | "a", value: string) {
    setFaqs(faqs.map((faq, idx) => idx === i ? { ...faq, [field]: value } : faq));
  }

  return (
    <Card className="border-border/60 p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Globe className="h-4 w-4 text-primary" />
        <h3 className="font-display text-lg font-semibold">Public event page</h3>
      </div>

      {/* Publish toggle */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-4">
        <div>
          <p className="font-medium text-sm">
            {published ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Eye className="h-4 w-4" /> Published
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <EyeOff className="h-4 w-4" /> Draft — not visible to guests
              </span>
            )}
          </p>
          {published && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-xs">{shareUrl}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {published && (
            <Button
              type="button" size="sm" variant="outline"
              onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Link copied!"); }}
              className="gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> Copy link
            </Button>
          )}
          <Switch checked={published} onCheckedChange={handleTogglePublish} aria-label="Toggle publish" />
        </div>
      </div>

      {/* Content form */}
      <form onSubmit={handleSaveContent} className="space-y-5">
        <div className="space-y-1.5">
          <Label>Public description <span className="text-xs text-muted-foreground">(optional — shows instead of internal vision)</span></Label>
          <Textarea rows={3} placeholder="A short description guests will see on your event page…" value={publicDesc} onChange={(e) => setPublicDesc(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label className="inline-flex items-center gap-1.5"><Gift className="h-3.5 w-3.5" /> Gift registry URL <span className="text-xs text-muted-foreground">(optional)</span></Label>
          <Input type="url" placeholder="https://registry.example.com/your-list" value={giftUrl} onChange={(e) => setGiftUrl(e.target.value)} />
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Switch checked={showSchedule} onCheckedChange={setShowSchedule} />
            Show schedule to guests
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Switch checked={showRsvp} onCheckedChange={setShowRsvp} />
            Show RSVP form to guests
          </label>
        </div>

        {/* FAQ editor */}
        <div className="space-y-2">
          <Label>FAQs <span className="text-xs text-muted-foreground">(optional)</span></Label>
          {faqs.map((faq, i) => (
            <div key={i} className="group relative rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
              <button
                type="button" onClick={() => removeFaq(i)}
                className="absolute right-2 top-2 rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                aria-label="Remove FAQ"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <Input placeholder="Question" value={faq.q} onChange={(e) => updateFaq(i, "q", e.target.value)} />
              <Textarea rows={2} placeholder="Answer" value={faq.a} onChange={(e) => updateFaq(i, "a", e.target.value)} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addFaq} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add FAQ
          </Button>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="gap-1.5">
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save page settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// --- COMMUNICATE ---
function CommunicateTabContent({
  eventId,
  eventName,
  comms,
  commsLoaded,
  onMessageSent,
}: {
  eventId: string;
  eventName: string;
  comms: Array<{
    id: string;
    event_id: string;
    organizer_id: string;
    subject: string;
    body: string;
    recipient_group: import("@/lib/event-comms.functions").RecipientGroup;
    recipient_count: number;
    scheduled_for: string | null;
    sent_at: string | null;
    status: "sent" | "scheduled" | "failed";
    created_at: string;
  }>;
  commsLoaded: boolean;
  onMessageSent: () => Promise<void>;
}) {
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="border-border/60 p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Event Updates</h2>
            <p className="text-sm text-muted-foreground">Post in-app updates to selected guests and ticket holders who have MelaBridge accounts.</p>
          </div>
          <Button className="gap-2" onClick={() => setComposerOpen(true)}>
            <Mail className="h-4 w-4" /> Post Update
          </Button>
        </div>
      </Card>

      {commsLoaded ? (
        <CommunicationsHistory comms={comms} onRefresh={onMessageSent} />
      ) : (
        <Card className="border-border/60 p-8 text-center shadow-soft">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading message history…</p>
        </Card>
      )}

      <MessageComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        eventId={eventId}
        eventName={eventName}
        onSent={onMessageSent}
      />
    </div>
  );
}

// --- INVITATIONS ---
function InvitationsTab({ event, guests, onSaved }: { event: Event; guests: Guest[]; onSaved: () => Promise<void> }) {
  const [guidance, setGuidance] = useState<string>(event.invitation_guidance ?? "");
  const [busy, setBusy] = useState(false);
  const [regen, setRegen] = useState(false);
  const [invitationsOpen, setInvitationsOpen] = useState(false);
  const bootstrap = useServerFn(bootstrapEventPlan);

  useEffect(() => { setGuidance(event.invitation_guidance ?? ""); }, [event.invitation_guidance]);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("events").update({ invitation_guidance: guidance }).eq("id", event.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Invitation notes saved");
    await onSaved();
  }

  async function regenerate() {
    setRegen(true);
    try {
      // Force regeneration by passing only_if_empty=false — server will overwrite guidance.
      await bootstrap({ data: { event_id: event.id, only_if_empty: false } } as never);
      toast.success("MelaAssist refreshed your invitation plan");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not refresh invitation plan");
    } finally { setRegen(false); }
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5 p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Invite your guests</h2>
            <p className="text-sm text-muted-foreground">Send a personal email with secure RSVP buttons to selected guests.</p>
          </div>
          <Button className="gap-2" onClick={() => setInvitationsOpen(true)} disabled={!guests.some((guest) => guest.email)}>
            <Mail className="h-4 w-4" /> Send invitations
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {guests.filter((guest) => guest.invited_at).length} of {guests.filter((guest) => guest.email).length} guests with email invited
        </p>
      </Card>
      <Card className="border-border/60 p-6 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" /> MelaAssist recommendation
            </div>
            <h2 className="font-display text-xl font-semibold">Invitation plan</h2>
            <p className="text-sm text-muted-foreground">When to invite guests, how to invite them, and what to include.</p>
          </div>
          <Button variant="outline" size="sm" onClick={regenerate} disabled={regen} className="gap-1.5">
            {regen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {guidance ? "Regenerate" : "Generate"}
          </Button>
        </div>
        <Textarea
          rows={8}
          value={guidance}
          placeholder="MelaAssist hasn't drafted invitation guidance yet. Click Generate to build a tailored plan, or write your own."
          onChange={(e) => setGuidance(e.target.value)}
        />
        <div className="mt-3 flex justify-end">
          <Button onClick={save} disabled={busy} className="gap-1.5">
            <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </Card>
      <InvitationComposer open={invitationsOpen} onClose={() => setInvitationsOpen(false)} eventId={event.id} eventName={event.name} guests={guests} onSent={onSaved} />

      <Card className="border-dashed border-border/60 p-6 shadow-soft">
        <h3 className="font-display text-base font-semibold">Manage your guest list</h3>
        <p className="mt-1 text-sm text-muted-foreground">Add names, track RSVPs, meal choices, and plus-ones from the Guests tab.</p>
      </Card>
    </div>
  );
}
