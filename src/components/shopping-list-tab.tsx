import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, Trash2, Plus, ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapEventPlan } from "@/lib/event-bootstrap.functions";

type Row = Database["public"]["Tables"]["event_shopping_items"]["Row"];

export function ShoppingListTab({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ item: "", quantity: "", category: "General" });
  const bootstrap = useServerFn(bootstrapEventPlan);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("event_shopping_items")
      .select("*")
      .eq("event_id", eventId)
      .order("category", { ascending: true })
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
      toast.success("Shopping list drafted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate shopping list");
    } finally { setBusy(false); }
  }

  async function add() {
    const item = draft.item.trim();
    if (!item) return;
    const { error } = await supabase.from("event_shopping_items").insert({
      event_id: eventId,
      item,
      quantity: draft.quantity.trim() || null,
      category: draft.category.trim() || "General",
      sort_order: items?.length ?? 0,
    });
    if (error) { toast.error(error.message); return; }
    setDraft({ item: "", quantity: "", category: draft.category });
    await load();
  }

  async function togglePurchased(row: Row) {
    const { error } = await supabase
      .from("event_shopping_items")
      .update({ purchased: !row.purchased })
      .eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    await load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("event_shopping_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await load();
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of items ?? []) {
      const k = r.category || "General";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries());
  }, [items]);

  const total = items?.length ?? 0;
  const done = items?.filter((i) => i.purchased).length ?? 0;

  if (items === null) {
    return (
      <div className="grid min-h-[20vh] place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border-border/60 p-8 text-center shadow-soft">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <h3 className="font-display text-xl font-semibold">No shopping list yet</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          MelaAssist can draft a complete shopping list tailored to your event — everything you need to buy or bring, organized by category.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={generate} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate shopping list
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{done}</span> of{" "}
          <span className="font-semibold text-foreground">{total}</span> items purchased
        </div>
        <Button variant="outline" size="sm" onClick={generate} disabled={busy} className="gap-1.5">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Add AI suggestions
        </Button>
      </div>

      <Card className="border-border/60 p-4 shadow-soft">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_140px_auto]">
          <Input placeholder="Item (e.g. Table numbers)" value={draft.item} onChange={(e) => setDraft({ ...draft, item: e.target.value })} />
          <Input placeholder="Quantity" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
          <Input placeholder="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
          <Button onClick={add} className="gap-1.5"><Plus className="h-4 w-4" />Add</Button>
        </div>
      </Card>

      <div className="space-y-4">
        {grouped.map(([category, rows]) => (
          <Card key={category} className="border-border/60 p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">{category}</h3>
              <Badge variant="outline" className="text-xs">{rows.filter(r => r.purchased).length}/{rows.length}</Badge>
            </div>
            <ul className="divide-y divide-border/50">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-2">
                  <Checkbox checked={row.purchased} onCheckedChange={() => togglePurchased(row)} />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm ${row.purchased ? "line-through text-muted-foreground" : ""}`}>{row.item}</div>
                    {row.quantity && <div className="text-xs text-muted-foreground">{row.quantity}</div>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(row.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
