import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardList, Plus, Check, ListChecks, LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEvent } from "@/lib/use-active-event";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Status = Database["public"]["Enums"]["task_status"];
type Priority = Database["public"]["Enums"]["task_priority"];

const STATUSES: { key: Status; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

const PRI_TONE: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-amber-500/10 text-amber-700",
  urgent: "bg-rose-500/10 text-rose-700",
};

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — MelaBridge" },
      { name: "description", content: "Every task for your event, on the right day." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const { event, loading: eventLoading, error: eventError } = useActiveEvent();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

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
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        setTasks(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [event, eventLoading]);

  async function addTask() {
    if (!event || !newTitle.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("tasks")
      .insert({ event_id: event.id, title: newTitle.trim() })
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTasks((prev) => (prev ? [data, ...prev] : [data]));
    setNewTitle("");
  }

  async function setStatus(id: string, status: Status) {
    const patch: Partial<Task> = { status };
    if (status === "done") patch.completed_at = new Date().toISOString();
    const prev = tasks;
    setTasks((prev) => (prev ? prev.map((t) => (t.id === id ? { ...t, ...patch } : t)) : prev));
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      setTasks(prev);
    }
  }

  const done = tasks?.filter((t) => t.status === "done").length ?? 0;
  const total = tasks?.length ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <AppShell active="/tasks">
      <PageHeader
        eyebrow="Tasks"
        icon={ClipboardList}
        title={<>Every task, <span className="text-gradient">on the right day</span>.</>}
        description={event ? `${total} task${total === 1 ? "" : "s"} · ${done} done` : "Track everything from booking to event day."}
      />

      {eventError && (
        <Card className="mt-6 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn't load your event: {eventError}
        </Card>
      )}
      {error && (
        <Card className="mt-6 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn't load tasks: {error}
        </Card>
      )}

      {eventLoading ? (
        <Skeleton className="mt-6 h-40 rounded-2xl" />
      ) : !event ? (
        <Card className="mt-6 border-border/60 p-10 text-center shadow-soft">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <h3 className="font-display text-lg font-semibold">No event yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create an event to start adding tasks.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/events/new"><Plus className="mr-1.5 h-4 w-4" />Create event</Link>
          </Button>
        </Card>
      ) : (
        <>
          <Card className="mt-6 flex flex-col gap-3 border-border/60 p-4 shadow-soft sm:flex-row">
            <Input
              placeholder="New task…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              className="flex-1"
            />
            <Button onClick={addTask} disabled={!newTitle.trim() || creating} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add task
            </Button>
          </Card>

          {total > 0 && <Progress value={pct} className="mt-4 h-2" />}

          <Tabs defaultValue="kanban" className="mt-6">
            <TabsList>
              <TabsTrigger value="kanban"><LayoutGrid className="mr-1.5 h-3.5 w-3.5" />Board</TabsTrigger>
              <TabsTrigger value="list"><ListChecks className="mr-1.5 h-3.5 w-3.5" />List</TabsTrigger>
            </TabsList>

            <TabsContent value="kanban" className="mt-4">
              {tasks === null ? (
                <Skeleton className="h-60 rounded-2xl" />
              ) : total === 0 ? (
                <EmptyTasks />
              ) : (
                <div className="grid gap-4 md:grid-cols-4">
                  {STATUSES.map((s) => (
                    <div key={s.key} className="rounded-2xl border border-border bg-muted/30 p-3">
                      <div className="mb-3 flex items-center justify-between px-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                        <Badge variant="secondary">{tasks.filter((t) => t.status === s.key).length}</Badge>
                      </div>
                      <ul className="space-y-2">
                        {tasks.filter((t) => t.status === s.key).map((t) => (
                          <li key={t.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium leading-snug">{t.title}</p>
                              <Badge className={PRI_TONE[t.priority]}>{t.priority}</Badge>
                            </div>
                            {t.due_date && (
                              <p className="mt-2 text-xs text-muted-foreground">Due {new Date(t.due_date).toLocaleDateString()}</p>
                            )}
                            {t.status !== "done" && (
                              <Button size="sm" variant="ghost" className="mt-2 h-7 w-full" onClick={() => setStatus(t.id, "done")}>
                                <Check className="mr-1 h-3.5 w-3.5" />Complete
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="list" className="mt-4">
              {tasks === null ? (
                <Skeleton className="h-60 rounded-2xl" />
              ) : total === 0 ? (
                <EmptyTasks />
              ) : (
                <div className="rounded-3xl border border-border bg-card divide-y divide-border">
                  {tasks.map((t) => (
                    <label key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30">
                      <input
                        type="checkbox"
                        checked={t.status === "done"}
                        onChange={() => setStatus(t.id, t.status === "done" ? "todo" : "done")}
                        className="h-4 w-4 rounded border-border"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                        {t.due_date && <p className="text-xs text-muted-foreground">Due {new Date(t.due_date).toLocaleDateString()}</p>}
                      </div>
                      <Badge className={PRI_TONE[t.priority]}>{t.priority}</Badge>
                    </label>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppShell>
  );
}

function EmptyTasks() {
  return (
    <Card className="border-border/60 p-10 text-center shadow-soft">
      <ListChecks className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
      <h3 className="font-display text-lg font-semibold">No tasks yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Add your first task above and it'll appear here and on your timeline.
      </p>
    </Card>
  );
}
