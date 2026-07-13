import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Crown, CheckCircle2, Sparkles, ShieldCheck, ExternalLink, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/module-page";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { useStripeCheckout } from "@/hooks/use-stripe-checkout";
import { useSubscription } from "@/hooks/use-subscription";
import { useRequireAuth } from "@/lib/use-require-auth";
import { getStripeEnvironment } from "@/lib/stripe";
import { createPortalSession } from "@/utils/payments.functions";
import { toast } from "sonner";
import {
  billingConfig,
  getPlansFor,
  formatPrice,
  audienceMeta,
  findPlanByPriceId,
  type BillingAudience,
  type Plan,
} from "@/lib/billing-config";

export const Route = createFileRoute("/subscription")({
  head: () => ({
    meta: [
      { title: "Subscription — MelaBridge" },
      { name: "description", content: "Manage your MelaAssist™ plan and billing." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SubscriptionPage,
});

const AUDIENCE_ORDER: BillingAudience[] = ["host", "vendor", "planner"];

function SubscriptionPage() {
  const { user } = useRequireAuth();
  const { subscription, isActive, loading } = useSubscription();
  const { openCheckout, checkoutElement, isOpen, closeCheckout } = useStripeCheckout();
  const [portalLoading, setPortalLoading] = useState(false);

  const currentPlan = findPlanByPriceId(subscription?.price_id);
  const initialAudience: BillingAudience = currentPlan?.audience ?? "host";
  const [audience, setAudience] = useState<BillingAudience>(initialAudience);
  const plans = getPlansFor(audience);

  const handleSelect = (plan: Plan) => {
    if (!user) {
      window.location.href = "/auth?next=/subscription";
      return;
    }
    if (!plan.priceId) {
      window.location.href = plan.ctaHref;
      return;
    }
    if (currentPlan?.id === plan.id && isActive) {
      handleManage();
      return;
    }
    try {
      openCheckout({
        priceId: plan.priceId,
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to open checkout");
    }
  };

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const result = await createPortalSession({
        data: {
          returnUrl: `${window.location.origin}/subscription`,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <AppShell active="/subscription">
      <PaymentTestModeBanner />
      <div className="space-y-6">
        <PageHeader
          eyebrow="Subscription"
          title="Your MelaAssist™ plan"
          description="Transparent pricing. No surprise fees. Upgrade or cancel anytime."
          icon={Crown}
        />

        <Card className="flex flex-wrap items-center justify-between gap-4 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-5 shadow-soft">
          <div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading your plan…</p>
            ) : isActive && currentPlan ? (
              <>
                <p className="text-sm font-semibold">
                  You're on the {currentPlan.name} plan
                  {subscription?.status === "trialing" && " (trial)"}
                  {subscription?.cancel_at_period_end && " · cancels at period end"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {subscription?.current_period_end
                    ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                    : "Active"}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">You're on the Free plan</p>
                <p className="text-xs text-muted-foreground">
                  Upgrade to unlock unlimited events, AI planning, and team collaboration.
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isActive && subscription?.stripe_customer_id && (
              <Button variant="outline" size="sm" onClick={handleManage} disabled={portalLoading}>
                {portalLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="mr-2 h-3.5 w-3.5" />}
                Manage billing
              </Button>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Billing managed by Stripe
            </div>
          </div>
        </Card>

        <Card className="flex items-start gap-3 border-gold/40 bg-gold/5 p-4">
          <Sparkles className="mt-0.5 h-4 w-4 text-gold" />
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{billingConfig.philosophy.headline} </span>
            No fees on RSVPs, invitations, or guest management. 0% on donations and fundraising.
          </div>
        </Card>

        {isOpen && (
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Complete checkout</p>
              <Button variant="ghost" size="sm" onClick={closeCheckout}>Cancel</Button>
            </div>
            {checkoutElement}
          </Card>
        )}

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
              <PlanCard
                key={p.id}
                plan={p}
                isCurrent={currentPlan?.id === p.id && isActive}
                onSelect={handleSelect}
              />
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

function PlanCard({
  plan,
  isCurrent,
  onSelect,
}: {
  plan: Plan;
  isCurrent: boolean;
  onSelect: (plan: Plan) => void;
}) {
  const { amount, period } = formatPrice(plan);
  return (
    <Card
      className={`flex flex-col border p-5 shadow-soft ${
        isCurrent ? "border-primary ring-1 ring-primary/40" : plan.featured ? "border-primary/30" : "border-border/60"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">{plan.name}</p>
        {isCurrent ? (
          <Badge>Your plan</Badge>
        ) : plan.featured ? (
          <Badge variant="secondary">Most Popular</Badge>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{plan.tagline}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-3xl font-semibold">{amount}</span>
        {period && plan.price !== null && <span className="text-xs text-muted-foreground">{period}</span>}
      </div>
      <ul className="mb-5 mt-4 space-y-2 text-sm text-muted-foreground">
        {plan.features.slice(0, 5).map((x) => (
          <li key={x} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
      <Button
        variant={isCurrent ? "outline" : plan.featured ? "hero" : "default"}
        className="mt-auto"
        onClick={() => onSelect(plan)}
      >
        {isCurrent ? "Manage plan" : plan.price === 0 ? "Current tier" : plan.price === null ? "Contact sales" : "Choose plan"}
      </Button>
    </Card>
  );
}
