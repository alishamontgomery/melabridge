import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { RippleFeed } from "@/components/ripple-feed";
import { useEcosystem } from "@/lib/ecosystem-store";
import { Progress } from "@/components/ui/progress";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/budget")({
  head: () => ({
    meta: [
      { title: "Budget — MelaBridge" },
      { name: "description", content: "Live budget wired to guests, vendors, and community benchmarks." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BudgetPage,
});

const CATS = [
  { cat: "Venue", pct: 32, spent: 22000, note: "Villa d'Este" },
  { cat: "Catering", pct: 21, spent: 14300, note: "Onyema · plates auto-scale with guests" },
  { cat: "Photography", pct: 9, spent: 6200, note: "Studio Nero" },
  { cat: "Florals & décor", pct: 12, spent: 4800, note: "Bloomhaus pending" },
  { cat: "Music", pct: 5, spent: 3200, note: "DJ Kairo" },
  { cat: "Attire", pct: 8, spent: 5200, note: "" },
  { cat: "Reserve", pct: 13, spent: 0, note: "Contingency" },
];

function BudgetPage() {
  const { event, budgetPct, perGuest } = useEcosystem();
  return (
    <AppShell active="/budget">
      <PageHeader
        eyebrow="Budget"
        icon={Wallet}
        title={<>Every dollar, <span className="text-gradient">accountable and adaptive</span>.</>}
        description="Guest count, vendor confirmations, and benchmarks all reshape this budget in real time."
      />
      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          { k: "Total budget", v: `$${event.budget.toLocaleString()}` },
          { k: "Committed", v: `$${event.spent.toLocaleString()}` },
          { k: "% used", v: `${budgetPct}%` },
          { k: "Per guest", v: `$${perGuest}` },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.k}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{s.v}</p>
          </div>
        ))}
      </section>
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Allocations</p>
          <ul className="mt-3 space-y-4">
            {CATS.map((c) => (
              <li key={c.cat}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.cat}</span>
                  <span className="text-muted-foreground">${c.spent.toLocaleString()} · {c.pct}%</span>
                </div>
                <Progress value={c.pct * 3} className="mt-1 h-2" />
                {c.note && <p className="mt-1 text-xs text-muted-foreground">{c.note}</p>}
              </li>
            ))}
          </ul>
        </div>
        <RippleFeed />
      </section>
    </AppShell>
  );
}
