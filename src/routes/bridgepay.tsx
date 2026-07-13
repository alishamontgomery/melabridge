import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { CreditCard, ShieldCheck, Receipt, RefreshCw, Banknote, PiggyBank, Lock, Sparkles } from "lucide-react";
import { ModuleGrid, MetricRow, Section, CTARow } from "@/components/module-page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bridgepay")({
  head: () => ({
    meta: [
      { title: "BridgePay™ — MelaBridge" },
      { name: "description", content: "Secure payments powered by Stripe for every event." },
    ],
  }),
  component: BridgePayPage,
});

function BridgePayPage() {
  return (
    <AppShell active="/bridgepay">
      <div className="space-y-6">
        <PageHeader
          eyebrow="BridgePay™"
          title="Secure payments for every event"
          description="Deposits, milestone payments, vendor payouts, and refunds — powered by Stripe and reconciled with your budget in real time."
          icon={CreditCard}
          actions={<Badge variant="secondary">Beta</Badge>}
        />
        <MetricRow
          metrics={[
            { label: "Held for milestones", value: "—", hint: "Coming soon" },
            { label: "Paid to vendors", value: "—", hint: "Coming soon" },
            { label: "Pending", value: "—", hint: "Coming soon" },
            { label: "Processed via BridgePay", value: "—", hint: "Coming soon" },
          ]}
        />
        <ModuleGrid
          features={[
            { icon: Lock, title: "Milestone-based payments", detail: "Release funds to vendors only when agreed milestones are approved by both parties." },
            { icon: RefreshCw, title: "Split payments", detail: "Share costs across family, sponsors, or co-hosts with clear allocations." },
            { icon: Banknote, title: "Fast vendor payouts", detail: "Vendors receive funds shortly after milestone approval, via Stripe." },
            { icon: Receipt, title: "Automatic receipts", detail: "Every transaction is receipted and mirrored into BridgeVault™." },
            { icon: ShieldCheck, title: "Dispute support", detail: "In-app dispute flow with concierge support." },
            { icon: PiggyBank, title: "Savings goals", detail: "Set aside recurring contributions toward event milestones." },
          ]}
        />
        <Section title="Payments today">
          <Card className="border-border/60 p-6 shadow-soft">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Subscriptions are live — event-wallet payments are next</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You can already subscribe to MelaAssist™ plans with secure Stripe checkout. Milestone payments, split payments,
                  and vendor payouts arrive in the next release wave.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild variant="hero" size="sm"><Link to="/subscription">Manage subscription</Link></Button>
                  <Button asChild variant="outline" size="sm"><Link to="/budget">Track budget</Link></Button>
                </div>
              </div>
            </div>
          </Card>
        </Section>
        <CTARow label="Get notified when BridgePay launches" note="We'll email you the moment milestone payments and payouts open." cta="Notify me" />
      </div>
    </AppShell>
  );
}
