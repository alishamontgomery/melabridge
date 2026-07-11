import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { CreditCard, Wallet, ShieldCheck, Receipt, RefreshCw, Banknote, PiggyBank, Lock } from "lucide-react";
import { ModuleGrid, MetricRow, Section, CTARow } from "@/components/module-page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
        />
        <MetricRow
          metrics={[
            { label: "In escrow", value: "$12,450", hint: "Released on milestones" },
            { label: "Paid to vendors", value: "$8,920" },
            { label: "Pending", value: "$1,800", hint: "2 invoices" },
            { label: "Saved via BridgePay", value: "$640", hint: "Fee waivers" },
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
        <Section title="Recent activity">
          <Card className="divide-y divide-border/60 border-border/60 shadow-soft">
            {[
              { d: "Deposit — Garden Venue", a: "-$2,500", s: "Escrow", tone: "text-foreground" },
              { d: "Milestone released — Florist", a: "-$1,200", s: "Paid", tone: "text-foreground" },
              { d: "Split contribution — Family", a: "+$800", s: "Received", tone: "text-primary" },
              { d: "Refund — Cancelled add-on", a: "+$150", s: "Refunded", tone: "text-primary" },
            ].map((r) => (
              <div key={r.d} className="flex items-center justify-between p-4 text-sm">
                <div className="flex items-center gap-3">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span>{r.d}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-[10px]">{r.s}</Badge>
                  <span className={`font-medium ${r.tone}`}>{r.a}</span>
                </div>
              </div>
            ))}
          </Card>
        </Section>
        <CTARow label="Connect your payout account" note="Verify once — used across every event." cta="Verify account" />
      </div>
    </AppShell>
  );
}
