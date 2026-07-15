import { RouteError } from "@/components/module-states";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Sparkles, Flag, Check, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEvent } from "@/lib/use-active-event";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

export const Route = createFileRoute("/timeline")({
  head: () => ({
    meta: [
      { title: "Timeline — MelaBridge" },
      { name: "description", content: "Milestone timeline for your event." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TimelinePage,
  errorComponent: RouteError,
});

function TimelinePage() {
  const { event, loading: eventLoading, error: eventError } = useActiveEvent();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) {
      if (!eventLoading) setTasks([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("tasks")
      .select("*")
      .eq("event_id", event.id)
      .is("deleted_at", null)
      .not("due_date", "is", null)
      .order("due_date", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        setTasks(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [event, eventLoading]);

  const milestones = useMemo(() => {
    if (!tasks || !event) return [];
    const list = [...tasks];
    if (event.event_date) {
      list.push({
        id: "__event_day__",
        event_id: event.id,
        title: `${event.name} — event day`,
        description: null,
        status: "todo" as const,
        priority: "high" as const,
        due_date: event.event_date,
        assigned_to: null,
        created_by: null,
        completed_at: null,
        created_at: event.created_at,
        updated_at: event.updated_at,
        is_test_seed: false,
        is_sample: false,
        deleted_at: null,
      });
    }
    return list.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  }, [tasks, event]);

  return (
    <AppShell active="/timeline">
      <PageHeader
        eyebrow="Timeline"
        icon={Calendar}
        title={<>Your path to <span className="text-gradient">event day</span>.</>}
        description={event ? `${event.name}${event.event_date ? ` · ${new Date(event.event_date).toLocaleDateString()}` : ""}` : "Track every milestone from planning to event day."}
        actions={event ? (
          <Button variant="hero" asChild>
            <Link to="/tasks"><Plus className="mr-2 h-4 w-4" />Add milestone</Link>
          </Button>
        ) : null}
      />

      {eventError && (
        <Card className="mt-6 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn't load your event: {eventError}
        </Card>
      )}
      {error && (
        <Card className="mt-6 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn't load your timeline: {error}
        </Card>
      )}

      {eventLoading || (event && tasks === null) ? (
        <div className="mt-8 space-y-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : !event ? (
        <Card className="mt-8 border-border/60 p-10 text-center shadow-soft">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Calendar className="h-5 w-5" />
          </div>
          <h3 className="font-display text-lg font-semibold">No event yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first event and your timeline appears here.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/events/new"><Plus className="mr-1.5 h-4 w-4" />Create your event</Link>
          </Button>
        </Card>
      ) : milestones.length === 0 ? (
        <Card className="mt-8 border-border/60 p-10 text-center shadow-soft">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="font-display text-lg font-semibold">No timeline yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add tasks with due dates and they'll appear here as milestones on the road to event day.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/tasks"><Plus className="mr-1.5 h-4 w-4" />Add your first task</Link>
          </Button>
        </Card>
      ) : (
        <div className="mt-10 relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
          <ul className="space-y-6">
            {milestones.map((m) => {
              const isEventDay = m.id === "__event_day__";
              const done = m.status === "done";
              const current = !done && !isEventDay && m.status === "in_progress";
              return (
                <li key={m.id} className="relative">
                  <span
                    className={`absolute -left-6 top-1.5 grid h-4 w-4 place-items-center rounded-full border-2 ${
                      done
                        ? "border-emerald-500 bg-emerald-500"
                        : current
                        ? "border-primary bg-primary animate-pulse"
                        : isEventDay
                        ? "border-gold bg-gold"
                        : "border-border bg-background"
                    }`}
                  >
                    {done && <Check className="h-2.5 w-2.5 text-white" />}
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {m.due_date ? new Date(m.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""}
                    </p>
                    {current && <Badge className="bg-primary/10 text-primary">In progress</Badge>}
                    {isEventDay && (
                      <Badge className="bg-gold/20 text-foreground gap-1">
                        <Flag className="h-3 w-3" />Event day
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-lg font-medium">{m.title}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
