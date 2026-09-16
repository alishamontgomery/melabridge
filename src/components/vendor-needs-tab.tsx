import { useCallback, useEffect, useState } from "react";
import { Sparkles, Trash2, Plus, Store, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapEventPlan } from "@/lib/event-bootstrap.functions";
import { Link } from "@tanstack/react-router";

type Row = Database["public"]["Tables"]["event_vendor_needs"]["Row"];

const statusStyles: Record<string, string> = {
  required: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  recommended: "bg-primary/10 text-primary border-primary/30",
  optional: "bg-muted text-muted-foreground border-border",
};

export function VendorNeedsTab({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ category: "", status: "recommended" as const });
  const bootstrap = useServerFn(bootstrapEventPlan);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("event_vendor_needs")
      .select("*")
      .eq("event_id", eventId)
      .order("priority", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setItems(data ?? []);
  }, [eventId]);
  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setBusy(true);
    try {
      await bootstrap({ data: { event_id: eventId, only_if_empty: true } } as never);
      toast.success("Vendor plan drafted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate vendor plan");
    } finally { setBusy(false); }
  }

  async function add() {
    if (!draft.category.trim()) return;
    const { error } = await supabase.from("event_vendor_needs").insert({
      event_id: eventId,
      category: draft.category.trim(),
      status: draft.status,
      priority: 3,
      sort_order: items?.length ?? 0,
    });
    if (error) return toast.error(error.message);
    setDraft({ category: "", status: "recommended" });
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("event_vendor_needs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function markBooked(id: string, booked: boolean) {
    const { error } = await supabase
      .from("event_vendor_needs")
      .update({ booked_vendor_id: booked ? "00000000-0000-0000-0000-000000000000" : null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  if (items === null) return <div className="text-sm text-muted-foreground">Loading vendor needs…</div>;

  const grouped = { required: [] as Row[], recommended: [] as Row[], optional: [] as Row[] };
  for (const it of items) grouped[it.status as keyof typeof grouped]?.push(it);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Vendor needs</h2>
          <p className="text-sm text-muted-foreground">
            Categories MelaAssist recommends for this event. Browse the marketplace to fill each need.
          </p>
        </div>
        <div className="flex gap-2">
          {items.length === 0 && (
            <Button onClick={generate} disabled={busy} variant="hero">
              <Sparkles className="mr-2 h-4 w-4" />{busy ? "Drafting…" : "Draft with MelaAssist"}
            </Button>
          )}
          <Button variant="outline" asChild><Link to="/marketplace"><Store className="mr-2 h-4 w-4" />Marketplace</Link></Button>
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="border-dashed border-border/60 p-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Store className="h-5 w-5" />
          </div>
          <h3 className="font-display text-lg font-semibold">No vendor needs yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Let MelaAssist recommend the categories this event needs, or add them manually.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {(["required", "recommended", "optional"] as const).map((section) => {
            const rows = grouped[section];
            if (rows.length === 0) return null;
            return (
              <div key={section}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{section}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((r) => {
                    const booked = !!r.booked_vendor_id;
                    return (
                      <Card key={r.id} className="border-border/60 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{r.category}</p>
                            {r.notes && <p className="mt-0.5 text-xs text-muted-foreground">{r.notes}</p>}
                          </div>
                          <Badge variant="outline" className={statusStyles[r.status]}>{r.status}</Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <Button size="sm" variant={booked ? "secondary" : "outline"} onClick={() => markBooked(r.id, !booked)}>
                            <Check className="mr-1 h-3.5 w-3.5" />{booked ? "Booked" : "Mark booked"}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(r.id)} aria-label="Remove"><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card className="border-border/60 p-5">
        <h3 className="mb-3 text-sm font-semibold">Add a category</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <div>
            <Label className="text-xs">Category</Label>
            <Input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} placeholder="e.g. Mehndi Artist" />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={draft.status} onValueChange={(v) => setDraft((d) => ({ ...d, status: v as typeof d.status }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="required">Required</SelectItem>
                <SelectItem value="recommended">Recommended</SelectItem>
                <SelectItem value="optional">Optional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end"><Button onClick={add}><Plus className="mr-1 h-4 w-4" />Add</Button></div>
        </div>
      </Card>
    </div>
  );
}
