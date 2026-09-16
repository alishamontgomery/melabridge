import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { PublicShell } from "@/components/public-shell";
import { CreditCard, ShieldCheck, Receipt, RefreshCw, Banknote, Lock, Sparkles } from "lucide-react";
import { ModuleGrid, MetricRow, Section } from "@/components/module-page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bridgepay")({
  head: () => ({
    meta: [
      { title: "BridgePay™ — MelaBridge" },
      { name: "description", content: "Stripe-powered subscription and eligible ticket checkout in MelaBridge." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BridgePayPage,
});

function BridgePayPage() {
  return (
    <PublicShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="BridgePay™"
          title="Stripe checkout for subscriptions and tickets"
          description="Manage a MelaBridge subscription or sell tickets from an eligible paid plan. Vendor payments, fundraising, and shared event wallets are not yet available."
          icon={CreditCard}
          actions={<Badge variant="secondary">Beta</Badge>}
        />
        <MetricRow
          metrics={[
            { label: "Processor", value: "Stripe", hint: "Secure checkout" },
            { label: "Subscriptions", value: "Live", hint: "Monthly and annual plans" },
            { label: "Ticket checkout", value: "Live", hint: "Eligible paid plans" },
            { label: "MelaBridge ticket fee", value: "$0", hint: "Processor fees may apply" },
          ]}
        />
        <ModuleGrid
          features={[
            { icon: Lock, title: "Subscription checkout", detail: "Start or change an eligible MelaBridge plan through Stripe checkout." },
            { icon: CreditCard, title: "Paid tickets", detail: "Create paid ticket types and send buyers through Stripe checkout." },
            { icon: Receipt, title: "Ticket order records", detail: "Track completed ticket orders and attendee quantities in MelaBridge." },
            { icon: Banknote, title: "Budget payment tracking", detail: "Record planned costs and amounts paid in the event budget." },
          ]}
        />
        <Section title="Payments today">
          <Card className="border-border/60 p-6 shadow-soft">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Subscriptions and eligible ticket checkout are available today</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Vendor milestone payments, deposits, payouts, fundraising, and shared event wallets remain on the roadmap.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild variant="hero" size="sm"><Link to="/subscription" search={{ audience: undefined }}>Manage subscription</Link></Button>
                  <Button asChild variant="outline" size="sm"><Link to="/budget">Track budget</Link></Button>
                </div>
              </div>
            </div>
          </Card>
        </Section>
      </div>
    </PublicShell>
  );
}
