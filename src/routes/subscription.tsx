import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Crown, CheckCircle2, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/module-page";

export const Route = createFileRoute("/subscription")({
  head: () => ({
    meta: [
      { title: "Subscription — MelaBridge" },
      { name: "description", content: "Manage your MelaBridge plan, seats, and billing." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SubscriptionPage,
});

const PLANS = [
  { n: "Starter", p: "Free", f: ["1 active event", "Guest portal", "Community insights"] },
  { n: "Pro", p: "$18/mo", current: true, f: ["Unlimited events", "Bridge Concierge™", "Event Simulator™", "BridgeVault™"] },
  { n: "Studio", p: "$49/mo", f: ["Everything in Pro", "Team collaboration", "Custom branding", "Priority concierge"] },
  { n: "Enterprise", p: "Contact", f: ["SSO & SCIM", "AdminOS™", "Dedicated success manager", "SLA"] },
];

function SubscriptionPage() {
  return (
    <AppShell active="/subscription">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Subscription"
          title="Your MelaBridge plan"
          description="Upgrade or manage seats. Cancel anytime."
          icon={Crown}
        />
        <Card className="flex flex-wrap items-center justify-between gap-4 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-5 shadow-soft">
          <div>
            <p className="text-sm font-semibold">Current plan — Pro</p>
            <p className="text-xs text-muted-foreground">Renews Jan 14, 2027 · Visa •••• 4242</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2"><CreditCard className="h-4 w-4" /> Update card</Button>
            <Button>Manage billing</Button>
          </div>
        </Card>
        <Section title="Choose your plan">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <Card
                key={p.n}
                className={`flex flex-col border p-5 shadow-soft ${
                  p.current ? "border-primary/60 shadow-elegant" : "border-border/60"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold">{p.n}</p>
                  {p.current && <Badge className="bg-gradient-to-r from-primary to-gold text-primary-foreground">Current</Badge>}
                </div>
                <p className="mb-4 font-display text-3xl font-semibold">{p.p}</p>
                <ul className="mb-5 space-y-2 text-sm text-muted-foreground">
                  {p.f.map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
                <Button variant={p.current ? "outline" : "default"} className="mt-auto">
                  {p.current ? "Current plan" : "Upgrade"}
                </Button>
              </Card>
            ))}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
