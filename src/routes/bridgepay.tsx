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
      { name: "description", content: "Secure payments, escrow, and vendor payouts for every event." },
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
          title="One wallet for every event payment"
          description="Deposits, escrow, split payments, vendor payouts, and refunds — protected end-to-end and reconciled with your budget in real time."
          icon={CreditCard}
          actions={<Badge variant="secondary">Preview</Badge>}
        />
        <MetricRow
          metrics={[
            { label: "In escrow", value: "—", hint: "Coming soon" },
            { label: "Paid to vendors", value: "—", hint: "Coming soon" },
            { label: "Pending", value: "—", hint: "Coming soon" },
            { label: "Saved via BridgePay", value: "—", hint: "Coming soon" },
          ]}
        />
        <ModuleGrid
          features={[
            { icon: Lock, title: "Escrow protection", detail: "Funds release only when milestones are approved by both parties." },
            { icon: RefreshCw, title: "Split payments", detail: "Share costs across family, sponsors, or co-hosts with clear allocations." },
            { icon: Banknote, title: "Instant vendor payouts", detail: "Vendors receive funds within hours of milestone approval." },
            { icon: Receipt, title: "Automatic receipts", detail: "Every transaction is receipted and mirrored into BridgeVault™." },
            { icon: ShieldCheck, title: "Dispute mediation", detail: "In-app dispute flow with concierge support." },
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
                  You can already subscribe to MelaAssist™ plans with secure Stripe checkout. Escrow, split payments,
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
        <CTARow label="Get notified when BridgePay launches" note="We'll email you the moment escrow and payouts open." cta="Notify me" />
      </div>
    </AppShell>
  );
}
