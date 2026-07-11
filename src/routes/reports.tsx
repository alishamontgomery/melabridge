import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { RippleFeed } from "@/components/ripple-feed";
import { useEcosystem } from "@/lib/ecosystem-store";
import { FileBarChart, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — MelaBridge" },
      { name: "description", content: "Analytics across every event and every module — export anytime." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

const bars = [12, 18, 24, 31, 28, 34, 42, 48, 45, 52, 61, 67];

function ReportsPage() {
  const { event, health, budgetPct } = useEcosystem();
  return (
    <AppShell active="/reports">
      <PageHeader
        eyebrow="Reports"
        icon={FileBarChart}
        title={<>Every event, <span className="text-gradient">measured</span>.</>}
        description="Cross-event analytics across guests, budget, engagement, and health. Every module feeds this view."
        actions={<Button variant="soft" className="gap-1"><Download className="h-4 w-4" /> Export CSV</Button>}
      />
      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <Card k="Events tracked" v="7" />
        <Card k="Avg health score" v={`${health}`} />
        <Card k="Budget adherence" v={`${100 - Math.max(0, budgetPct - 100)}%`} />
        <Card k="Guest satisfaction" v="4.7 / 5" />
      </section>
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Engagement — {event.name}</p>
          <h3 className="font-display text-lg font-semibold">Weekly activity across all modules</h3>
          <div className="mt-6 flex h-40 items-end gap-2">
            {bars.map((v, i) => (
              <div key={i} className="flex-1">
                <div className="w-full rounded-t-md bg-gradient-to-t from-primary to-gold" style={{ height: `${v}%` }} title={`Week ${i + 1}`} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>W1</span><span>W6</span><span>W12</span></div>
        </div>
        <RippleFeed />
      </section>
    </AppShell>
  );
}

function Card({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{k}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{v}</p>
    </div>
  );
}
