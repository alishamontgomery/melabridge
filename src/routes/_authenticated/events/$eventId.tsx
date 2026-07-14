import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft, Calendar, Wallet, Trash2, Plus, Check, Circle,
  Loader2, Sparkles, Save, Pencil, Upload, Download,
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { EventOverview } from "@/components/event-overview";
import { RunsheetTab } from "@/components/runsheet-tab";
import { VendorNeedsTab } from "@/components/vendor-needs-tab";
import { ConfirmDialog } from "@/components/confirm-dialog";

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

        <div className="flex flex-wrap items-center justify-end gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">Archive</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive this event?</AlertDialogTitle>
                <AlertDialogDescription>
                  &ldquo;{event.name}&rdquo; will be hidden from Active events but kept for future reference. You can restore it anytime from the Archived tab.
                </AlertDialogDescription>
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
                <AlertDialogDescription>
                  You&rsquo;re about to delete &ldquo;{event.name}&rdquo;. This event will be moved to Trash and can be restored for 30 days. After that it&rsquo;s permanently removed along with its tasks, budget, guests, runsheet, and files.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Move to Trash</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex w-full flex-wrap gap-1 sm:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks{tasks.length > 0 ? ` (${tasks.length})` : ""}</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="guests">Guests{guests.length > 0 ? ` (${guests.length})` : ""}</TabsTrigger>
            <TabsTrigger value="runsheet">Runsheet</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <EventOverview event={event} tasks={tasks} budget={budget} guests={guests} onOpenTab={setTab} />
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
          <TabsContent value="runsheet" className="mt-6">
            <RunsheetTab eventId={eventId} />
          </TabsContent>
          <TabsContent value="vendors" className="mt-6">
            <VendorNeedsTab eventId={eventId} />
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
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);

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

// ============= BUDGET =============
function BudgetTab({ eventId, items, totals, target, reload }: {
  eventId: string; items: BudgetItem[]; totals: { est: number; act: number; paid: number }; target: number | null; reload: () => Promise<void>;
}) {
  const [category, setCategory] = useState("");
  const [label, setLabel] = useState("");
  const [estimated, setEstimated] = useState("");
  const [actual, setActual] = useState("");
  const [paid, setPaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BudgetItem | null>(null);

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
      toast.success("Budget item added");
      await reload();
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

  const budgetTarget = target ?? totals.est;
  const remaining = Math.max(0, budgetTarget - totals.paid);
  const spentPct = budgetTarget > 0 ? Math.min(100, Math.round((totals.paid / budgetTarget) * 100)) : 0;

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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Budget">${budgetTarget.toLocaleString()}</StatCard>
        <StatCard icon={Wallet} label="Spent">${totals.act.toLocaleString()}</StatCard>
        <StatCard icon={Wallet} label="Paid">${totals.paid.toLocaleString()}</StatCard>
        <StatCard icon={Wallet} label="Remaining">${remaining.toLocaleString()}</StatCard>
      </div>

      <Card className="border-border/60 p-4 shadow-soft">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Budget progress</span>
          <span>{spentPct}% of ${budgetTarget.toLocaleString()}</span>
        </div>
        <Progress value={spentPct} />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Budget ${budgetTarget.toLocaleString()}</span>
          <span>Spent ${totals.act.toLocaleString()}</span>
          <span>Paid ${totals.paid.toLocaleString()}</span>
          <span>Remaining ${remaining.toLocaleString()}</span>
        </div>
      </Card>

      {over && (
        <Card className="border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Heads up — actual spend has passed your ${target?.toLocaleString()} target by ${(totals.act - (target ?? 0)).toLocaleString()}.
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={scrollToForm} className="gap-1.5"><Plus className="h-4 w-4" /> Add Budget Item</Button>
        <Button size="sm" variant="outline" onClick={() => toast.info("Import coming soon — export a CSV to see the format.")} className="gap-1.5"><Upload className="h-4 w-4" /> Import Budget</Button>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={items.length === 0} className="gap-1.5"><Download className="h-4 w-4" /> Export</Button>
        <Button size="sm" variant="outline" onClick={() => toast.info("AI budget suggestions are on the way.")} className="gap-1.5"><Sparkles className="h-4 w-4" /> AI Budget Suggestions</Button>
      </div>

      <Card id="budget-add-form" className="border-border/60 p-4 shadow-soft">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="budget-add-category" className="text-xs">Category</Label>
            <Input id="budget-add-category" placeholder="e.g. Venue" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="budget-add-label" className="text-xs">Description</Label>
            <Input id="budget-add-label" placeholder="e.g. Ballroom deposit" value={label} onChange={(e) => setLabel(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-add-est" className="text-xs">Budgeted</Label>
            <Input id="budget-add-est" type="number" min="0" step="0.01" placeholder="0" value={estimated} onChange={(e) => setEstimated(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-add-act" className="text-xs">Spent</Label>
            <Input id="budget-add-act" type="number" min="0" step="0.01" placeholder="0" value={actual} onChange={(e) => setActual(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-add-paid" className="text-xs">Paid</Label>
            <Input id="budget-add-paid" type="number" min="0" step="0.01" placeholder="0" value={paid} onChange={(e) => setPaid(e.target.value)} />
          </div>
          <div className="sm:col-span-6 flex justify-end">
            <Button type="submit" disabled={busy} className="gap-1.5"><Plus className="h-4 w-4" /> Add Budget Item</Button>
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
                      <Button variant="ghost" size="icon" onClick={() => setPendingDelete(it)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
