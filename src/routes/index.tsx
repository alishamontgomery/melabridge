import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sparkles,
  Store,
  Wallet,
  UsersRound,
  Check,
  Play,
  ArrowRight,
  Briefcase,
  ShieldCheck,
  TrendingUp,
  CalendarCheck,
  MessageSquare,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { SiteFooter } from "@/components/site-footer";
import { EventDashboardPreview } from "@/components/event-dashboard-preview";
import {
  getPlan,
  formatPrice,
  getPlannerPlan,
  type PlannerBillingCadence,
} from "@/lib/billing-config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MelaBridge — Plan Every Moment, Together" },
      {
        name: "description",
        content:
          "MelaBridge brings event details, guest lists, vendor discovery, budgets, tasks, and AI-assisted planning into one organized workspace.",
      },
      { property: "og:title", content: "MelaBridge — Plan Every Moment, Together" },
      {
        property: "og:description",
        content:
          "MelaBridge brings event details, guest lists, vendor discovery, budgets, tasks, and AI-assisted planning into one organized workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

/* ————————————————————————————————————————
   Data
   ———————————————————————————————————————— */

const platformFeatures = [
  {
    icon: Sparkles,
    title: "AI Planner",
    desc: "Editable starting drafts for tasks, budgets, runsheets, vendor needs, and event details.",
  },
  {
    icon: Store,
    title: "Marketplace",
    desc: "Discover vendors and venues by category, location, and profile, then save favorites or contact them directly.",
  },
  {
    icon: Wallet,
    title: "Budget & Tracking",
    desc: "Set a target, track planned and paid amounts, and see what remains as plans change.",
  },
  {
    icon: UsersRound,
    title: "Team access",
    desc: "Invite collaborators and share event files with the people helping you plan.",
  },
];

// ── Audience-specific benefit lists ──────────────────────────────────────────

const hostBenefits = [
  "Plan events for yourself & family",
  "Guest lists, RSVP status & meal notes",
  "Budget tracking with line items",
  "Checklist & day-of event timeline",
  "MelaAssist AI planning assistant",
  "Vendor discovery & marketplace access",
  "Event pages & ticket sales",
  "Shared planning with family & team",
];

const vendorBenefits = [
  "Business profile visible in marketplace",
  "Service categories and portfolio showcase",
  "Portfolio photos showcasing your work",
  "Service categories and package management",
  "Direct contact from planners and hosts",
  "Public profile and portfolio updates",
  "MelaAssist AI for your business profile",
];

const plannerBenefits = [
  "Manage multiple clients & events",
  "Team collaboration tools",
  "Guest lists and RSVP status per event",
  "MelaAssist AI for every client event",
  "Sell tickets & manage attendees",
  "Vendor coordination per client event",
  "Budget tracking per client",
];




const faqs = [
  {
    q: "How is MelaBridge different from the tools I already use?",
    a: "MelaBridge connects event details, guests, budgets, vendors, tickets, files, and day-of operations in one workspace, with AI-assisted starting drafts you can edit.",
  },
  {
    q: "Do I need to be technical to use the AI planner?",
    a: "No. You describe your event in plain language. The AI drafts the timeline, budget categories, vendor needs and event details — you review and adjust.",
  },
  {
    q: "Who is MelaBridge for?",
    a: "Anyone who plans events. People organizing their own celebrations, professional event planners managing multiple clients, event-service providers building their business, and community groups coordinating gatherings — each with a tailored experience.",
  },
  {
    q: "Is my guest and payment data safe?",
    a: "Always. Data is encrypted at rest and in transit, never sold, and never used to train external models.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Every paid plan can be cancelled in one click — no calls, no forms.",
  },
];

/* ————————————————————————————————————————
   Small building blocks
   ———————————————————————————————————————— */

import { SiteHeader } from "@/components/site-header";
function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-widest text-primary">{children}</p>;
}

