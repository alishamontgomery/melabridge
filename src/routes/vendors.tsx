import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { RippleFeed } from "@/components/ripple-feed";
import { useEcosystem } from "@/lib/ecosystem-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Store, Check, Clock, Sparkles } from "lucide-react";

export const Route = createFileRoute("/vendors")({
  head: () => ({
    meta: [
      { title: "Vendors — MelaBridge" },
      { name: "description", content: "Source, contract, and pay vendors — each confirmation ripples through your plan." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VendorsPage,
});

const VENDORS = [
  { name: "Bloomhaus Florals", cat: "Florist", status: "Pending", amount: 4800, dnaScore: 96 },
  { name: "Studio Nero", cat: "Photography", status: "Confirmed", amount: 6200, dnaScore: 98 },
  { name: "Onyema Catering", cat: "Catering", status: "Confirmed", amount: 14300, dnaScore: 94 },
  { name: "DJ Kairo", cat: "Music", status: "Confirmed", amount: 3200, dnaScore: 91 },
  { name: "Paperlane", cat: "Stationery", status: "Pending", amount: 1400, dnaScore: 88 },
];

function VendorsPage() {
  const { confirmVendor } = useEcosystem();
  return (
    <AppShell active="/vendors">
      <PageHeader
        eyebrow="Vendors"
        icon={Store}
        title={<>The right people, <span className="text-gradient">already vetted for you</span>.</>}
        description="BridgeDNA™ ranks matches from your favorites and community reviews. Confirming a vendor cascades to the timeline, budget, and collaboration feed."
      />

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {VENDORS.map((v) => (
              <li key={v.name} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.cat} · ${v.amount.toLocaleString()}</p>
                </div>
                <Badge className="bg-primary/10 text-primary gap-1"><Sparkles className="h-3 w-3" /> DNA {v.dnaScore}</Badge>
                {v.status === "Confirmed" ? (
                  <Badge className="bg-emerald-500/10 text-emerald-700 gap-1"><Check className="h-3 w-3" /> Confirmed</Badge>
                ) : (
                  <Badge className="bg-amber-500/10 text-amber-700 gap-1"><Clock className="h-3 w-3" /> Pending</Badge>
                )}
                {v.status !== "Confirmed" && (
                  <Button size="sm" variant="hero" onClick={() => confirmVendor(v.name)}>Confirm</Button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <RippleFeed />
      </section>
    </AppShell>
  );
}
