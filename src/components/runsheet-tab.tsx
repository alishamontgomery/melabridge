import { useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Clock, User, Sparkles, Lock, LockOpen, GripVertical,
  CheckCircle2, AlertTriangle, Flame, RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapEventPlan, regenerateRunsheet } from "@/lib/event-bootstrap.functions";
import {
  DndContext, PointerSensor, KeyboardSensor, closestCenter,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

type Row = Database["public"]["Tables"]["event_runsheet_items"]["Row"];
type Status = Row["status"];

function formatTime(t: string | null): string {
  if (!t) return "—";
  const [h = "0", m = "0"] = t.split(":");
  const hh = parseInt(h, 10);
  const mm = m.padStart(2, "0");
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${mm} ${period}`;
}

// HH:MM -> HH:MM:00
function normTime(v: string | null | undefined): string | null {
  if (!v) return null;
  const parts = v.split(":");
  const hh = String(parseInt(parts[0] ?? "0", 10) || 0).padStart(2, "0");
  const mm = String(parseInt(parts[1] ?? "0", 10) || 0).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

const statusStyles: Record<Status, string> = {
  planned: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-primary/10 text-primary border-primary/30",
  complete: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  delayed: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  critical: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  skipped: "bg-muted text-muted-foreground line-through border-border",
};

const statusLabel: Record<Status, string> = {
  planned: "Planned", in_progress: "In progress", complete: "Complete",
  delayed: "Delayed", critical: "Critical", skipped: "Skipped",
};

export function RunsheetTab({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", start_time: "", duration_min: "30", owner: "" });

  const bootstrap = useServerFn(bootstrapEventPlan);
  const regen = useServerFn(regenerateRunsheet);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function load() {
    const { data, error } = await supabase
      .from("event_runsheet_items")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Row[]);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [eventId]);

  async function generate() {
    setBusy(true);
    try {
      await bootstrap({ data: { event_id: eventId, only_if_empty: true } } as never);
      toast.success("Runsheet drafted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate runsheet");
    } finally { setBusy(false); }
  }

  async function doRegenerate() {
    setBusy(true);
    setRegenOpen(false);
    try {
      const r = (await regen({ data: { event_id: eventId } } as never)) as {
        inserted: number; keptLocked: number;
      };
      toast.success(`Runsheet regenerated · ${r.inserted} new, ${r.keptLocked} locked kept`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not regenerate");
    } finally { setBusy(false); }
  }

  async function add() {
    if (!draft.title.trim()) {
      toast.error("Give the item a title");
      return;
    }
    const nextSort = (items?.length ?? 0);
    const { error } = await supabase.from("event_runsheet_items").insert({
      event_id: eventId,
      title: draft.title.trim(),
      start_time: normTime(draft.start_time),
      duration_min: parseInt(draft.duration_min, 10) || 30,
      owner: draft.owner.trim() || null,
      sort_order: nextSort,
      locked: true, // user-created items shouldn't be wiped by regenerate
    });
    if (error) return toast.error(error.message);
    toast.success("Item added");
    setDraft({ title: "", start_time: "", duration_min: "30", owner: "" });
    load();
  }

  async function updateRow(id: string, patch: Partial<Row>) {
    // Optimistic
    setItems((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, ...patch } : r)) : prev));
    const { error } = await supabase.from("event_runsheet_items").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    }
  }

  async function remove(row: Row) {
    setConfirmDelete(null);
    const { error } = await supabase.from("event_runsheet_items").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Item removed");
    setItems((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev));
  }

  async function handleDragEnd(e: DragEndEvent) {
    if (!items || !e.over || e.active.id === e.over.id) return;
    const oldIdx = items.findIndex((i) => i.id === e.active.id);
    const newIdx = items.findIndex((i) => i.id === e.over!.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(items, oldIdx, newIdx);
    setItems(next);
    // Persist new sort order
    const updates = next.map((row, idx) =>
      supabase.from("event_runsheet_items").update({ sort_order: idx }).eq("id", row.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.error(failed.error.message);
      load();
    }
  }

  const lockedCount = useMemo(
    () => (items ?? []).filter((r) => r.locked).length,
    [items],
  );

  if (items === null) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl border border-border/60 bg-muted/30" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Day-of runsheet</h2>
          <p className="text-sm text-muted-foreground">
            Times are anchored to your ceremony start. Drag to reorder. Lock items to protect them when regenerating.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.length === 0 ? (
            <Button onClick={generate} disabled={busy} variant="hero">
              <Sparkles className="mr-2 h-4 w-4" />
              {busy ? "Drafting…" : "Draft with MelaAssist"}
            </Button>
          ) : (
            <Button onClick={() => setRegenOpen(true)} disabled={busy} variant="outline">
              <RotateCw className={cn("mr-2 h-4 w-4", busy && "animate-spin")} />
              Regenerate {lockedCount > 0 && `(${lockedCount} locked)`}
            </Button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="border-dashed border-border/60 p-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <h3 className="font-display text-lg font-semibold">No runsheet yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Let MelaAssist draft a complete run-of-show, or add items manually below.
          </p>
        </Card>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card shadow-soft">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ol className="divide-y divide-border/50">
                {items.map((it) => (
                  <SortableRow
                    key={it.id}
                    row={it}
                    expanded={expanded === it.id}
                    onToggleExpand={() => setExpanded((cur) => (cur === it.id ? null : it.id))}
                    onUpdate={(patch) => updateRow(it.id, patch)}
                    onDelete={() => setConfirmDelete(it)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <Card className="border-border/60 p-5">
        <h3 className="mb-3 text-sm font-semibold">Add a custom item</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_100px_1fr_auto]">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="e.g. Speeches" />
          </div>
          <div>
            <Label className="text-xs">Start</Label>
            <Input type="time" value={draft.start_time} onChange={(e) => setDraft((d) => ({ ...d, start_time: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Minutes</Label>
            <Input type="number" min="5" value={draft.duration_min} onChange={(e) => setDraft((d) => ({ ...d, duration_min: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Owner</Label>
            <Input value={draft.owner} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="flex items-end">
            <Button onClick={add}><Plus className="mr-1 h-4 w-4" />Add</Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Custom items are locked by default so regeneration never overwrites them.
        </p>
      </Card>

      <AlertDialog open={regenOpen} onOpenChange={setRegenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate runsheet?</AlertDialogTitle>
            <AlertDialogDescription>
              MelaAssist will rebuild the day-of schedule using your ceremony start time.
              {lockedCount > 0 ? (
                <> Your {lockedCount} locked item{lockedCount === 1 ? "" : "s"} will be preserved.</>
              ) : (
                <> Nothing is locked, so all current items will be replaced.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doRegenerate}>Regenerate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this runsheet item?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{confirmDelete?.title}&rdquo; will be removed from the day-of schedule. You can add it back manually.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && remove(confirmDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableRow({
  row, expanded, onToggleExpand, onUpdate, onDelete,
}: {
  row: Row;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<Row>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };

  return (
    <li ref={setNodeRef} style={style} className={cn("bg-card", row.status === "skipped" && "opacity-60")}>
      <div className="flex items-start gap-2 p-3 sm:gap-4 sm:p-4">
        <button
          type="button"
          className="mt-1 cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="w-20 shrink-0 text-sm font-medium tabular-nums sm:w-24">{formatTime(row.start_time)}</div>
        <div className="w-12 shrink-0 text-xs text-muted-foreground tabular-nums sm:w-16">{row.duration_min}m</div>
        <button
          type="button"
          onClick={onToggleExpand}
          className="min-w-0 flex-1 text-left"
          aria-expanded={expanded}
        >
          <p className={cn("truncate font-medium", row.status === "complete" && "line-through text-muted-foreground")}>
            {row.title}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {row.owner && (
              <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{row.owner}</span>
            )}
            <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] uppercase tracking-wide", statusStyles[row.status])}>
              {statusLabel[row.status]}
            </Badge>
            {row.ai_generated && (
              <span className="inline-flex items-center gap-1 text-primary/70"><Sparkles className="h-3 w-3" />AI</span>
            )}
            {row.locked && (
              <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />Locked</span>
            )}
          </div>
        </button>
        <div className="flex items-center gap-1">
          <Button
            size="icon" variant="ghost" title={row.locked ? "Unlock" : "Lock (protect from regenerate)"}
            onClick={() => onUpdate({ locked: !row.locked })}
          >
            {row.locked ? <Lock className="h-4 w-4 text-primary" /> : <LockOpen className="h-4 w-4 text-muted-foreground" />}
          </Button>
          <Button
            size="icon" variant="ghost" title="Mark complete"
            onClick={() => onUpdate({ status: row.status === "complete" ? "planned" : "complete" })}
          >
            <CheckCircle2 className={cn("h-4 w-4", row.status === "complete" ? "text-emerald-500" : "text-muted-foreground")} />
          </Button>
          <Button
            size="icon" variant="ghost" title="Mark delayed"
            onClick={() => onUpdate({ status: row.status === "delayed" ? "planned" : "delayed" })}
          >
            <AlertTriangle className={cn("h-4 w-4", row.status === "delayed" ? "text-amber-500" : "text-muted-foreground")} />
          </Button>
          <Button
            size="icon" variant="ghost" title="Mark critical"
            onClick={() => onUpdate({ status: row.status === "critical" ? "planned" : "critical" })}
          >
            <Flame className={cn("h-4 w-4", row.status === "critical" ? "text-rose-500" : "text-muted-foreground")} />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete item">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="grid gap-3 border-t border-border/40 bg-muted/20 p-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Title</Label>
            <Input
              defaultValue={row.title}
              onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== row.title && onUpdate({ title: e.target.value.trim() })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Start time</Label>
              <Input
                type="time"
                defaultValue={row.start_time?.slice(0, 5) ?? ""}
                onBlur={(e) => {
                  const v = normTime(e.target.value);
                  if (v !== row.start_time) onUpdate({ start_time: v });
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Duration (min)</Label>
              <Input
                type="number" min="5"
                defaultValue={row.duration_min}
                onBlur={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (n && n !== row.duration_min) onUpdate({ duration_min: n });
                }}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Owner / responsible</Label>
            <Input
              defaultValue={row.owner ?? ""}
              placeholder="e.g. Planner, DJ, Catering"
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== row.owner) onUpdate({ owner: v });
              }}
            />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              defaultValue={row.notes ?? ""}
              rows={2}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== row.notes) onUpdate({ notes: v });
              }}
            />
          </div>
        </div>
      )}
    </li>
  );
}
