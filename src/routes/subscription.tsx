import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Crown, CheckCircle2, Sparkles, ShieldCheck } from "lucide-react";
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
      { name: "description", content: "Manage your MelaBridge plan and billing." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SubscriptionPage,
});

const AUDIENCE_ORDER: BillingAudience[] = ["host", "vendor", "planner"];

function SubscriptionPage() {
  // No live billing yet — everyone is on the free host tier until Stripe is wired up.
  const [audience, setAudience] = useState<BillingAudience>("host");
  const plans = getPlansFor(audience);

  return (
    <AppShell active="/subscription">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Subscription"
          title="Your MelaBridge plan"
          description="Transparent pricing. No surprise fees. Upgrade or cancel anytime."
          icon={Crown}
        />

        <Card className="flex flex-wrap items-center justify-between gap-4 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-5 shadow-soft">
          <div>
            <p className="text-sm font-semibold">You're on the Free plan</p>
            <p className="text-xs text-muted-foreground">
              Upgrade to unlock unlimited events, AI planning, and team collaboration.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Billing managed securely by Stripe
          </div>
        </Card>

        <Card className="flex items-start gap-3 border-gold/40 bg-gold/5 p-4">
          <Sparkles className="mt-0.5 h-4 w-4 text-gold" />
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{billingConfig.philosophy.headline} </span>
            No fees on RSVPs, invitations, or guest management. 0% on donations and fundraising.
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

          <div className={`grid gap-4 ${plans.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} />
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/pricing" className="underline hover:text-foreground">See full pricing comparison →</Link>
          </p>
        </Section>
      </div>
    </AppShell>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const { amount, period } = formatPrice(plan);
  return (
    <Card className={`flex flex-col border p-5 shadow-soft ${plan.featured ? "border-primary/30" : "border-border/60"}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">{plan.name}</p>
        {plan.featured && <Badge variant="secondary">Most Popular</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">{plan.tagline}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-3xl font-semibold">{amount}</span>
        {period && plan.price !== null && <span className="text-xs text-muted-foreground">{period}</span>}
      </div>
      <ul className="mt-4 mb-5 space-y-2 text-sm text-muted-foreground">
        {plan.features.slice(0, 5).map((x) => (
          <li key={x} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
      <Button variant={plan.featured ? "hero" : "default"} className="mt-auto" disabled title="Checkout launches when Stripe billing is enabled">
        {plan.price === null ? "Contact sales" : "Choose plan"}
      </Button>
    </Card>
  );
}
