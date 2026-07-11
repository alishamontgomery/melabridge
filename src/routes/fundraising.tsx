import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { RippleFeed } from "@/components/ripple-feed";
import { HeartHandshake } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/fundraising")({
  head: () => ({
    meta: [
      { title: "Fundraising — MelaBridge" },
      { name: "description", content: "Run campaigns, track donors, and flow funds into your event budget." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FundraisingPage,
});

const CAMPAIGNS = [
  { name: "Scholarship gala 2026", raised: 42800, goal: 75000, donors: 214 },
  { name: "Community mutual aid", raised: 8900, goal: 15000, donors: 96 },
  { name: "Legacy family fund", raised: 2200, goal: 5000, donors: 21 },
];

const DONORS = [
  { name: "Anonymous", amount: 1000, when: "Today" },
  { name: "Aisha R.", amount: 250, when: "Yesterday" },
  { name: "Chen family", amount: 500, when: "Yesterday" },
  { name: "Kwame M.", amount: 100, when: "2 days ago" },
];

function FundraisingPage() {
  return (
    <AppShell active="/fundraising">
      <PageHeader
        eyebrow="Fundraising"
        icon={HeartHandshake}
        title={<>Raise, thank, and <span className="text-gradient">turn goodwill into a great event</span>.</>}
        description="Donations flow into the budget module automatically; thank-you notes draft themselves via BridgeDNA™ voice."
      />
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          {CAMPAIGNS.map((c) => {
            const pct = Math.round((c.raised / c.goal) * 100);
            return (
              <div key={c.name} className="rounded-3xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-lg font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.donors} donors</p>
                  </div>
                  <p className="font-display text-2xl font-semibold">${c.raised.toLocaleString()}<span className="text-sm text-muted-foreground"> / ${c.goal.toLocaleString()}</span></p>
                </div>
                <Progress value={pct} className="mt-4 h-2" />
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="soft">Share campaign</Button>
                  <Button size="sm" variant="ghost">Draft update</Button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Recent donors</p>
            <ul className="mt-3 divide-y divide-border">
              {DONORS.map((d) => (
                <li key={d.name + d.when} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.when}</p>
                  </div>
                  <p className="font-display font-semibold">${d.amount}</p>
                </li>
              ))}
            </ul>
          </div>
          <RippleFeed compact />
        </div>
      </section>
    </AppShell>
  );
}