function AudienceSection({
  eyebrow,
  title,
  description,
  benefits,
  cta,
  icon: Icon,
  reverse = false,
  accent = "primary",
  ctaType,
}: {
  eyebrow: string;
  title: string;
  description: string;
  benefits: string[];
  cta: string;
  icon: React.ComponentType<{ className?: string }>;
  reverse?: boolean;
  accent?: "primary" | "gold";
  /** When set, the CTA link passes ?type=<ctaType> to pre-select the account type on the auth page. */
  ctaType?: "vendor" | "planner";
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 md:py-28">
      <div
        className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${
          reverse ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        <div>
          <SectionEyebrow>{eyebrow}</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">{title}</h2>
          <p className="mt-4 max-w-xl text-muted-foreground">{description}</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-3 w-3" />
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <Button variant={accent === "gold" ? "gold" : "hero"} size="lg" asChild>
              <Link to="/auth" search={ctaType ? { type: ctaType } : {}}>
                {cta} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Visual */}
        <div className="relative">
          <div
            className={`relative overflow-hidden rounded-[2rem] border border-border bg-card p-8 shadow-elegant ${
              accent === "gold"
                ? "bg-gradient-to-br from-gold/10 via-card to-card"
                : "bg-gradient-to-br from-primary/5 via-card to-card"
            }`}
          >
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
            <div className="relative flex h-full min-h-[320px] flex-col justify-between gap-8">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft">
                <Icon className="h-6 w-6" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {benefits.slice(0, 4).map((b, i) => (
                  <div
                    key={b}
                    className="rounded-xl border border-border/70 bg-background/60 p-4 backdrop-blur"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      0{i + 1}
                    </div>
                    <div className="mt-1 text-sm font-medium leading-snug">{b}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ————————————————————————————————————————
   Page
   ———————————————————————————————————————— */

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {/* HERO */}
      <section className="bg-hero-radial relative">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 pt-14 pb-20 sm:px-6 md:pt-24 md:pb-28">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
              Friendly AI planning for real-life events
            </div>
            <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl md:text-7xl">
              Plan your event faster.
              <br />
              <span className="text-gradient">Enjoy it sooner.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Tell MelaAssist what you’re planning. Get an editable starting plan, then keep
              guests, budget, vendors, tasks, and event-day details together.
            </p>
            <div className="mx-auto mt-8 flex w-full max-w-sm flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
              <Button variant="hero" size="xl" className="w-full sm:w-auto" asChild>
                <Link to="/auth">Start planning free</Link>
              </Button>
              <Button
                variant="soft"
                size="xl"
                className="w-full gap-2 sm:w-auto"
                onClick={() => {
                  const el = document.getElementById("dashboard-preview");
                  if (!el) return;
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                  el.classList.add("ring-2", "ring-primary/40", "ring-offset-4", "ring-offset-background");
                  setTimeout(() => {
                    el.classList.remove(
                      "ring-2",
                      "ring-primary/40",
                      "ring-offset-4",
                      "ring-offset-background",
                    );
                  }, 1800);
                }}
              >
                <Play className="h-4 w-4 fill-current" /> See the workspace
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {["Guest & RSVP tracking", "Vendor marketplace", "Budgets & runsheets", "Ticketing & check-in"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE PRODUCT DASHBOARD (single instance) */}
      <section
        id="dashboard-preview"
        className="relative border-y border-border bg-secondary/30 py-20 transition-shadow duration-500 md:py-28"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>The MelaBridge dashboard</SectionEyebrow>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl">Your complete event workspace.</h2>
            <p className="mt-4 text-muted-foreground">
              A calm, organized workspace for budgets, guest lists, vendors, tasks, timelines, and AI-assisted starting drafts.
            </p>
          </div>
          <div className="mt-14 w-full">
            <EventDashboardPreview />
          </div>
        </div>
      </section>

      {/* WHERE EVERY DETAIL COMES TOGETHER */}
      <section id="platform" className="mx-auto max-w-7xl px-6 py-28">
        <div className="mx-auto max-w-3xl text-center">
          <SectionEyebrow>The platform</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl">
            Where every detail comes together.
          </h2>
          <p className="mt-5 text-muted-foreground">
            One organized workspace for AI-assisted planning, vendor discovery, budgets, tasks,
              guest lists, and timelines — for hosts, families, professional planners, vendors,
              venues, and organizations.
          </p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {platformFeatures.map((f) => (
            <div
              key={f.title}
              className="group relative rounded-2xl border border-border bg-card p-7 transition-all hover:-translate-y-0.5 hover:shadow-soft"
            >
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOSTS & FAMILIES */}
      <div id="hosts">
        <AudienceSection
          eyebrow="For hosts & families"
          title="Plan every celebration beautifully."
          description="Weddings, birthdays, graduations, and family reunions — organize guests, budgets, timelines, vendors, files, and AI-assisted starting drafts in one workspace."
          benefits={hostBenefits}
          cta="Start planning free"
          icon={UsersRound}
          reverse
        />
      </div>

      {/* VENDORS & BUSINESSES */}
      <div id="vendors" className="bg-secondary/40">
        <AudienceSection
          eyebrow="For vendors & businesses"
          title="Get discovered. Win more business."
           description="Join the marketplace where hosts and professional planners search for vendors like you. Showcase your services and packages, keep your profile current, and let planners contact you directly."
          benefits={vendorBenefits}
          cta="Join as a vendor"
          icon={Briefcase}
          accent="gold"
          ctaType="vendor"
        />
      </div>

      {/* PROFESSIONAL PLANNERS */}
      <div id="planners">
        <AudienceSection
          eyebrow="For professional planners"
          title="Every client. Every event. One workspace."
          description="Stop juggling spreadsheets, emails, and separate tools for each client. MelaBridge is built for professional planners and coordinators managing multiple events — so every detail stays connected."
          benefits={plannerBenefits}
          cta="Start your 5-day free trial"
          icon={ShieldCheck}
          reverse
          ctaType="planner"
        />
      </div>

      {/* AI PLANNING */}
      <section className="mx-auto max-w-7xl px-6 py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionEyebrow>AI planning</SectionEyebrow>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl">
              An AI that plans <span className="text-gradient">with you</span>, not for you.
            </h2>
            <p className="mt-4 text-muted-foreground">
              MelaAssist™ helps turn your event details into an editable starting plan.
              It can draft tasks, budget categories, a day-of runsheet, vendor needs,
              and event details for you to review.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "Natural-language planning — describe your vision, get a structured plan back",
                "AI-drafted tasks, budget categories, runsheets, and vendor needs",
                "Guest-message drafts that wait for your approval",
                "Every suggestion remains editable and under your control",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-3 w-3" />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <Button variant="hero" size="lg" asChild>
                <Link to="/ai-planning">
                  Explore AI planning <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary/8 via-card to-card p-8 shadow-elegant">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
              <div className="relative space-y-4">
                {[
                  { icon: Zap, title: "Drafted a starter checklist and timeline", meta: "ready to edit" },
                  { icon: CalendarCheck, title: "Built a runsheet around the event start time", meta: "ready to review" },
                  { icon: TrendingUp, title: "Created starter budget categories", meta: "ready to customize" },
                  { icon: MessageSquare, title: "Drafted a guest update", meta: "approval required" },
                ].map((row) => (
                  <div
                    key={row.title}
                    className="flex items-center gap-4 rounded-xl border border-border/70 bg-background/70 p-4 backdrop-blur"
                  >
                    <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                      <row.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-medium leading-snug">{row.title}</div>
                      <div className="text-xs text-muted-foreground">{row.meta}</div>
                    </div>
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                ))}
                <p className="pt-1 text-center text-[11px] text-muted-foreground/60">
                  Illustrative examples — actual results vary by event and usage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BUDGET TRACKING */}
      <section className="hidden bg-gradient-to-b from-background to-secondary/40 py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="relative order-2 lg:order-1">
              <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-8 shadow-elegant">
                <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">
                        Event budget
                      </div>
                      <div className="mt-1 font-display text-3xl">$42,180</div>
                      <div className="text-xs text-muted-foreground">of $48,000 planned</div>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      On track
                    </span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-primary to-primary-glow" />
                  </div>
                  <div className="mt-8 grid grid-cols-3 gap-3">
                    {[
                      { label: "Line items", value: "24" },
                      { label: "Categories", value: "8" },
                      { label: "Remaining", value: "$5.8k" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border border-border bg-background/60 p-4">
                        <div className="font-display text-2xl">{s.value}</div>
                        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <SectionEyebrow>Budgets & spending</SectionEyebrow>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl">
                Every dollar, exactly where you left it.
              </h2>
              <p className="mt-4 text-muted-foreground">
                 Add line items, assign categories, track estimated vs. paid amounts, and see
                 exactly where your budget stands as your plans change.
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                   "Track estimated & paid amounts",
                  "Category-based breakdown",
                  "Line-by-line cost visibility",
                  "Warning when planned expenses exceed your budget",
                  "Linked to your event workspace",
                  "Exportable budget records",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-gold/20 text-gold-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <Button variant="gold" size="lg" asChild>
                  <Link to="/auth">
                    Start tracking your budget <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Pricing</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl">
            Clear plans for every kind of event team.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Plans for hosts, vendors, and professional planners. Start with the free host
            plan, then upgrade when you need paid business tools. Payment processing fees
            may apply to ticket sales.
          </p>
        </div>

        {/* One representative card per audience */}
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              { planId: "host_free", audienceLabel: "Hosts & Families" },
              { planId: "vendor_starter", audienceLabel: "Vendors & Businesses" },
              { planId: "planner_professional", audienceLabel: "Professional Planners" },
            ] as const
          ).map(({ planId, audienceLabel }) => {
            const p = getPlan(planId);
            if (p.audience === "planner") {
              return <HomepagePlannerPlanCard key={p.id} plan={p} audienceLabel={audienceLabel} />;
            }
            const { amount, period } = formatPrice(p);
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-3xl border p-6 sm:p-8 ${
                  p.featured
                    ? "border-primary/40 bg-gradient-to-b from-primary/5 to-transparent shadow-elegant"
                    : "border-border bg-card"
                }`}
              >
                {planId === "planner_professional" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-primary to-gold px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  {audienceLabel}
                </p>
                <div className="mt-1 text-sm font-semibold text-primary">{p.name}</div>
                <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-4xl sm:text-5xl">{amount}</span>
                  {period && p.price !== null && (
                    <span className="text-muted-foreground">{period}</span>
                  )}
                </div>
                {p.trialDays > 0 && p.price !== null && p.price > 0 && (
                  <p className="mt-1 text-xs text-primary">
                    {p.trialDays}-day free trial · payment method required
                  </p>
                )}
                <ul className="mt-6 space-y-2.5 text-sm">
                  {p.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 pt-2">
                  <Button
                    variant={p.featured ? "hero" : "soft"}
                    size="lg"
                    className="w-full"
                    asChild
                  >
                    <Link to={p.ctaHref}>{p.ctaLabel}</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
          Vendor plans start at $0 (Starter) ·{" "}
          <Link to="/pricing" className="underline hover:text-foreground">
            See all plans and full pricing →
          </Link>
        </p>
      </section>


      {/* WHO IT'S FOR */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Who it's for</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl">Built for everyone who plans.</h2>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: UsersRound,
              title: "Hosts & families",
              desc: "Plan celebrations, milestones, and gatherings with everything organized in one place.",
            },
            {
              icon: ShieldCheck,
              title: "Professional planners",
              desc: "Manage events, clients, vendors, timelines, and planning details from one workspace.",
            },
            {
              icon: Briefcase,
              title: "Vendors & venues",
              desc: "Showcase your business, get discovered, and connect with people actively planning events.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-border bg-card p-7 transition-all hover:-translate-y-0.5 hover:shadow-soft"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                <card.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-secondary/40 py-28">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <SectionEyebrow>Start planning</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl">
            Make the plan. Keep the joy.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Start free, build an editable plan with AI, and bring in paid tools only when they help you do more.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="hero" size="lg"><Link to="/auth">Start planning free</Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/auth" search={{ type: "vendor" }}>Join as a vendor or venue</Link></Button>
          </div>
        </div>
      </section>


      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-28">
        <div className="text-center">
          <SectionEyebrow>FAQ</SectionEyebrow>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl">Answers before you ask.</h2>
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
      <section className="hidden mx-auto max-w-7xl px-6 py-28">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-border bg-gradient-to-br from-primary via-primary to-primary-glow px-8 py-20 text-center text-primary-foreground shadow-elegant">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <h2 className="relative font-display text-3xl sm:text-4xl md:text-6xl">
            Your next moment is waiting.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Join hosts, planners, vendors, and venues building better events together
            with MelaBridge.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="gold" size="xl" asChild>
              <Link to="/auth">Start planning free</Link>
            </Button>
            <Button
              variant="soft"
              size="xl"
              className="bg-white/10 text-primary-foreground border-white/20 hover:bg-white/20"
              asChild
            >
              <Link to="/auth">Log in</Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function HomepagePlannerPlanCard({
  plan,
  audienceLabel,
}: {
  plan: ReturnType<typeof getPlan>;
  audienceLabel: string;
}) {
  const [cadence, setCadence] = useState<PlannerBillingCadence>("monthly");
  const selectedPlan = getPlannerPlan(cadence);
  const { amount, period } = formatPrice(selectedPlan);
  const next = `/subscription?audience=planner&billing=${cadence}`;

  return (
    <div className="relative flex flex-col rounded-3xl border border-primary/40 bg-gradient-to-b from-primary/5 to-transparent p-6 shadow-elegant sm:p-8">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-primary to-gold px-3 py-1 text-xs font-semibold text-primary-foreground">
        Most Popular
      </div>
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{audienceLabel}</p>
      <div className="mt-1 text-sm font-semibold text-primary">{selectedPlan.name}</div>
      <p className="mt-1 text-sm text-muted-foreground">{selectedPlan.tagline}</p>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="font-display text-4xl sm:text-5xl">{amount}</span>
        <span className="text-muted-foreground">{period}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 rounded-lg border border-border bg-background/60 p-1" role="group" aria-label="Planner Pro billing cadence">
        {(["monthly", "annual"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCadence(option)}
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
      <p className="mt-1 text-xs text-primary">
        5-day free trial · payment method required · first charge after the trial unless canceled
      </p>
      <ul className="mt-6 space-y-2.5 text-sm">
        {selectedPlan.features.slice(0, 5).map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 pt-2">
        <Button variant="hero" size="lg" className="w-full" asChild>
          <Link to="/auth" search={{ type: "planner", next }}>
            {selectedPlan.ctaLabel} <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
