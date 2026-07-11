import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles, Heart, ShieldCheck, HandCoins, Ticket, Users2, Store, Briefcase } from "lucide-react";
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
  formatPrice,
  audienceMeta,
  type BillingAudience,
  type Plan,
} from "@/lib/billing-config";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Transparent plans built for people | MelaBridge" },
      {
        name: "description",
        content:
          "Simple, honest pricing for hosts, vendors, and planners. No fees on RSVPs. No cut of donations. Cancel anytime.",
      },
      { property: "og:title", content: "MelaBridge Pricing — Transparent, fair, no surprise fees" },
      {
        property: "og:description",
        content:
          "Event organizers should keep the money they raise. Simple subscriptions, no per-RSVP fees, 0% on donations.",
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
    a: "Never. Every plan includes unlimited guest management within the plan's event limits — invitations, RSVPs, seating, dietary preferences, and reminders. You will never see a per-guest line item from MelaBridge.",
  },
  {
    q: "Do you take a cut of donations or fundraising?",
    a: "No. MelaBridge takes 0% of money raised through fundraising or donations. Only the standard payment processor fee (such as Stripe) applies to move the money.",
  },
  {
    q: "What about ticket sales?",
    a: "Paid subscribers can sell tickets without any additional MelaBridge platform fee. Only the payment processor fee applies.",
  },
  {
    q: "Do vendors pay a commission when they get booked?",
    a: "No. At launch, MelaBridge does not charge vendor booking commissions. Vendors keep 100% of what they earn. Growth comes from affordable subscriptions and premium business tools — not by taxing every booking.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Every paid plan can be cancelled in one click. No calls, no forms, no retention gauntlet. You keep access through the end of your billing period.",
  },
  {
    q: "Is there a free trial?",
    a: "Every paid Host, Vendor, and Planner plan includes a 14-day free trial. No credit card required to start.",
  },
  {
    q: "Do prices change based on my country?",
    a: "Prices are listed in USD. Local currency support and regional pricing are on the roadmap as we expand internationally.",
  },
  {
    q: "Can I switch plans later?",
    a: "Absolutely. Upgrade, downgrade, or switch audiences (host, vendor, planner) at any time. Changes prorate automatically.",
  },
];

