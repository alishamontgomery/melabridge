import { useState, useEffect, useRef, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRole, type AppRole } from "@/lib/use-role";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  Crown, CheckCircle2, Sparkles, ShieldCheck, ExternalLink,
  Loader2, AlertTriangle, CalendarX, RefreshCw, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Section } from "@/components/module-page";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { useStripeCheckout } from "@/hooks/use-stripe-checkout";
import { useSubscription } from "@/hooks/use-subscription";
import { useRequireAuth } from "@/lib/use-require-auth";
import { getStripeEnvironment } from "@/lib/stripe";
import {
  createPortalSession,
  cancelSubscription,
  reactivateSubscription,
} from "@/utils/payments.functions";
import { toast } from "sonner";
import {
  billingConfig,
  getPlansFor,
  getPlannerPlan,
  formatPrice,
  audienceMeta,
  findPlanByPriceId,
  type BillingAudience,
  type PlannerBillingCadence,
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
  validateSearch: (s: Record<string, unknown>) => ({
    audience: (s.audience as BillingAudience | undefined) ?? undefined,
    billing: s.billing === "annual" ? "annual" as const : "monthly" as const,
  }),
  component: SubscriptionPage,
});

const AUDIENCE_ORDER: BillingAudience[] = ["host", "vendor", "planner"];

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function fmtTrialDate(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function statusBadge(status: string, cancelAtPeriodEnd: boolean | null) {
  if (cancelAtPeriodEnd) return <Badge variant="destructive" className="text-xs">Cancellation scheduled</Badge>;
  if (status === "trialing") return <Badge className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/10 text-xs">Trial active</Badge>;
  if (status === "active") return <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 text-xs">Active</Badge>;
  if (status === "past_due") return <Badge variant="destructive" className="text-xs">Payment past due</Badge>;
  return <Badge variant="secondary" className="text-xs">{status}</Badge>;
}

function SubscriptionPage() {
  const { user } = useRequireAuth();
  const { subscription, isActive, loading, refetch } = useSubscription();
  const { openCheckout, checkoutElement, isOpen, closeCheckout } = useStripeCheckout();
  const [portalLoading, setPortalLoading] = useState(false);

  // Consent dialog before checkout
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  // Cancel dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Reactivate
  const [reactivateLoading, setReactivateLoading] = useState(false);

  const { role } = useRole();

  /**
   * Audience each user type is locked to after sign-in.
   * Admins see all tabs so they can test any plan.
   * Everyone else only sees plans for their own profile type.
   */
  const lockedAudience = useMemo((): BillingAudience | null => {
    if (role === "admin") return null;
    if (role === "vendor") return "vendor";
    // Use the app role rather than stale signup metadata after a profile switch.
    if (role === "organization") return "planner";
    return "host";
  }, [role]);

  // Legacy helper used only for admin tab defaulting.
  const roleDefaultAudience = (r: AppRole): BillingAudience =>
    r === "vendor" ? "vendor" : "host";

  const { audience: audienceParam, billing: billingParam } = Route.useSearch();
  const currentPlan = findPlanByPriceId(subscription?.price_id);
  const [billingCadence, setBillingCadence] = useState<PlannerBillingCadence>(
    billingParam ?? (currentPlan?.interval === "year" ? "annual" : "monthly"),
  );
  // When locked, always use the locked audience. Admins can switch freely.
  const initialAudience: BillingAudience =
    lockedAudience ?? audienceParam ?? currentPlan?.audience ?? roleDefaultAudience(role);
  const [audience, setAudience] = useState<BillingAudience>(initialAudience);

  const userChangedAudience = useRef(false);
  useEffect(() => {
    // Locked users: always snap to their audience (ignore URL params / subscription)
    if (lockedAudience) {
      setAudience(lockedAudience);
      return;
    }
    // Admin: URL param takes priority
    if (audienceParam) {
      setAudience(audienceParam);
      return;
    }
    if (!userChangedAudience.current && currentPlan?.audience) {
      setAudience(currentPlan.audience);
      return;
    }
    if (!userChangedAudience.current && !currentPlan) {
      setAudience(roleDefaultAudience(role));
    }
  }, [lockedAudience, audienceParam, currentPlan, role]);

  const handleAudienceChange = (next: BillingAudience) => {
    if (lockedAudience) return; // Locked users cannot switch tabs
    userChangedAudience.current = true;
    setAudience(next);
  };
  const plans = getPlansFor(lockedAudience ?? audience);
  const displayPlans = plans.map((plan) =>
    plan.audience === "planner" ? getPlannerPlan(billingCadence) : plan,
  );

  const env = (() => {
    try { return getStripeEnvironment(); } catch { return null; }
  })();

  // ── plan selection ────────────────────────────────────────────────────────
  const handleSelect = (plan: Plan) => {
    if (!user) { window.location.href = "/auth?next=/subscription"; return; }
    if (!plan.priceId) { window.location.href = plan.ctaHref; return; }
    if (currentPlan?.id === plan.id && isActive) { handleManageBilling(); return; }
    // Keep interval changes inside Stripe Billing Portal. Starting a second
    // Checkout session would look like a fresh trial and could reset eligibility.
    if (currentPlan?.audience === "planner" && isActive && currentPlan.id !== plan.id) {
      handleManageBilling();
      return;
    }
    // Show consent dialog before opening checkout for paid plans
    setPendingPlan(plan);
    setConsentChecked(false);
  };

  const handleConsentConfirm = () => {
    if (!pendingPlan?.priceId) return;
    setPendingPlan(null);
    try {
      openCheckout({
        priceId: pendingPlan.priceId,
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to open checkout");
    }
  };

  // ── portal (invoices / payment method) ───────────────────────────────────
  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const result = await createPortalSession({
        data: { returnUrl: `${window.location.origin}/subscription`, environment: getStripeEnvironment() },
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  // ── cancel ────────────────────────────────────────────────────────────────
  const handleCancelConfirm = async () => {
    if (!env) return;
    setCancelLoading(true);
    try {
      const result = await cancelSubscription({ data: { environment: env } });
      if ("error" in result) throw new Error(result.error);
      toast.success("Subscription cancelled. You'll keep access until the end of your billing period.");
      setShowCancelDialog(false);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel subscription");
    } finally {
      setCancelLoading(false);
    }
  };

  // ── reactivate ────────────────────────────────────────────────────────────
  const handleReactivate = async () => {
    if (!env) return;
    setReactivateLoading(true);
    try {
      const result = await reactivateSubscription({ data: { environment: env } });
      if ("error" in result) throw new Error(result.error);
      toast.success("Subscription reactivated! You won't be charged early — your billing cycle continues as normal.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reactivate subscription");
    } finally {
      setReactivateLoading(false);
    }
  };

  const accessEndsDate = fmtDate(subscription?.current_period_end);
  const renewsDate = fmtDate(subscription?.current_period_end);

  return (
    <AppShell active="/subscription">
      <PaymentTestModeBanner />
      <div className="space-y-6">
        <PageHeader
          eyebrow="Subscription"
          title="Your MelaBridge plan"
          description="Transparent pricing. No surprise fees. Cancel anytime."
          icon={Crown}
        />

        {/* ── Current plan card ──────────────────────────────────────────── */}
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-5 shadow-soft">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your plan…
            </div>
          ) : isActive && currentPlan ? (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-lg">{currentPlan.name}</p>
                  {statusBadge(subscription!.status, subscription!.cancel_at_period_end)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(currentPlan).amount}
                  {formatPrice(currentPlan).period} · billed {currentPlan.interval === "year" ? "yearly" : "monthly"}
                </p>
                {subscription?.cancel_at_period_end ? (
                  <p className="flex items-center gap-1.5 text-sm text-destructive font-medium">
                    <CalendarX className="h-4 w-4 shrink-0" />
                    Access ends {accessEndsDate ?? "at period end"}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {subscription?.status === "trialing"
                      ? `5-day trial ends ${renewsDate ?? ""} — then billed automatically`
                      : `Renews ${renewsDate ?? "automatically"}`}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {subscription?.cancel_at_period_end ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-primary text-primary"
                    onClick={handleReactivate}
                    disabled={reactivateLoading}
                  >
                    {reactivateLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                    Reactivate
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    <X className="h-3.5 w-3.5" /> Cancel subscription
                  </Button>
                )}

                {subscription?.stripe_customer_id && (
                  <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={portalLoading}>
                    {portalLoading
                      ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      : <ExternalLink className="mr-1.5 h-3.5 w-3.5" />}
                    Billing &amp; invoices
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-semibold text-lg">You're on the Free plan</p>
                <p className="text-sm text-muted-foreground">
                  Upgrade to unlock ticket selling, advanced AI, team collaboration, and more.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="hero"
                  className="gap-2"
                  onClick={() => {
                    document.getElementById("plan-picker")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Crown className="h-4 w-4" /> View plans
                </Button>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Secure checkout by Stripe
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card className="flex items-start gap-3 border-gold/40 bg-gold/5 p-4">
          <Sparkles className="mt-0.5 h-4 w-4 text-gold shrink-0" />
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Transparent pricing. </span>
            No per-guest fee for RSVPs, invitations, or guest management. Fundraising is not yet available.{" "}
            $0 MelaBridge fee on ticket sales.
          </div>
        </Card>

        {/* ── Inline checkout ───────────────────────────────────────────── */}
        {isOpen && (
          <Card className="overflow-hidden border-primary/20 p-0 shadow-elegant">
            <div className="flex items-center justify-between border-b border-border/60 bg-card px-5 py-3">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Secure checkout</p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeCheckout} className="text-muted-foreground">
                ✕ Cancel
              </Button>
            </div>
            <div className="p-4 sm:p-6">
              {checkoutElement}
            </div>
          </Card>
        )}

        {/* ── Plan picker ───────────────────────────────────────────────── */}
        <div id="plan-picker" className="-mt-2 pt-2" />
        <Section title="Choose your plan">
          {/* Audience tabs — shown only to admins who can freely browse all plan types */}
          {!lockedAudience ? (
            <div className="mb-6 inline-flex flex-wrap gap-1 rounded-full border border-border bg-card p-1">
              {AUDIENCE_ORDER.map((a) => {
                const active = a === audience;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => handleAudienceChange(a)}
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
          ) : (
            <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
              Showing <strong className="text-foreground mx-1">{audienceMeta[lockedAudience].label}</strong> plans for your account.
            </div>
          )}

          <div className={`grid gap-4 ${displayPlans.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
            {displayPlans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                isCurrent={currentPlan?.id === p.id && isActive}
                onSelect={handleSelect}
                billingCadence={p.audience === "planner" ? billingCadence : undefined}
                onBillingCadenceChange={p.audience === "planner" ? setBillingCadence : undefined}
              />
            ))}
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/pricing" className="underline hover:text-foreground">Full pricing comparison →</Link>
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Cancel anytime · access continues through the paid billing period ·{" "}
            <Link to="/refund" className="underline hover:text-foreground">Refund Policy</Link> ·{" "}
            <Link to="/cancellation" className="underline hover:text-foreground">Cancellation Policy</Link>
          </p>
        </Section>
      </div>

      {/* ── Consent dialog (pre-checkout) ─────────────────────────────────── */}
      <Dialog open={!!pendingPlan} onOpenChange={(o) => { if (!o) setPendingPlan(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Subscribe to {pendingPlan?.name}</DialogTitle>
            <DialogDescription>
              {pendingPlan && (
                <>
                  <strong>
                    {formatPrice(pendingPlan).amount}{formatPrice(pendingPlan).period}
                  </strong>{" "}
                  {pendingPlan.trialDays > 0
                    ? `· ${pendingPlan.trialDays}-day free trial with a payment method required. If you complete checkout today, the trial ends ${fmtTrialDate(pendingPlan.trialDays)} and the selected ${formatPrice(pendingPlan).amount}${formatPrice(pendingPlan).period} subscription starts automatically.`
                    : `· billed ${pendingPlan.interval === "year" ? "yearly" : "monthly"}.`}
                  {" "}Cancel before the trial ends to avoid the first charge; after billing starts, access continues through the paid period.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
            <Checkbox
              id="sub-consent"
              checked={consentChecked}
              onCheckedChange={(v) => setConsentChecked(!!v)}
              className="mt-0.5 shrink-0"
            />
            <Label htmlFor="sub-consent" className="text-sm leading-relaxed cursor-pointer">
              I agree to MelaBridge's{" "}
              <Link to="/terms" className="underline" target="_blank">Terms of Service</Link>,{" "}
              <Link to="/privacy" className="underline" target="_blank">Privacy Policy</Link>, and{" "}
              <Link to="/refund" className="underline" target="_blank">Refund</Link> &amp;{" "}
              <Link to="/cancellation" className="underline" target="_blank">Cancellation Policy</Link>.
            </Label>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingPlan(null)}>Back</Button>
            <Button disabled={!consentChecked} onClick={handleConsentConfirm}>
              Proceed to checkout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel confirmation dialog ────────────────────────────────────── */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancel subscription?
            </DialogTitle>
            <DialogDescription>
              Your {currentPlan?.name} plan will not renew. You'll keep full access until{" "}
              <strong>{accessEndsDate ?? "the end of your billing period"}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-2 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">What happens when you cancel:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>You keep full access until <strong>{accessEndsDate ?? "period end"}</strong></li>
              <li>No future charges</li>
              <li>Your account and data are never deleted</li>
              <li>You can reactivate any time before the access date</li>
              <li>After expiry, your account downgrades to the Free plan</li>
            </ul>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep my subscription
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={cancelLoading}
            >
              {cancelLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Yes, cancel subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// Audience-specific visual identity so vendor / planner / host cards are clearly distinct.
const AUDIENCE_THEME = {
  host: {
    border: "border-primary/30",
    ring: "ring-primary/40",
    featuredBg: "bg-primary/5",
    check: "text-primary",
    badge: "bg-primary/10 text-primary",
    btn: "hero" as const,
    label: "Most Popular",
  },
  vendor: {
    border: "border-gold/40",
    ring: "ring-gold/40",
    featuredBg: "bg-gold/8",
    check: "text-gold",
    badge: "bg-gold/15 text-amber-700",
    btn: "default" as const,
    label: "Most Popular",
  },
  planner: {
    border: "border-emerald-500/30",
    ring: "ring-emerald-500/30",
    featuredBg: "bg-emerald-500/5",
    check: "text-emerald-600",
    badge: "bg-emerald-500/15 text-emerald-700",
    btn: "default" as const,
    label: "Most Popular",
  },
} satisfies Record<BillingAudience, object>;

function PlanCard({
  plan,
  isCurrent,
  onSelect,
  billingCadence,
  onBillingCadenceChange,
}: {
  plan: Plan;
  isCurrent: boolean;
  onSelect: (plan: Plan) => void;
  billingCadence?: PlannerBillingCadence;
  onBillingCadenceChange?: (cadence: PlannerBillingCadence) => void;
}) {
  const { amount, period } = formatPrice(plan);
  const theme = AUDIENCE_THEME[plan.audience];
  const featuredBorder = isCurrent
    ? `${theme.border} ring-1 ${theme.ring}`
    : plan.featured
    ? `${theme.border} ${theme.featuredBg}`
    : "border-border/60";

  return (
    <Card className={`flex flex-col border p-5 shadow-soft ${featuredBorder}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">{plan.name}</p>
        {isCurrent ? (
          <Badge>Your plan</Badge>
        ) : plan.featured ? (
          <Badge className={`text-xs ${theme.badge}`}>{theme.label}</Badge>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{plan.tagline}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-3xl font-semibold">{amount}</span>
        {period && plan.price !== null && <span className="text-xs text-muted-foreground">{period}</span>}
      </div>
      {plan.audience === "planner" && billingCadence && onBillingCadenceChange && (
        <div className="mt-3 grid grid-cols-2 rounded-lg border border-border bg-background/60 p-1" role="group" aria-label="Planner Pro billing cadence">
          {(["monthly", "annual"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onBillingCadenceChange(option)}
              aria-pressed={billingCadence === option}
              className={`rounded-md px-2 py-1.5 text-xs font-medium ${
                billingCadence === option ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {option === "monthly" ? "Monthly · $29/month" : "Annual · $290/year"}
            </button>
          ))}
        </div>
      )}
      {plan.audience === "planner" && billingCadence === "annual" && (
        <p className="mt-2 text-xs text-primary">Save $58 versus 12 monthly payments · paid annually.</p>
      )}
      <ul className="mb-5 mt-4 space-y-2 text-sm text-muted-foreground">
        {plan.features.slice(0, 6).map((x) => (
          <li key={x} className="flex items-start gap-2">
            <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${theme.check}`} />
            <span>{x}</span>
          </li>
        ))}
      </ul>
      <Button
        variant={isCurrent ? "outline" : plan.featured ? theme.btn : "outline"}
        className="mt-auto"
        onClick={() => onSelect(plan)}
      >
        {isCurrent
          ? "Current plan"
          : plan.price === 0
          ? "Get started free"
          : "Choose plan"}
      </Button>
    </Card>
  );
}
