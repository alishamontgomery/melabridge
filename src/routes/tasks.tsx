import { RouteError } from "@/components/module-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Plus, ArrowRight, ListChecks, LayoutGrid, Pencil, Trash2, Loader2 } from "lucide-react";
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
  { key: "done", label: "Done" },
];

const PRIORITIES: { key: Priority; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
  { key: "urgent", label: "Urgent" },
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
  validateSearch: (search: Record<string, unknown>) => ({
    highlight: typeof search.highlight === "string" ? search.highlight : undefined,
  }),
  component: TasksPage,
  errorComponent: RouteError,
});

function TasksPage() {
  const { event, loading: eventLoading, error: eventError } = useActiveEvent();
  const { highlight } = Route.useSearch();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        const loaded = data ?? [];
        setTasks(loaded);
        // Auto-open task deep-linked from Timeline
        if (highlight) {
          const target = loaded.find((t) => t.id === highlight);
          if (target) setSelectedTask(target);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [event, eventLoading, highlight]);

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
    else patch.completed_at = null as unknown as string;
    const prev = tasks;
    setTasks((prev) => (prev ? prev.map((t) => (t.id === id ? { ...t, ...patch } : t)) : prev));
    // Update selected task if open
    setSelectedTask((st) => (st?.id === id ? { ...st, ...patch } : st));
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      setTasks(prev);
    }
  }

  function handleTaskSaved(updated: Task) {
    setTasks((prev) => (prev ? prev.map((t) => (t.id === updated.id ? updated : t)) : prev));
    setSelectedTask(null);
  }

  function handleTaskDeleted(id: string) {
    setTasks((prev) => (prev ? prev.filter((t) => t.id !== id) : prev));
    setSelectedTask(null);
  }

  const done = tasks?.filter((t) => t.status === "done").length ?? 0;
  const total = tasks?.length ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <AppShell active="/tasks">
      <PageHeader
        eyebrow="Tasks"
        icon={ClipboardList}
        title={<>What needs <span className="text-gradient">doing next?</span></>}
        description={event ? `${Math.max(total - done, 0)} open · ${done} done` : "Keep the moving pieces visible without turning your event into a project-management job."}
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
          <Card className="mt-6 flex flex-col gap-3 border-border/60 bg-card/90 p-3 shadow-soft sm:flex-row sm:p-4">
            <Input
              placeholder="Add something that needs doing…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              className="flex-1"
            />
              <Button onClick={addTask} disabled={!newTitle.trim() || creating} className="h-11 gap-1.5 sm:h-10">
              <Plus className="h-4 w-4" /> Add task
            </Button>
          </Card>

          {total > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <Progress value={pct} className="h-2 flex-1" />
              <span className="shrink-0 text-xs font-medium text-muted-foreground">{pct}% done</span>
            </div>
          )}

          <Tabs defaultValue="list" className="mt-6">
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
                <div className="grid gap-4 md:grid-cols-3">
                  {STATUSES.map((s) => (
                    <div key={s.key} className="rounded-2xl border border-border bg-muted/25 p-3">
                      <div className="mb-3 flex items-center justify-between px-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                        <Badge variant="secondary">{tasks.filter((t) => t.status === s.key).length}</Badge>
                      </div>
                      <ul className="space-y-2">
                        {tasks.filter((t) => t.status === s.key).map((t) => (
                          <li key={t.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                            {/* Click the task body to open detail — NOT to mark complete */}
                            <button
                              type="button"
                              onClick={() => setSelectedTask(t)}
                              className="w-full text-left"
                              aria-label={`Open task: ${t.title}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{t.title}</p>
                                <Badge className={`shrink-0 whitespace-nowrap ${PRI_TONE[t.priority]}`}>{t.priority}</Badge>
                              </div>
                              {t.due_date && (
                                <p className="mt-2 text-xs text-muted-foreground">Due {new Date(t.due_date).toLocaleDateString()}</p>
                              )}
                            </button>
                            <div className="mt-2 flex items-center gap-1">
                              {t.status !== "done" ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 flex-1 text-xs"
                                  onClick={(e) => { e.stopPropagation(); setStatus(t.id, "done"); }}
                                >
                                  <ArrowRight className="mr-1 h-3.5 w-3.5" />Move to done
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 flex-1 text-xs text-muted-foreground"
                                  onClick={(e) => { e.stopPropagation(); setStatus(t.id, "todo"); }}
                                >
                                  Reopen
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => setSelectedTask(t)}
                                aria-label="Edit task"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
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
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30">
                      {/* Checkbox for quick done/undone toggle */}
                      <input
                        type="checkbox"
                        checked={t.status === "done"}
                        onChange={() => setStatus(t.id, t.status === "done" ? "todo" : "done")}
                        className="h-4 w-4 shrink-0 rounded border-border"
                        aria-label={t.status === "done" ? "Reopen task" : "Mark task done"}
                      />
                      {/* Title area opens detail dialog */}
                      <button
                        type="button"
                        onClick={() => setSelectedTask(t)}
                        className="min-w-0 flex-1 text-left"
                        aria-label={`Open task: ${t.title}`}
                      >
                        <p className={`text-sm font-medium ${t.status === "done" ? "text-muted-foreground" : ""}`}>{t.title}</p>
                        {t.due_date && <p className="text-xs text-muted-foreground">Due {new Date(t.due_date).toLocaleDateString()}</p>}
                      </button>
                      <Badge className={`shrink-0 whitespace-nowrap ${PRI_TONE[t.priority]}`}>{t.priority}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSaved={handleTaskSaved}
          onDeleted={handleTaskDeleted}
          onStatusChange={setStatus}
        />
      )}
    </AppShell>
  );
}

function TaskDetailDialog({
  task,
  onClose,
  onSaved,
  onDeleted,
  onStatusChange,
}: {
  task: Task;
  onClose: () => void;
  onSaved: (updated: Task) => void;
  onDeleted: (id: string) => void;
  onStatusChange: (id: string, status: Status) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [status, setStatusLocal] = useState<Status>(task.status);
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    if (!title.trim()) { toast.error("Task title is required"); return; }
    setSaving(true);
    const patch: Partial<Task> = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status,
      due_date: dueDate || null,
    };
    if (status === "done" && task.status !== "done") {
      patch.completed_at = new Date().toISOString();
    } else if (status !== "done") {
      patch.completed_at = null as unknown as string;
    }
    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", task.id)
      .select()
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Task saved");
    onSaved(data as Task);
  }

  async function deleteTask() {
    setDeleting(true);
    const { error } = await supabase
      .from("tasks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", task.id);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Task deleted");
    onDeleted(task.id);
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Task details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatusLocal(v as Status)}>
                <SelectTrigger id="task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea
              id="task-notes"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional context, links, or details…"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 sm:justify-between">
          <div className="flex gap-2">
            {!confirmDelete ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />Delete
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Delete this task?</span>
                <Button variant="destructive" size="sm" onClick={deleteTask} disabled={deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, delete"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving || !title.trim()} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
