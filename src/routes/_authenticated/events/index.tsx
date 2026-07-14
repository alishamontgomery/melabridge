import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Plus, MapPin, Users, Wallet, Clock, Sparkles, Archive, Trash2, RotateCcw, MoreVertical } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SampleDataBadge } from "@/components/sample-data-badge";
import { PageEmptyState } from "@/components/page-empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

type EventStats = {
  guestCount: number;
  tasksDone: number;
  tasksTotal: number;
  budgetSpent: number;
  nextTask: string | null;
};

type View = "active" | "archived" | "trash";

export const Route = createFileRoute("/_authenticated/events/")({
  head: () => ({ meta: [{ title: "Your events — MelaBridge" }] }),
  component: EventsListPage,
});

function EventsListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("active");
  const [events, setEvents] = useState<Event[] | null>(null);
  const [stats, setStats] = useState<Record<string, EventStats>>({});
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmPurge, setConfirmPurge] = useState<Event | null>(null);

  useEffect(() => {
    if (!user) return;
    setEvents(null);
    setError(null);
    let q = supabase.from("events").select("*");
    if (view === "trash") q = q.not("deleted_at", "is", null);
    else if (view === "archived") q = q.is("deleted_at", null).eq("status", "archived");
    else q = q.is("deleted_at", null).neq("status", "archived");

    q.order("event_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (error) {
          setError(error.message);
          setEvents([]);
          return;
        }
        const list = data ?? [];
        setEvents(list);
        if (list.length === 0 || view === "trash") return;
        const ids = list.map((e) => e.id);
        const [{ data: guests }, { data: tasks }, { data: budget }] = await Promise.all([
          supabase.from("guests").select("event_id, plus_ones").in("event_id", ids).is("deleted_at", null),
          supabase.from("tasks").select("event_id, status, title, due_date").in("event_id", ids).is("deleted_at", null),
          supabase.from("budget_items").select("event_id, paid_amount, actual_amount").in("event_id", ids).is("deleted_at", null),
        ]);
        const map: Record<string, EventStats> = {};
        for (const e of list) {
          const gs = (guests ?? []).filter((g) => g.event_id === e.id);
          const ts = (tasks ?? []).filter((t) => t.event_id === e.id);
          const bs = (budget ?? []).filter((b) => b.event_id === e.id);
          const upcoming = ts
            .filter((t) => t.status !== "done" && t.due_date)
            .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0];
          map[e.id] = {
            guestCount: gs.reduce((s, g) => s + 1 + Number(g.plus_ones ?? 0), 0),
            tasksDone: ts.filter((t) => t.status === "done").length,
            tasksTotal: ts.length,
            budgetSpent: bs.reduce((s, b) => s + Number(b.paid_amount ?? b.actual_amount ?? 0), 0),
            nextTask: upcoming?.title ?? null,
          };
        }
        setStats(map);
      });
  }, [user, view, reloadKey]);

  const hasReal = useMemo(() => (events ?? []).some((e) => !e.is_sample), [events]);
  const reload = () => setReloadKey((k) => k + 1);

  async function restore(ev: Event) {
    const { error } = await supabase
      .from("events")
      .update({ deleted_at: null, status: ev.status === "archived" ? "confirmed" : ev.status })
      .eq("id", ev.id);
    if (error) return toast.error(error.message);
    toast.success("Event restored");
    reload();
  }

  async function unarchive(ev: Event) {
    const { error } = await supabase.from("events").update({ status: "confirmed" }).eq("id", ev.id);
    if (error) return toast.error(error.message);
    toast.success("Moved back to Active");
    reload();
  }

  async function purge(ev: Event) {
    const { error } = await supabase.from("events").delete().eq("id", ev.id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Event permanently deleted");
    reload();
  }

  return (
    <AppShell active="/events">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Events"
          title="Your events"
          description="Every event you own or collaborate on lives here."
          icon={Calendar}
          actions={
            <Button onClick={() => navigate({ to: "/events/new" })} className="gap-1.5" variant="hero">
              <Plus className="h-4 w-4" /> New event
            </Button>
          }
        />

        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived"><Archive className="mr-1.5 h-3.5 w-3.5" />Archived</TabsTrigger>
            <TabsTrigger value="trash"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Trash</TabsTrigger>
          </TabsList>
        </Tabs>

        {view === "trash" && (
          <p className="text-xs text-muted-foreground">
            Items in Trash are automatically removed after 30 days. Restore anytime before then.
          </p>
        )}

        {error && (
          <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Couldn't load your events: {error}
          </Card>
        )}

        {events === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : events.length === 0 ? (
          view === "active" ? (
            <PageEmptyState
              icon={Sparkles}
              title="Your workspace is ready"
              description="Create your first event to unlock personalized planning tools, or explore the sample workspace to see MelaBridge in action."
              primary={{ label: "Create your first event", to: "/events/new", variant: "hero" }}
              secondary={{ label: "Explore sample workspace", to: "/onboarding" }}
              aiSuggestion="Not sure where to start? Tell MelaAssist™ your event type and I'll draft a complete plan in seconds."
            />
          ) : (
            <Card className="border-dashed border-border/60 p-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                {view === "archived" ? <Archive className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold">
                {view === "archived" ? "Nothing archived yet" : "Trash is empty"}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {view === "archived"
                  ? "Completed events you archive will appear here for future reference."
                  : "Events you delete land here for 30 days before being permanently removed."}
              </p>
            </Card>
          )
        ) : (
          <>
            {view === "active" && !hasReal && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <span className="font-medium">Ready when you are.</span>{" "}
                <span className="text-muted-foreground">
                  These are sample events for you to explore. Create a real event whenever you'd like.
                </span>
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((ev) => (
                <div key={ev.id} className="relative">
                  {view === "trash" ? (
                    <TrashCard event={ev} onRestore={() => restore(ev)} onPurge={() => setConfirmPurge(ev)} />
                  ) : (
                    <EventCard
                      event={ev}
                      stats={stats[ev.id]}
                      view={view}
                      onUnarchive={() => unarchive(ev)}
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmPurge}
        onOpenChange={(o) => !o && setConfirmPurge(null)}
        destructive
        title="Delete this event forever?"
        description={
          <>
            <p>&ldquo;{confirmPurge?.name}&rdquo; and <strong>all its guests, tasks, budget, runsheet, and files</strong> will be permanently deleted.</p>
            <p className="mt-2 font-medium text-destructive">This cannot be undone.</p>
          </>
        }
        confirmLabel="Delete forever"
        onConfirm={async () => { if (confirmPurge) await purge(confirmPurge); }}
      />
    </AppShell>
  );
}

function EventCard({
  event, stats, view, onUnarchive,
}: {
  event: Event;
  stats: EventStats | undefined;
  view: View;
  onUnarchive: () => void;
}) {
  const s = stats ?? { guestCount: 0, tasksDone: 0, tasksTotal: 0, budgetSpent: 0, nextTask: null };
  const countdown = event.event_date ? daysUntil(event.event_date) : null;
  const completion = s.tasksTotal > 0 ? Math.round((s.tasksDone / s.tasksTotal) * 100) : 0;
  const budgetPct = event.budget_target ? Math.round((s.budgetSpent / Number(event.budget_target)) * 100) : 0;

  return (
    <div className="relative">
      {view === "archived" && (
        <div className="absolute right-3 top-3 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="secondary" className="h-8 w-8 backdrop-blur bg-background/90" onClick={(e) => e.preventDefault()}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onUnarchive(); }}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restore to Active
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <Link to="/events/$eventId" params={{ eventId: event.id }} className="group block">
        <Card className="h-full overflow-hidden border-border/60 shadow-soft transition hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 duration-200">
          <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-gold/10">
            {event.banner_url ? (
              <img src={event.banner_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
            ) : (
              <div className="grid h-full place-items-center text-primary/40">
                <Calendar className="h-10 w-10" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
              {event.is_sample && <SampleDataBadge />}
              <Badge variant="secondary" className="capitalize backdrop-blur bg-background/80">
                {event.status}
              </Badge>
            </div>
            {view === "active" && countdown !== null && (
              <div className="absolute right-3 top-3 rounded-lg bg-background/90 px-2.5 py-1 text-center backdrop-blur">
                <p className="font-display text-sm font-bold leading-none">
                  {countdown === 0 ? "Today" : countdown === 1 ? "Tomorrow" : countdown > 1 ? countdown : "Past"}
                </p>
                {countdown > 1 && <p className="text-[9px] uppercase tracking-wider text-muted-foreground">days</p>}
              </div>
            )}
          </div>
          <div className="p-5">
            <div>
              <h3 className="font-display text-lg font-semibold group-hover:text-primary line-clamp-1">
                {event.name}
              </h3>
              {event.event_type && <p className="text-xs text-muted-foreground">{event.event_type}</p>}
            </div>
            <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
              {event.event_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />{" "}
                  {new Date(event.event_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{event.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3" /> {s.guestCount || event.guest_target || 0} guests
              </div>
            </dl>
            {s.tasksTotal > 0 && (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Planning progress</span>
                  <span className="font-semibold text-foreground">{completion}%</span>
                </div>
                <Progress value={completion} className="h-1.5" />
              </div>
            )}
            {event.budget_target && s.budgetSpent > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <Wallet className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  ${Math.round(s.budgetSpent).toLocaleString()} of ${Number(event.budget_target).toLocaleString()}
                </span>
                <span className={`ml-auto font-medium ${budgetPct > 100 ? "text-destructive" : "text-primary"}`}>
                  {budgetPct}%
                </span>
              </div>
            )}
            {s.nextTask && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px]">
                <Clock className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span className="truncate text-muted-foreground">
                  <span className="font-medium text-foreground">Next:</span> {s.nextTask}
                </span>
              </div>
            )}
          </div>
        </Card>
      </Link>
    </div>
  );
}

function TrashCard({ event, onRestore, onPurge }: { event: Event; onRestore: () => void; onPurge: () => void }) {
  const deletedAt = event.deleted_at ? new Date(event.deleted_at) : null;
  const purgeDate = deletedAt ? new Date(deletedAt.getTime() + 30 * 86400000) : null;
  const daysLeft = purgeDate ? Math.max(0, Math.ceil((purgeDate.getTime() - Date.now()) / 86400000)) : 30;
  return (
    <Card className="flex h-full flex-col border-border/60 p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Trash2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 font-display text-base font-semibold">{event.name}</h3>
          <p className="text-xs text-muted-foreground">{event.event_type ?? "Event"}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Deletes in <span className="font-medium text-foreground">{daysLeft} day{daysLeft === 1 ? "" : "s"}</span>
      </p>
      <div className="mt-auto flex gap-2 pt-4">
        <Button variant="outline" size="sm" onClick={onRestore} className="flex-1">
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
        </Button>
        <Button variant="destructive" size="sm" onClick={onPurge} className="flex-1">
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete forever
        </Button>
      </div>
    </Card>
  );
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
