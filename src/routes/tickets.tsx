import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { RippleFeed } from "@/components/ripple-feed";
import { Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/tickets")({
  head: () => ({
    meta: [
      { title: "Tickets — MelaBridge" },
      { name: "description", content: "Sell tickets and admissions — check-in, tiers, and payouts integrated with the ecosystem." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TicketsPage,
});

const TIERS = [
  { name: "General admission", price: 65, sold: 184, cap: 250 },
  { name: "VIP · Front row", price: 180, sold: 42, cap: 60 },
  { name: "Table of 8", price: 480, sold: 12, cap: 20 },
];

function TicketsPage() {
  const total = TIERS.reduce((a, t) => a + t.price * t.sold, 0);
  return (
    <AppShell active="/tickets">
      <PageHeader
        eyebrow="Tickets"
        icon={Ticket}
        title={<>Sell admissions <span className="text-gradient">without leaving the plan</span>.</>}
        description="Every sale updates the guest list, budget, and Bridge Intelligence™ benchmarks."
      />
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card k="Gross sales" v={`$${total.toLocaleString()}`} />
        <Card k="Tickets sold" v={TIERS.reduce((a, t) => a + t.sold, 0)} />
        <Card k="Conversion" v="34.2%" />
      </section>
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {TIERS.map((t) => {
              const pct = Math.round((t.sold / t.cap) * 100);
              return (
                <li key={t.name} className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">${t.price} · {t.sold}/{t.cap} sold</p>
                    </div>
                    <Badge className="bg-primary/10 text-primary">{pct}%</Badge>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-accent">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-gold" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="soft">Share link</Button>
                    <Button size="sm" variant="ghost" className="gap-1"><Users className="h-3 w-3" /> View buyers</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <RippleFeed />
      </section>
    </AppShell>
  );
}

function Card({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{k}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{v}</p>
    </div>
  );
}
