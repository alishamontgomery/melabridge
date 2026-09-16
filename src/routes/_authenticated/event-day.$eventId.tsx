/**
 * Event Day / Run-of-Show Mode
 *
 * A full-screen, phone-optimised route for the actual event day.
 * Shows the runsheet in real-time with quick actions:
 *   • Mark Complete / Mark Delayed / Add Note
 *   • Live check-in counter (polls every 30 s)
 *   • Color-coded item status
 *
 * Accessible from the event overview within the 48-hour window.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, AlertTriangle, Clock, Loader2,
  RefreshCw, Sun, ChevronRight, ScanLine, FileText, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type RunsheetRow = Database["public"]["Tables"]["event_runsheet_items"]["Row"];
type EventRow = Pick<
  Database["public"]["Tables"]["events"]["Row"],
  "id" | "name" | "event_date" | "event_time" | "location" | "owner_id"
>;

export const Route = createFileRoute("/_authenticated/event-day/$eventId")({
  head: () => ({ meta: [{ title: "Event Day — MelaBridge" }] }),
  component: EventDayPage,
});

// ── helpers ──────────────────────────────────────────────────────────────────

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmt12(t: string | null) {
  if (!t) return "—";
  const [h = "0", m = "0"] = t.split(":");
  const hh = parseInt(h, 10);
  const mm = m.padStart(2, "0");
  return `${((hh + 11) % 12) + 1}:${mm} ${hh >= 12 ? "PM" : "AM"}`;
}

function timeToMin(t: string | null): number {
  if (!t) return -9999;
  const [h = "0", m = "0"] = t.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

function currentMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function classifyItem(
  item: RunsheetRow,
  nowMin: number,
): "past" | "current" | "upcoming" | "delayed" | "complete" | "critical" {
  if (item.status === "complete") return "complete";
  if (item.status === "delayed") return "delayed";
  if (item.status === "critical") return "critical";
  const start = timeToMin(item.start_time);
  const end = start + item.duration_min;
  if (nowMin >= start && nowMin < end) return "current";
  if (nowMin >= end) return "past";
  return "upcoming";
}

const ITEM_STYLE: Record<string, string> = {
  past: "border-border/40 bg-muted/20 opacity-70",
  current: "border-primary/40 bg-primary/5 ring-1 ring-primary/30",
  upcoming: "border-border/60 bg-card",
  delayed: "border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20",
  complete: "border-emerald-400/30 bg-emerald-50/50 dark:bg-emerald-950/20 opacity-80",
  critical: "border-rose-400/50 bg-rose-50/60 dark:bg-rose-950/20",
};

const ITEM_LABEL: Record<string, string> = {
  past: "Past",
  current: "Now",
  upcoming: "Upcoming",
  delayed: "Delayed",
  complete: "Done",
  critical: "Critical",
};

const ITEM_BADGE_CLASS: Record<string, string> = {
  past: "bg-muted text-muted-foreground",
  current: "bg-primary text-primary-foreground",
  upcoming: "bg-muted text-muted-foreground",
  delayed: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  complete: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200",
  critical: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200",
};

// ── component ─────────────────────────────────────────────────────────────────

function EventDayPage() {
  const { eventId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventRow | null | undefined>(undefined);
  const [items, setItems] = useState<RunsheetRow[]>([]);
  const [checkedIn, setCheckedIn] = useState(0);
  const [totalAttendees, setTotalAttendees] = useState(0);
  const [nowMin, setNowMin] = useState(currentMinutes());
  const [noteTarget, setNoteTarget] = useState<RunsheetRow | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setNowMin(currentMinutes()), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [evResult, runResult, attendeeResult] = await Promise.all([
        supabase.from("events")
          .select("id,name,event_date,event_time,location,owner_id")
          .eq("id", eventId)
          .is("deleted_at", null)
          .maybeSingle(),
        supabase.from("event_runsheet_items")
          .select("*")
          .eq("event_id", eventId)
          .order("sort_order", { ascending: true })
          .order("start_time", { ascending: true, nullsFirst: false }),
        supabase.from("ticket_attendees")
          .select("id,checked_in_at", { count: "exact" })
          .eq("event_id", eventId),
      ]);

      if (evResult.error) throw evResult.error;
      setEvent(evResult.data ?? null);
      setItems(runResult.data ?? []);

      const allAttendees = attendeeResult.data ?? [];
      setTotalAttendees(allAttendees.length);
      setCheckedIn(allAttendees.filter((a) => !!a.checked_in_at).length);
    } catch (err) {
      if (!silent) toast.error("Could not load event data");
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  // Poll check-in every 30 s
  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const classified = useMemo(
    () => items.map((i) => ({ item: i, cls: classifyItem(i, nowMin) })),
    [items, nowMin],
  );

  const currentItems = classified.filter((x) => x.cls === "current");
  const nextItems = classified.filter((x) => x.cls === "upcoming").slice(0, 3);
  const pastItems = classified.filter((x) => ["past", "complete"].includes(x.cls));
  const delayedItems = classified.filter((x) => ["delayed", "critical"].includes(x.cls));

  async function updateItem(id: string, patch: Partial<RunsheetRow>) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("event_runsheet_items").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      load(true);
    }
  }

  async function saveNote() {
    if (!noteTarget) return;
    setNoteBusy(true);
    await updateItem(noteTarget.id, { notes: noteText.trim() || null });
    setNoteBusy(false);
    setNoteTarget(null);
    setNoteText("");
    toast.success("Note saved");
  }

  if (event === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (event === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <Card className="max-w-sm p-8 text-center">
          <h2 className="font-display text-xl font-semibold">Event not found</h2>
          <Button asChild className="mt-4"><Link to="/events">Back to events</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back">
            <Link to={`/events/${eventId}` as never}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">Event Day</p>
            <h1 className="truncate font-display text-base font-semibold leading-tight">{event.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-500" aria-hidden />
            <span className="text-sm font-semibold tabular-nums">{nowHHMM()}</span>
          </div>
          <button
            onClick={() => load(true)}
            aria-label="Refresh"
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted transition"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 pb-20 pt-4">
        {/* ── Check-in counter ──────────────────────────────────── */}
        {totalAttendees > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <CountPill label="Checked in" value={checkedIn} accent />
            <CountPill label="Total" value={totalAttendees} />
            <CountPill label="Remaining" value={totalAttendees - checkedIn} />
          </div>
        )}

        {/* ── Delayed / Critical alerts ─────────────────────────── */}
        {delayedItems.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3 dark:border-amber-700 dark:bg-amber-950/30">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" /> Needs attention
            </p>
            <div className="space-y-1.5">
              {delayedItems.map(({ item }) => (
                <RunsheetItem key={item.id} item={item} cls={item.status as string} onUpdate={(p) => updateItem(item.id, p)} onAddNote={() => { setNoteTarget(item); setNoteText(item.notes ?? ""); }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Current ───────────────────────────────────────────── */}
        {currentItems.length > 0 && (
          <section>
            <SectionLabel icon={Clock} label="Happening now" />
            <div className="space-y-2">
              {currentItems.map(({ item, cls }) => (
                <RunsheetItem key={item.id} item={item} cls={cls} onUpdate={(p) => updateItem(item.id, p)} onAddNote={() => { setNoteTarget(item); setNoteText(item.notes ?? ""); }} />
              ))}
            </div>
          </section>
        )}

        {/* ── Next up ───────────────────────────────────────────── */}
        {nextItems.length > 0 && (
          <section>
            <SectionLabel icon={ChevronRight} label="Up next" />
            <div className="space-y-2">
              {nextItems.map(({ item, cls }) => (
                <RunsheetItem key={item.id} item={item} cls={cls} onUpdate={(p) => updateItem(item.id, p)} onAddNote={() => { setNoteTarget(item); setNoteText(item.notes ?? ""); }} />
              ))}
            </div>
          </section>
        )}

        {/* ── Empty runsheet ────────────────────────────────────── */}
        {items.length === 0 && (
          <Card className="border-dashed p-8 text-center">
            <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <h3 className="font-display font-semibold">No runsheet yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Build a day-of timeline from the event's Runsheet tab.</p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to={`/events/${eventId}` as never}>Open event</Link>
            </Button>
          </Card>
        )}

        {/* ── Past / done ───────────────────────────────────────── */}
        {pastItems.length > 0 && (
          <section>
            <SectionLabel icon={Check} label="Earlier today" />
            <div className="space-y-2">
              {pastItems.map(({ item, cls }) => (
                <RunsheetItem key={item.id} item={item} cls={cls} onUpdate={(p) => updateItem(item.id, p)} onAddNote={() => { setNoteTarget(item); setNoteText(item.notes ?? ""); }} />
              ))}
            </div>
          </section>
        )}

        {/* ── Scanner shortcut ──────────────────────────────────── */}
        <Button asChild variant="outline" className="w-full gap-2">
          <Link to={`/checkin/${eventId}` as never}>
            <ScanLine className="h-4 w-4" /> Open check-in scanner
          </Link>
        </Button>
      </main>

      {/* ── Note dialog ───────────────────────────────────────────── */}
      {noteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4"
          onClick={() => setNoteTarget(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl border border-border/60 bg-background p-5 shadow-elegant"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-semibold">Note for "{noteTarget.title}"</h3>
              <button onClick={() => setNoteTarget(null)} className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Textarea
              rows={4}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note for this runsheet item…"
              autoFocus
            />
            <div className="mt-3 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setNoteTarget(null)}>Cancel</Button>
              <Button className="flex-1" disabled={noteBusy} onClick={saveNote}>
                {noteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save note"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CountPill({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3 text-center", accent ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card")}>
      <p className={cn("font-display text-2xl font-bold", accent && "text-primary")}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionLabel({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

function RunsheetItem({
  item, cls, onUpdate, onAddNote,
}: {
  item: RunsheetRow;
  cls: string;
  onUpdate: (p: Partial<RunsheetRow>) => void;
  onAddNote: () => void;
}) {
  const isComplete = item.status === "complete";
  const isDelayed = item.status === "delayed";

  return (
    <div className={cn("rounded-xl border p-3 transition", ITEM_STYLE[cls] ?? ITEM_STYLE.upcoming)}>
      <div className="flex items-start gap-3">
        {/* Time */}
        <div className="w-16 shrink-0 pt-0.5 text-sm font-medium tabular-nums text-muted-foreground">
          {fmt12(item.start_time)}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("text-sm font-semibold", isComplete && "line-through text-muted-foreground")}>
              {item.title}
            </p>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", ITEM_BADGE_CLASS[cls] ?? ITEM_BADGE_CLASS.upcoming)}>
              {ITEM_LABEL[cls] ?? cls}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span>{item.duration_min}m</span>
            {item.owner && <span>{item.owner}</span>}
          </div>
          {item.notes && (
            <p className="mt-1 text-xs text-muted-foreground italic">{item.notes}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <ActionBtn
          icon={Check}
          label={isComplete ? "Undo" : "Done"}
          active={isComplete}
          activeClass="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700"
          onClick={() => onUpdate({ status: isComplete ? "planned" : "complete" })}
        />
        <ActionBtn
          icon={AlertTriangle}
          label={isDelayed ? "Undelay" : "Delayed"}
          active={isDelayed}
          activeClass="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700"
          onClick={() => onUpdate({ status: isDelayed ? "planned" : "delayed" })}
        />
        <ActionBtn
          icon={FileText}
          label="Note"
          onClick={onAddNote}
        />
      </div>
    </div>
  );
}

function ActionBtn({
  icon: Icon, label, onClick, active, activeClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
        active && activeClass
          ? activeClass
          : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

