import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { RippleFeed } from "@/components/ripple-feed";
import { Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/decisions")({
  head: () => ({
    meta: [
      { title: "Decision Center™ — MelaBridge" },
      { name: "description", content: "Weigh options with AI: cost, style, guest impact, and Event Health Score™ delta." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DecisionsPage,
});

const DECISIONS = [
  {
    q: "Ceremony music — string quartet or solo violin?",
    options: [
      { name: "String quartet", cost: 2400, style: 96, guests: 88, delta: 3 },
      { name: "Solo violin", cost: 900, style: 82, guests: 74, delta: 1 },
    ],
    ai: "Your BridgeDNA™ favors ensembles at intimate ceremonies. Quartet also raises Health Score by +3 based on venue acoustics.",
  },
  {
    q: "Late-night snack — pizza truck or suya station?",
    options: [
      { name: "Pizza truck", cost: 1400, style: 71, guests: 90, delta: 2 },
      { name: "Suya station", cost: 1600, style: 93, guests: 92, delta: 4 },
      { name: "Both", cost: 2900, style: 88, guests: 96, delta: 3 },
    ],
    ai: "Community data shows late-night food increases guest satisfaction 26%. Suya station aligns with your West-African + Italian fusion identity.",
  },
];

function DecisionsPage() {
  return (
    <AppShell active="/decisions">
      <PageHeader
        eyebrow="Decision Center™"
        icon={Lightbulb}
        title={<>Every decision, <span className="text-gradient">weighed intelligently</span>.</>}
        description="AI compares cost, style fit, guest impact, and Event Health Score™ delta — so you decide with full context."
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {DECISIONS.map((d) => (
            <div key={d.q} className="rounded-3xl border border-border bg-card p-6">
              <h3 className="font-display text-lg font-semibold">{d.q}</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {d.options.map((o) => (
                  <div key={o.name} className="rounded-2xl border border-border p-4">
                    <p className="font-medium">{o.name}</p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <li>Cost · ${o.cost.toLocaleString()}</li>
                      <li>Style fit · {o.style}</li>
                      <li>Guest impact · {o.guests}</li>
                      <li>Health delta · {o.delta > 0 ? `+${o.delta}` : o.delta}</li>
                    </ul>
                    <Button size="sm" variant="soft" className="mt-3 w-full">Choose</Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-2xl bg-hero-radial p-4 text-sm">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>{d.ai}</p>
              </div>
            </div>
          ))}
          <div className="rounded-3xl border border-border bg-hero-radial p-6">
            <div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><Badge className="bg-primary/10 text-primary">BridgeMind™</Badge></div>
            <p className="mt-3 text-lg">Ask anything: "What's the risk of moving the ceremony outdoors given a 40% rain chance?"</p>
            <div className="mt-4 flex gap-2">
              <input
                readOnly
                value="Ask BridgeMind™ (demo)…"
                className="flex-1 rounded-full border border-border bg-background/60 px-4 py-2 text-sm text-muted-foreground"
              />
              <Button variant="hero">Ask</Button>
            </div>
          </div>
        </div>
        <RippleFeed />
      </div>
    </AppShell>
  );
}
