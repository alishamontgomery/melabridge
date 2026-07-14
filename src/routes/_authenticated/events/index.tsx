import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Plus, MapPin, Users, Wallet, Clock, Sparkles } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { SampleDataBadge } from "@/components/sample-data-badge";
import { PageEmptyState } from "@/components/page-empty-state";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

type EventStats = {
  guestCount: number;
  tasksDone: number;
  tasksTotal: number;
  budgetSpent: number;
  nextTask: string | null;
};

export const Route = createFileRoute("/_authenticated/events/")({
  head: () => ({ meta: [{ title: "Your events — MelaBridge" }] }),
  component: EventsListPage,
});

function EventsListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [stats, setStats] = useState<Record<string, EventStats>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("events")
      .select("*")
      .neq("status", "archived")
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (error) setError(error.message);
        const list = data ?? [];
        setEvents(list);
        if (list.length === 0) return;
        const ids = list.map((e) => e.id);
        const [{ data: guests }, { data: tasks }, { data: budget }] = await Promise.all([
          supabase.from("guests").select("event_id, plus_ones").in("event_id", ids),
          supabase.from("tasks").select("event_id, status, title, due_date").in("event_id", ids),
          supabase.from("budget_items").select("event_id, paid_amount, actual_amount").in("event_id", ids),
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
  }, [user]);

  const hasReal = useMemo(() => (events ?? []).some((e) => !e.is_sample), [events]);

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
          <PageEmptyState
            icon={Sparkles}
            title="Your workspace is ready"
            description="Create your first event to unlock personalized planning tools, or explore the sample workspace to see MelaBridge in action."
            primary={{ label: "Create your first event", to: "/events/new", variant: "hero" }}
            secondary={{ label: "Explore sample workspace", to: "/onboarding" }}
            aiSuggestion="Not sure where to start? Tell MelaAssist™ your event type and I'll draft a complete plan in seconds."
          />
        ) : (
          <>
            {!hasReal && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <span className="font-medium">Ready when you are.</span>{" "}
                <span className="text-muted-foreground">
                  These are sample events for you to explore. Create a real event whenever you'd like.
                </span>
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((ev) => (
                <EventCard key={ev.id} event={ev} stats={stats[ev.id]} />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function EventCard({ event, stats }: { event: Event; stats: EventStats | undefined }) {
  const s = stats ?? { guestCount: 0, tasksDone: 0, tasksTotal: 0, budgetSpent: 0, nextTask: null };
  const countdown = event.event_date ? daysUntil(event.event_date) : null;
  const completion = s.tasksTotal > 0 ? Math.round((s.tasksDone / s.tasksTotal) * 100) : 0;
  const budgetPct = event.budget_target ? Math.round((s.budgetSpent / Number(event.budget_target)) * 100) : 0;

  return (
    <Link to="/events/$eventId" params={{ eventId: event.id }} className="group">
      <Card className="h-full overflow-hidden border-border/60 shadow-soft transition hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 duration-200">
        {/* Banner */}
        <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-gold/10">
          {event.banner_url ? (
            <img
              src={event.banner_url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
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
          {countdown !== null && (
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
                {new Date(event.event_date).toLocaleDateString(undefined, {
                  month: "short", day: "numeric", year: "numeric",
                })}
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
  );
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
