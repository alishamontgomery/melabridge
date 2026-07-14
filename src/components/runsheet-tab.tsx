import { useEffect, useState } from "react";
import { Plus, Trash2, Clock, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapEventPlan } from "@/lib/event-bootstrap.functions";

type Row = Database["public"]["Tables"]["event_runsheet_items"]["Row"];

function formatTime(t: string | null): string {
  if (!t) return "—";
  const [h = "0", m = "0"] = t.split(":");
  const hh = parseInt(h, 10);
  const mm = m.padStart(2, "0");
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${mm} ${period}`;
}

export function RunsheetTab({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ title: "", start_time: "", duration_min: "30", owner: "" });
  const bootstrap = useServerFn(bootstrapEventPlan);

  async function load() {
    const { data, error } = await supabase
      .from("event_runsheet_items")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
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

  async function add() {
    if (!draft.title.trim()) return;
    const nextSort = (items?.length ?? 0);
    const { error } = await supabase.from("event_runsheet_items").insert({
      event_id: eventId,
      title: draft.title.trim(),
      start_time: draft.start_time || null,
      duration_min: parseInt(draft.duration_min, 10) || 30,
      owner: draft.owner.trim() || null,
      sort_order: nextSort,
    });
    if (error) return toast.error(error.message);
    setDraft({ title: "", start_time: "", duration_min: "30", owner: "" });
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("event_runsheet_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  if (items === null) return <div className="text-sm text-muted-foreground">Loading runsheet…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Day-of runsheet</h2>
          <p className="text-sm text-muted-foreground">
            Minute-by-minute plan for event day. Times auto-scaled from your start time.
          </p>
        </div>
        {items.length === 0 && (
          <Button onClick={generate} disabled={busy} variant="hero">
            <Sparkles className="mr-2 h-4 w-4" />
            {busy ? "Drafting…" : "Draft with MelaAssist"}
          </Button>
        )}
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
        <div className="rounded-2xl border border-border/60 bg-card shadow-soft overflow-hidden">
          <ol className="divide-y divide-border/50">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-4 p-4">
                <div className="w-24 shrink-0 text-sm font-medium tabular-nums">{formatTime(it.start_time)}</div>
                <div className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">{it.duration_min}m</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{it.title}</p>
                  {it.notes && <p className="truncate text-xs text-muted-foreground">{it.notes}</p>}
                </div>
                {it.owner && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />{it.owner}
                  </span>
                )}
                <Button variant="ghost" size="icon" onClick={() => remove(it.id)} aria-label="Remove item">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <Card className="border-border/60 p-5">
        <h3 className="mb-3 text-sm font-semibold">Add an item</h3>
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
      </Card>
    </div>
  );
}
