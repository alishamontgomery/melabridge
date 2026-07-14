import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useEcosystem } from "@/lib/ecosystem-store";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Plus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/budget")({
  head: () => ({
    meta: [
      { title: "Budget — MelaBridge" },
      { name: "description", content: "Track categories, spend, and payments for your event." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BudgetPage,
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
    const map = new Map<string, { planned: number; actual: number; paid: number }>();
    for (const it of items) {
      const key = it.category?.trim() || "Uncategorized";
      const cur = map.get(key) ?? { planned: 0, actual: 0, paid: 0 };
      cur.planned += Number(it.estimated_amount ?? 0);
      cur.actual += Number(it.actual_amount ?? 0);
      cur.paid += Number(it.paid_amount ?? 0);
      map.set(key, cur);
    }
    return Array.from(map, ([name, v]) => ({ name, ...v }));
  }, [items]);

  const totalPlanned = categories.reduce((s, c) => s + c.planned, 0);
  const totalActual = categories.reduce((s, c) => s + c.actual, 0);
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
            <Button asChild variant="hero">
              <Link to="/events/$eventId" params={{ eventId: event.id! }}>
                <Plus className="mr-2 h-4 w-4" />
                Add line item
              </Link>
            </Button>
          ) : null
        }
      />

      {eventLoading || (hasEvent && q.isLoading) ? (
        <div className="mt-8 grid min-h-[240px] place-items-center rounded-3xl border border-border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !hasEvent ? (
        <EmptyBudget message="Create an event to start tracking your budget." />
      ) : items.length === 0 ? (
        <EmptyBudget message="No line items yet. Add categories and expenses from your event detail page." eventId={event.id!} />
      ) : (
        <>
          <section className="mt-8 grid gap-3 md:grid-cols-4">
            <Stat label="Total budget" value={`$${event.budget.toLocaleString()}`} sub={`${event.budget > 0 ? Math.round((totalPaid / event.budget) * 100) : 0}% paid`} />
            <Stat label="Planned" value={`$${totalPlanned.toLocaleString()}`} sub={`${categories.length} categories`} />
            <Stat label="Actual" value={`$${totalActual.toLocaleString()}`} sub={`vs $${totalPlanned.toLocaleString()} planned`} />
            <Stat label="Remaining" value={`$${remaining.toLocaleString()}`} sub="Budget minus paid" />
          </section>

          <section className="mt-6 space-y-3">
            {categories.map((c) => {
              const pct = c.planned > 0 ? Math.round((c.actual / c.planned) * 100) : 0;
              const over = pct > 100;
              return (
                <div key={c.name} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ${c.actual.toLocaleString()} spent · ${c.paid.toLocaleString()} paid · planned ${c.planned.toLocaleString()}
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
                </div>
              );
            })}
          </section>
        </>
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

function EmptyBudget({ message, eventId }: { message: string; eventId?: string }) {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Wallet className="h-5 w-5" />
      </span>
      <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{message}</p>
      <Button asChild className="mt-5" variant="hero">
        {eventId ? (
          <Link to="/events/$eventId" params={{ eventId }}>
            <Plus className="mr-2 h-4 w-4" />
            Open event
          </Link>
        ) : (
          <Link to="/events/new">
            <Plus className="mr-2 h-4 w-4" />
            Create an event
          </Link>
        )}
      </Button>
    </div>
  );
}