function PricingPage() {
  const [audience, setAudience] = useState<BillingAudience>("host");
  const plans = getPlansFor(audience);

  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-glow to-primary" />
            <div className="absolute inset-1 rounded-full border border-gold/70" />
          </div>
          <span className="font-display text-xl">MelaBridge</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link to="/auth">Log in</Link>
          </Button>
          <Button variant="hero" asChild>
            <Link to="/auth">Start free</Link>
          </Button>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-4xl px-6 pb-12 pt-8 text-center">
        <Badge className="mb-5 bg-primary/10 text-primary hover:bg-primary/10">
          <Heart className="mr-1 h-3 w-3" /> Built for people, not per-transaction profit
        </Badge>
        <h1 className="font-display text-5xl leading-tight md:text-6xl">
          {billingConfig.philosophy.headline}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          {billingConfig.philosophy.body}
        </p>
      </section>

      {/* PROMISES STRIP */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
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

      {/* AUDIENCE SWITCHER */}
      <section id="plans" className="mx-auto max-w-7xl px-6">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-border bg-card p-1 shadow-soft">
            {AUDIENCE_ORDER.map((a) => {
              const Icon = audienceIcon[a];
              const active = a === audience;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-elegant"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={active}
                >
                  <Icon className="h-4 w-4" />
                  {audienceMeta[a].label}
                </button>
              );
            })}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {audienceMeta[audience].blurb}
          </p>
        </div>

        {/* PLAN CARDS */}
        <div
          className={`grid gap-6 ${
            plans.length >= 4
              ? "md:grid-cols-2 lg:grid-cols-4"
              : plans.length === 3
                ? "md:grid-cols-3"
                : plans.length === 2
                  ? "md:grid-cols-2 max-w-4xl mx-auto"
                  : "max-w-md mx-auto"
          }`}
        >
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted-foreground">
          {billingConfig.processorNote}
        </p>
      </section>

      {/* COMPARE */}
      <section className="mx-auto mt-24 max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">Compare</p>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">
            Everything you get, side by side.
          </h2>
        </div>
        <CompareTable audience={audience} />
      </section>

      {/* PHILOSOPHY BLOCK */}
      <section className="mx-auto mt-24 max-w-6xl px-6">
        <div className="grid gap-8 rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-card to-gold/5 p-10 md:grid-cols-[1.2fr_1fr] md:p-14">
          <div>
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">
              Our promise
            </Badge>
            <h2 className="font-display text-3xl leading-tight md:text-4xl">
              Revenue that comes from serving you — not from taxing your celebrations.
            </h2>
            <p className="mt-4 text-muted-foreground">
              MelaBridge grows when hosts, vendors, and planners get real value from
              affordable subscriptions and premium business tools. Not by taking a
              percentage of every RSVP, ticket, or donation. Ever.
            </p>
          </div>
          <div className="space-y-4">
            <PromiseRow icon={HandCoins} title="0% on donations & fundraising" body="Every dollar for your cause goes to your cause." />
            <PromiseRow icon={Ticket} title="No platform fee on tickets" body="Paid subscribers sell tickets with no MelaBridge cut." />
            <PromiseRow icon={ShieldCheck} title="No vendor booking commissions" body="Vendors keep 100% of what they earn at launch." />
            <PromiseRow icon={Sparkles} title="AI included in every paid plan" body="Powerful planning tools without usage-metered surprises." />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-24 max-w-3xl px-6">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">Pricing FAQ</p>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">Simple, predictable answers.</h2>
        </div>
        <Accordion type="single" collapsible className="mt-10 space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="rounded-2xl border border-border bg-card px-6"
            >
              <AccordionTrigger className="py-5 text-left text-base font-medium hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto mt-24 max-w-7xl px-6 pb-28">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-border bg-gradient-to-br from-primary via-primary to-primary-glow px-8 py-16 text-center text-primary-foreground shadow-elegant">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <h2 className="relative font-display text-4xl md:text-5xl">
            Start free. Grow with us.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/80">
            No credit card required. No hidden fees. Just a calmer way to plan the moments
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
              <Link to="/contact">Talk to sales</Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ————————————————— components ————————————————— */

function PlanCard({ plan }: { plan: Plan }) {
  const { amount, period } = formatPrice(plan);
  const featured = !!plan.featured;
  return (
    <div
      className={`relative flex flex-col rounded-3xl border p-7 ${
        featured
          ? "border-primary/40 bg-gradient-to-b from-primary/5 to-transparent shadow-elegant"
          : "border-border bg-card shadow-soft"
      }`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-gold px-3 py-1 text-xs font-semibold text-primary-foreground shadow-soft">
          Most Popular
        </div>
      )}
      <div className="text-sm font-semibold text-primary">{plan.name}</div>
      <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="font-display text-4xl">{amount}</span>
        {period && plan.price !== null && (
          <span className="text-sm text-muted-foreground">{period}</span>
        )}
      </div>
      {plan.trialDays > 0 && plan.price !== null && plan.price > 0 && (
        <p className="mt-1 text-xs text-primary">{plan.trialDays}-day free trial</p>
      )}
      {plan.includesFromPlanId && (
        <p className="mt-4 text-xs font-medium text-muted-foreground">
          Everything in {billingConfig.plans[plan.includesFromPlanId].name}, plus:
        </p>
      )}
      <ul className={`space-y-2.5 text-sm ${plan.includesFromPlanId ? "mt-3" : "mt-6"}`}>
        {plan.features.map((f) => (
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
          <Link to={plan.ctaHref}>{plan.ctaLabel}</Link>
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
  // Build a unique feature list across visible plans (preserve order)
  const featureSet: string[] = [];
  plans.forEach((p) => {
    if (p.includesFromPlanId) {
      billingConfig.plans[p.includesFromPlanId].features.forEach((f) => {
        if (!featureSet.includes(f)) featureSet.push(f);
      });
    }
    p.features.forEach((f) => {
      if (!featureSet.includes(f)) featureSet.push(f);
    });
  });

  const hasFeature = (plan: Plan, feature: string): boolean => {
    if (plan.features.includes(feature)) return true;
    if (plan.includesFromPlanId) {
      const parent = billingConfig.plans[plan.includesFromPlanId];
      // recurse one level
      if (parent.features.includes(feature)) return true;
      if (parent.includesFromPlanId) {
        return hasFeature(parent, feature);
      }
    }
    return false;
  };

  return (
    <div className="mt-10 overflow-x-auto rounded-3xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-sm">
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
