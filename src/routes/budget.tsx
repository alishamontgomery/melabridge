import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEcosystem } from "@/lib/ecosystem-store";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Plus, Loader2 } from "lucide-react";
import { ModuleError, ModuleLoading, RouteError } from "@/components/module-states";

import { toast } from "sonner";

export const Route = createFileRoute("/budget")({
  head: () => ({
    meta: [
      { title: "Budget — MelaBridge" },
      { name: "description", content: "Track categories, spend, and payments for your event." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BudgetPage,
  errorComponent: RouteError,
});

type BudgetItem = {
  id: string;
  category: string | null;
  label: string | null;
  estimated_amount: number | null;
  actual_amount: number | null;
  paid_amount: number | null;
  vendor_name: string | null;
};

function BudgetPage() {
  const { event, hasEvent, loading: eventLoading } = useEcosystem();
  const qc = useQueryClient();
  const [openAdd, setOpenAdd] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["budget-items", event.id],
    enabled: !!event.id,
    queryFn: async (): Promise<BudgetItem[]> => {
      const { data, error } = await supabase
        .from("budget_items")
        .select("id, category, label, estimated_amount, actual_amount, paid_amount, vendor_name")
        .eq("event_id", event.id!)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BudgetItem[];
    },
  });

  const items = q.data ?? [];
  const categories = useMemo(() => {
    const map = new Map<string, { committed: number; actual: number; paid: number }>();
    for (const it of items) {
      const key = it.category?.trim() || "Uncategorized";
      const cur = map.get(key) ?? { committed: 0, actual: 0, paid: 0 };
      cur.committed += Number(it.estimated_amount ?? 0);
      cur.actual += Number(it.actual_amount ?? 0);
      cur.paid += Number(it.paid_amount ?? 0);
      map.set(key, cur);
    }
    return Array.from(map, ([name, v]) => ({ name, ...v }));
  }, [items]);

  const totalCommitted = categories.reduce((s, c) => s + c.committed, 0);
  const totalPaid = categories.reduce((s, c) => s + c.paid, 0);
  const remaining = Math.max(0, event.budget - totalPaid);

  return (
    <AppShell active="/budget">
      <PageHeader
        eyebrow="Budget"
        icon={Wallet}
        title={<>Money, <span className="text-gradient">managed with intention</span>.</>}
        description={
          hasEvent
            ? `${event.name} · $${event.budget.toLocaleString()} target · $${totalPaid.toLocaleString()} paid.`
            : "Create an event to start tracking your budget."
        }
        actions={
          hasEvent ? (
            <Button variant="hero" onClick={() => setOpenAdd(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add line item
            </Button>
          ) : null
        }
      />

      {eventLoading || (hasEvent && q.isLoading) ? (
        <ModuleLoading rows={4} />
      ) : hasEvent && q.isError ? (
        <ModuleError error={q.error} onRetry={() => q.refetch()} />
      ) : !hasEvent ? (

        <EmptyBudget message="Create an event to start tracking your budget." />
      ) : items.length === 0 ? (
        <EmptyBudget
          message="No line items yet. Add your first category to get started."
          action={<Button className="mt-5" variant="hero" onClick={() => setOpenAdd(true)}><Plus className="mr-2 h-4 w-4" />Add line item</Button>}
        />
      ) : (
        <>
          <section className="mt-8 grid gap-3 md:grid-cols-4">
            <Stat label="Budget" value={`$${event.budget.toLocaleString()}`} sub={`${event.budget > 0 ? Math.round((totalPaid / event.budget) * 100) : 0}% paid`} />
            <Stat label="Committed" value={`$${totalCommitted.toLocaleString()}`} sub={`${categories.length} categories`} />
            <Stat label="Paid" value={`$${totalPaid.toLocaleString()}`} sub="Cleared so far" />
            <Stat label="Remaining" value={`$${remaining.toLocaleString()}`} sub="Budget minus paid" />
          </section>

          <section className="mt-6 space-y-3">
            {categories.map((c) => {
              const pct = c.committed > 0 ? Math.round((c.actual / c.committed) * 100) : 0;
              const over = pct > 100;
              return (
                <button
                  type="button"
                  key={c.name}
                  onClick={() => setOpenCategory(c.name)}
                  className="block w-full rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  aria-label={`Open ${c.name} category`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ${c.actual.toLocaleString()} spent · ${c.paid.toLocaleString()} paid · committed ${c.committed.toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      className={
                        over
                          ? "bg-rose-500/10 text-rose-700"
                          : pct > 90
                          ? "bg-amber-500/10 text-amber-700"
                          : "bg-emerald-500/10 text-emerald-700"
                      }
                    >
                      {pct}%
                    </Badge>
                  </div>
                  <Progress value={Math.min(100, pct)} className="mt-3" />
                </button>
              );
            })}
          </section>
        </>
      )}

      {hasEvent && openCategory && (
        <CategoryEditorDialog
          open={!!openCategory}
          onOpenChange={(v) => { if (!v) setOpenCategory(null); }}
          category={openCategory}
          items={items.filter((it) => (it.category?.trim() || "Uncategorized") === openCategory)}
          eventId={event.id!}
          onChanged={async () => { await qc.invalidateQueries({ queryKey: ["budget-items", event.id] }); }}
        />
      )}

      {hasEvent && (
        <AddLineItemDialog
          open={openAdd}
          onOpenChange={setOpenAdd}
          eventId={event.id!}
          onAdded={async () => { await qc.invalidateQueries({ queryKey: ["budget-items", event.id] }); }}
        />
      )}
    </AppShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function EmptyBudget({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Wallet className="h-5 w-5" />
      </span>
      <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{message}</p>
      {action ?? (
        <Button asChild className="mt-5" variant="hero">
          <Link to="/events/new">
            <Plus className="mr-2 h-4 w-4" />
            Create an event
          </Link>
        </Button>
      )}
    </div>
  );
}

function AddLineItemDialog({
  open,
  onOpenChange,
  eventId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  onAdded: () => Promise<void>;
}) {
  const [category, setCategory] = useState("");
  const [label, setLabel] = useState("");
  const [vendor, setVendor] = useState("");
  const [estimated, setEstimated] = useState("");
  const [deposit, setDeposit] = useState("");
  const [paid, setPaid] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setCategory(""); setLabel(""); setVendor(""); setEstimated("");
    setDeposit(""); setPaid(""); setDueDate(""); setNotes("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) { toast.error("Description is required"); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const extra: string[] = [];
      if (deposit) extra.push(`Deposit: $${Number(deposit).toLocaleString()}`);
      if (dueDate) extra.push(`Due: ${dueDate}`);
      const combinedNotes = [notes.trim(), extra.join(" · ")].filter(Boolean).join("\n");
      const { error } = await supabase.from("budget_items").insert({
        event_id: eventId,
        category: category.trim() || "Uncategorized",
        label: label.trim(),
        vendor_name: vendor.trim() || null,
        estimated_amount: estimated ? Number(estimated) : 0,
        actual_amount: paid ? Number(paid) : 0,
        paid_amount: paid ? Number(paid) : 0,
        notes: combinedNotes || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Line item added");
      await onAdded();
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add item");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add line item</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="li-category">Category</Label>
              <Input id="li-category" placeholder="e.g. Venue" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="li-vendor">Vendor</Label>
              <Input id="li-vendor" placeholder="Optional" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="li-label">Description</Label>
            <Input id="li-label" placeholder="e.g. Ballroom deposit" value={label} onChange={(e) => setLabel(e.target.value)} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="li-est">Estimated cost</Label>
              <Input id="li-est" type="number" min="0" step="0.01" placeholder="0" value={estimated} onChange={(e) => setEstimated(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="li-dep">Deposit</Label>
              <Input id="li-dep" type="number" min="0" step="0.01" placeholder="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="li-paid">Paid</Label>
              <Input id="li-paid" type="number" min="0" step="0.01" placeholder="0" value={paid} onChange={(e) => setPaid(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="li-due">Due date</Label>
            <Input id="li-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="li-notes">Notes</Label>
            <Textarea id="li-notes" rows={3} placeholder="Optional context" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy} className="gap-1.5">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
