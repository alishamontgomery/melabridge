import { BrandMark } from "@/components/brand-logo";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check, Sparkles, Heart, ShieldCheck, HandCoins, Ticket,
  Users2, Store, Briefcase, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SiteFooter } from "@/components/site-footer";
import {
  billingConfig,
  getPlansFor,
  getPublicCatalogPlans,
  formatPrice,
  audienceMeta,
  getPlannerPlan,
  type BillingAudience,
  type PlannerBillingCadence,
  type Plan,
} from "@/lib/billing-config";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Transparent plans built for people | MelaBridge" },
      {
        name: "description",
        content:
          "Simple pricing for hosts, vendors, and planners. Start free or choose paid business tools, with no MelaBridge platform fee on eligible ticket sales.",
      },
      { property: "og:title", content: "MelaBridge Pricing — Transparent, fair, no surprise fees" },
      {
        property: "og:description",
        content:
          "Plans for hosts, vendors, and planners, with $0 MelaBridge platform fee on eligible ticket sales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

const AUDIENCE_ORDER: BillingAudience[] = ["host", "vendor", "planner"];

const audienceIcon = {
  host: Users2,
  vendor: Store,
  planner: Briefcase,
} as const;

const faqs = [
  {
    q: "Do you charge per RSVP or per guest?",
    a: "Never. Every plan includes unlimited guest-list management — RSVP status, plus-ones, meal choices, and notes. You will never see a per-guest line item from MelaBridge.",
  },
  {
    q: "Does MelaBridge support fundraising?",
    a: "Not yet. Fundraising campaigns are on the roadmap. Today, organizers can manually record contributions in the event budget.",
  },
  {
    q: "What about ticket sales?",
    a: "MelaBridge charges $0 platform fee on ticket sales. Only the standard third-party payment processor fee applies. Eligible workspaces can sell tickets, create ticket types, manage attendees, and use QR code check-in.",
  },
  {
    q: "Does MelaBridge take a cut when vendors and planners connect?",
    a: "No. MelaBridge does not take a marketplace commission. The marketplace is lead-based, and any agreement or payment between a planner and vendor is handled directly between them.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your Subscription page. You keep access through the end of your billing period.",
  },
  {
    q: "Is there a free trial?",
    a: "Planner Pro includes one 5-day free trial for eligible professional planners. A valid payment method is required at signup. If you do not cancel before the disclosed trial end date, the selected $29 monthly or $290 yearly subscription starts automatically after the trial. My Event and Vendor Profile are free plans and do not require checkout.",
  },
  {
    q: "What is MelaBridge's refund policy?",
    a: "Paid subscription charges are generally non-refundable. Planner Pro includes one 5-day trial with a payment method required at signup; cancel before the disclosed trial end date to avoid the first charge. Duplicate or incorrect charges will be reviewed.",
  },
  {
    q: "Do prices change based on my country?",
    a: "Prices are listed in USD. Local currency support and regional pricing are on the roadmap as we expand internationally.",
  },
  {
    q: "Can I switch plans later?",
    a: "You can manage an eligible Planner Pro subscription from your Subscription page. Stripe shows the applicable timing and charge before you confirm any billing change.",
  },
];

function PricingPage() {
  const [audience, setAudience] = useState<BillingAudience>("host");
  const plans = audience === "host" ? getPublicCatalogPlans() : getPlansFor(audience);

  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark size="md" />
          <span className="font-display text-xl">MelaBridge</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/auth">Log in</Link>
          </Button>
          <Button variant="hero" size="sm" asChild>
            <Link to="/auth">Start free</Link>
          </Button>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-4xl px-4 pb-10 pt-6 text-center sm:px-6 sm:pb-12 sm:pt-8">
        <Badge className="mb-5 bg-primary/10 text-primary hover:bg-primary/10">
          <Heart className="mr-1 h-3 w-3" /> Built for people, not per-transaction profit
        </Badge>
        <h1 className="font-display text-4xl leading-tight sm:text-5xl md:text-6xl">
          {billingConfig.philosophy.headline}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:mt-5 sm:text-lg">
          {billingConfig.philosophy.body}
        </p>
      </section>

      {/* PROMISES STRIP */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 sm:pb-16">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {billingConfig.promises.map((p) => (
            <div
              key={p.title}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AUDIENCE SWITCHER + PLAN CARDS */}
      <section id="plans" className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8 flex flex-col items-center gap-4">
          {/* Tabs — wrap on narrow screens */}
          <div className="inline-flex w-full max-w-xl flex-wrap justify-center gap-1 rounded-full border border-border bg-card p-1 shadow-soft">
            {AUDIENCE_ORDER.map((a) => {
              const Icon = audienceIcon[a];
              const active = a === audience;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setAudience(a);
                    trackEvent("pricing_audience_selected", { audience: a });
                  }}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition min-w-[120px] ${
                    active
                      ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-elegant"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={active}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{audienceMeta[a].label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {audienceMeta[audience].blurb}
          </p>
        </div>

        {/* PLAN CARDS — always ≤2 cols on mobile */}
        <div
          className={`grid gap-5 ${
            plans.length >= 3
              ? "sm:grid-cols-2 lg:grid-cols-3"
              : plans.length === 2
                ? "sm:grid-cols-2 max-w-3xl mx-auto"
                : "max-w-sm mx-auto"
          }`}
        >
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>

        {/* Processor note */}
        <p className="mx-auto mt-5 max-w-2xl text-center text-xs text-muted-foreground">
          {billingConfig.processorNote}
        </p>

        {/* Policy summary bar */}
        <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-border bg-card px-5 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-primary shrink-0" />
              Cancel anytime
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
              5-day Planner Pro trial before first charge
            </span>
            <span className="flex items-center gap-1">
              <Ticket className="h-3 w-3 text-primary shrink-0" />
              $0 MelaBridge ticket fee
            </span>
            <span>Third-party processing fees may apply</span>
            <span className="flex gap-2">
              <Link to="/refund" className="underline hover:text-foreground">Refund Policy</Link>
              <Link to="/cancellation" className="underline hover:text-foreground">Cancellation</Link>
              <Link to="/terms" className="underline hover:text-foreground">Terms</Link>
              <Link to="/privacy" className="underline hover:text-foreground">Privacy</Link>
            </span>
          </div>
        </div>
      </section>

      {/* COMPARE */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:mt-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">Compare</p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl md:text-4xl">
            Everything you get, side by side.
          </h2>
        </div>
        <CompareTable audience={audience} />
      </section>

      {/* PHILOSOPHY BLOCK */}
      <section className="mx-auto mt-20 max-w-6xl px-4 sm:mt-24 sm:px-6">
        <div className="grid gap-8 rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-card to-gold/5 p-8 md:grid-cols-[1.2fr_1fr] md:p-14">
          <div>
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">
              Our promise
            </Badge>
            <h2 className="font-display text-2xl leading-tight sm:text-3xl md:text-4xl">
              Revenue that comes from serving you — not from taxing your celebrations.
            </h2>
            <p className="mt-4 text-muted-foreground">
              MelaBridge grows when hosts, vendors, and planners get real value from
              affordable subscriptions and premium business tools. Not by taking a
              percentage of every RSVP or ticket sold through an eligible paid plan.
            </p>
          </div>
          <div className="space-y-4">
            <PromiseRow icon={HandCoins} title="Straightforward subscriptions" body="Choose the plan that fits your role and upgrade only when you need more." />
            <PromiseRow icon={Ticket} title="$0 MelaBridge ticket platform fee" body="Paid subscribers sell tickets with no MelaBridge cut. Third-party processing fees apply." />
            <PromiseRow icon={ShieldCheck} title="No vendor booking commissions" body="Lead-based model — vendors keep 100% of what they earn." />
            <PromiseRow icon={Sparkles} title="AI included in every paid plan" body="Powerful planning tools without usage-metered surprises." />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-20 max-w-3xl px-4 sm:mt-24 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">Pricing FAQ</p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl md:text-4xl">Simple, predictable answers.</h2>
        </div>
        <Accordion type="single" collapsible className="mt-10 space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="rounded-2xl border border-border bg-card px-5 sm:px-6"
            >
              <AccordionTrigger className="py-5 text-left text-sm font-medium hover:no-underline sm:text-base">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto mt-20 max-w-7xl px-4 pb-24 sm:mt-24 sm:px-6 sm:pb-28">
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary via-primary to-primary-glow px-6 py-14 text-center text-primary-foreground shadow-elegant sm:rounded-[2.5rem] sm:px-8 sm:py-16">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <h2 className="relative font-display text-3xl sm:text-4xl md:text-5xl">
            Start free. Grow with us.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
            Free plans do not require a card. No hidden fees. Just a calmer way to plan the moments
            that matter.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="gold" size="xl" asChild>
              <Link to="/auth">Start free</Link>
            </Button>
            <Button
              variant="soft"
              size="xl"
              className="border-white/20 bg-white/10 text-primary-foreground hover:bg-white/20"
              asChild
            >
              <Link to="/contact">Contact us</Link>
            </Button>
          </div>
          <p className="relative mt-5 text-xs text-primary-foreground/60">
            5-day Planner Pro trial · Cancel before renewal · No marketplace commissions
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ————————————————— components ————————————————— */

function PlanCard({ plan }: { plan: Plan }) {
  const [cadence, setCadence] = useState<PlannerBillingCadence>("monthly");
  const selectedPlan = plan.audience === "planner" ? getPlannerPlan(cadence) : plan;
  const { amount, period } = formatPrice(selectedPlan);
  const featured = !!selectedPlan.featured;
  // Pass account type to the auth page so the correct signup flow is pre-selected.
  const ctaSearch =
    selectedPlan.audience === "vendor" ? { type: "vendor" as const } :
    selectedPlan.audience === "planner" ? { type: "planner" as const, next: `/subscription?audience=planner&billing=${cadence}` } :
    undefined;
  return (
    <div
      className={`relative flex flex-col rounded-3xl border p-6 sm:p-7 ${
        featured
          ? "border-primary/40 bg-gradient-to-b from-primary/5 to-transparent shadow-elegant"
          : "border-border bg-card shadow-soft"
      }`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-gold px-3 py-1 text-xs font-semibold text-primary-foreground shadow-soft whitespace-nowrap">
          Most Popular
        </div>
      )}
      <div className="text-sm font-semibold text-primary">{selectedPlan.name}</div>
      <p className="mt-1 text-sm text-muted-foreground">{selectedPlan.tagline}</p>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="font-display text-4xl">{amount}</span>
        {period && selectedPlan.price !== null && (
          <span className="text-sm text-muted-foreground">{period}</span>
        )}
      </div>
      {selectedPlan.audience === "planner" && (
        <>
          <div className="mt-4 grid grid-cols-2 rounded-lg border border-border bg-background/60 p-1" role="group" aria-label="Planner Pro billing cadence">
            {(["monthly", "annual"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setCadence(option);
                  trackEvent("pricing_cadence_selected", { cadence: option });
                }}
                aria-pressed={cadence === option}
                className={`rounded-md px-2 py-2 text-xs font-medium transition ${
                  cadence === option ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "monthly" ? "Monthly · $29/month" : "Annual · $290/year"}
              </button>
            ))}
          </div>
          {cadence === "annual" && (
            <p className="mt-2 text-xs text-primary">Save $58 versus 12 monthly payments · paid annually.</p>
          )}
        </>
      )}
      {selectedPlan.trialDays > 0 && selectedPlan.price !== null && selectedPlan.price > 0 && (
        <p className="mt-1 text-xs text-primary">
          {selectedPlan.trialDays}-day free trial · payment method required · first charge after the trial unless canceled
        </p>
      )}
      <ul className="mt-6 space-y-2.5 text-sm">
        {selectedPlan.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 pt-2">
        <Button
          variant={featured ? "hero" : "outline"}
          size="lg"
          className="w-full"
          asChild
        >
          {selectedPlan.ctaHref === "/contact" ? (
            <Link
              to="/contact"
              onClick={() =>
                trackEvent("pricing_plan_cta_clicked", {
                  audience: selectedPlan.audience,
                  plan: selectedPlan.id,
                  billing: selectedPlan.audience === "planner" ? cadence : "none",
                })
              }
            >
              {selectedPlan.ctaLabel}
            </Link>
          ) : selectedPlan.priceId ? (
            <Link
              to="/auth"
              search={{
                type: "planner",
                next: `/subscription?audience=planner&billing=${cadence}`,
              }}
              onClick={() =>
                trackEvent("pricing_plan_cta_clicked", {
                  audience: selectedPlan.audience,
                  plan: selectedPlan.id,
                  billing: cadence,
                })
              }
            >
              {selectedPlan.ctaLabel}
            </Link>
          ) : (
            <Link
              to="/auth"
              search={ctaSearch ?? {}}
              onClick={() =>
                trackEvent("pricing_plan_cta_clicked", {
                  audience: selectedPlan.audience,
                  plan: selectedPlan.id,
                  billing: "none",
                })
              }
            >
              {selectedPlan.ctaLabel}
            </Link>
          )}
        </Button>
      </div>
    </div>
  );
}

function PromiseRow({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/60 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function CompareTable({ audience }: { audience: BillingAudience }) {
  const plans = getPlansFor(audience);
  const featureSet: string[] = [];
  plans.forEach((p) => {
    if (p.includesFromPlanId) {
      const parent = billingConfig.plans[p.includesFromPlanId];
      if (parent) {
        parent.features.forEach((f) => {
          if (!featureSet.includes(f)) featureSet.push(f);
        });
      }
    }
    p.features.forEach((f) => {
      if (!featureSet.includes(f)) featureSet.push(f);
    });
  });

  const hasFeature = (plan: Plan, feature: string): boolean => {
    if (plan.features.includes(feature)) return true;
    if (plan.includesFromPlanId) {
      const parent = billingConfig.plans[plan.includesFromPlanId];
      if (parent) {
        if (parent.features.includes(feature)) return true;
        if (parent.includesFromPlanId) {
          return hasFeature(parent, feature);
        }
      }
    }
    return false;
  };

  return (
    <div className="mt-10 overflow-x-auto rounded-3xl border border-border bg-card">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="p-4 text-left font-semibold text-muted-foreground">Feature</th>
            {plans.map((p) => (
              <th key={p.id} className="p-4 text-center font-semibold">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {featureSet.map((f) => (
            <tr key={f} className="border-b border-border/60 last:border-b-0">
              <td className="p-4 text-left text-muted-foreground">{f}</td>
              {plans.map((p) => (
                <td key={p.id} className="p-4 text-center">
                  {hasFeature(p, f) ? (
                    <Check className="mx-auto h-4 w-4 text-primary" />
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
