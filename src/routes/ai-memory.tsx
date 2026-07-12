import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Brain, Radio, Boxes, Network, Globe2, Dna, Vault, BarChart3, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/ai-memory")({
  head: () => ({
    meta: [
      { title: "AI & Memory — MelaBridge" },
      { name: "description", content: "The intelligence layer behind MelaBridge — Live signals, memory, twins, graph, and DNA." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AIMemoryHub,
});

const MODULES = [
  { to: "/bridgelive", label: "BridgeLive™", icon: Radio, desc: "Realtime signals across every active event — attendance, weather, sentiment." },
  { to: "/digital-twin", label: "Digital Twin™", icon: Boxes, desc: "A living simulation of your event so you can rehearse before the real thing." },
  { to: "/bridgegraph", label: "BridgeGraph™", icon: Network, desc: "Relationship graph across guests, vendors, venues, and organizations." },
  { to: "/bridgeworld", label: "BridgeWorld™", icon: Globe2, desc: "Global map of MelaBridge activity — culture, category, and geography." },
  { to: "/bridgedna", label: "BridgeDNA™", icon: Dna, desc: "The unique fingerprint of your planning style, tastes, and traditions." },
  { to: "/bridgevault", label: "BridgeVault™", icon: Vault, desc: "Long-term memory of every event, decision, and moment — searchable forever." },
  { to: "/bridge-intelligence", label: "Bridge Intelligence™", icon: BarChart3, desc: "Cross-event benchmarks, predictions, and executive insight." },
] as const;

function AIMemoryHub() {
  return (
    <AppShell active="/ai-memory">
      <div className="space-y-6">
        <PageHeader
          eyebrow="AI & Memory"
          icon={Brain}
          title="The intelligence layer of MelaBridge"
          description="Every signal, memory, and connection that makes MelaAssist™ feel less like software and more like a partner."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ to, label, icon: Icon, desc }) => (
            <Link
              key={label}
              to={to}
              className="group block rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant"
            >
              <div className="flex items-start justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-gold/15 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
              </div>
              <p className="mt-4 font-display text-lg font-semibold">{label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </Link>
          ))}
        </div>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6 shadow-soft">
          <p className="font-display text-base font-semibold">Progressive disclosure</p>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            These modules power every recommendation, forecast, and automation across MelaBridge. You don't need to open
            them to benefit — they run quietly in the background. Explore them when you want to see how a decision was
            made or replay a moment in your event's history.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
