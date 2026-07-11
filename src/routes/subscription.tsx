import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Crown, CheckCircle2, CreditCard, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/module-page";
import {
  billingConfig,
  getPlansFor,
  formatPrice,
  audienceMeta,
  type BillingAudience,
  type Plan,
} from "@/lib/billing-config";

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

// Simulated "current plan" — in production this is loaded from the user's billing record.
const CURRENT_PLAN_ID = "host_plus" as const;

const AUDIENCE_ORDER: BillingAudience[] = ["host", "vendor", "planner"];

function SubscriptionPage() {
  const current = billingConfig.plans[CURRENT_PLAN_ID];
  const [audience, setAudience] = useState<BillingAudience>(current.audience);
  const plans = getPlansFor(audience);

  return (
    <AppShell active="/subscription">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Subscription"
          title="Your MelaBridge plan"
          description="Transparent pricing. No surprise fees. Upgrade, downgrade, or cancel anytime."
          icon={Crown}
        />

        <Card className="flex flex-wrap items-center justify-between gap-4 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-5 shadow-soft">
          <div>
            <p className="text-sm font-semibold">
              Current plan — {audienceMeta[current.audience].label.split(" ")[0]} · {current.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatPrice(current).amount}
              {formatPrice(current).period} · Renews next cycle · Visa •••• 4242
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <CreditCard className="h-4 w-4" /> Update card
            </Button>
            <Button>Manage billing</Button>
          </div>
        </Card>

        <Card className="flex items-start gap-3 border-gold/40 bg-gold/5 p-4">
          <Sparkles className="mt-0.5 h-4 w-4 text-gold" />
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{billingConfig.philosophy.headline} </span>
            No fees on RSVPs, invitations, or guest management. 0% on donations and fundraising.
            Paid plans sell tickets with no MelaBridge platform fee — only your payment processor
            (such as Stripe) charges its standard rate.
          </div>
        </Card>

        <Section title="Choose your plan">
          <div className="mb-6 inline-flex flex-wrap gap-1 rounded-full border border-border bg-card p-1">
            {AUDIENCE_ORDER.map((a) => {
              const active = a === audience;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {audienceMeta[a].label}
                </button>
              );
            })}
          </div>

          <div
            className={`grid gap-4 ${
              plans.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} currentId={CURRENT_PLAN_ID} />
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/pricing" className="underline hover:text-foreground">
              See full pricing comparison →
            </Link>
          </p>
        </Section>
      </div>
    </AppShell>
  );
}

function PlanCard({ plan, currentId }: { plan: Plan; currentId: string }) {
  const { amount, period } = formatPrice(plan);
  const isCurrent = plan.id === currentId;
  return (
    <Card
      className={`flex flex-col border p-5 shadow-soft ${
        isCurrent ? "border-primary/60 shadow-elegant" : plan.featured ? "border-primary/30" : "border-border/60"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">{plan.name}</p>
        {isCurrent ? (
          <Badge className="bg-gradient-to-r from-primary to-gold text-primary-foreground">
            Current
          </Badge>
        ) : plan.featured ? (
          <Badge variant="secondary">Most Popular</Badge>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{plan.tagline}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-3xl font-semibold">{amount}</span>
        {period && plan.price !== null && (
          <span className="text-xs text-muted-foreground">{period}</span>
        )}
      </div>
      <ul className="mt-4 mb-5 space-y-2 text-sm text-muted-foreground">
        {plan.features.slice(0, 5).map((x) => (
          <li key={x} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
      <Button variant={isCurrent ? "outline" : plan.featured ? "hero" : "default"} className="mt-auto">
        {isCurrent ? "Current plan" : plan.price === null ? "Contact sales" : "Switch to this plan"}
      </Button>
    </Card>
  );
}
