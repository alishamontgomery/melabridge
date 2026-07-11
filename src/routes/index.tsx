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
  Users,
  Wallet,
  ScaleIcon,
  UsersRound,
  Check,
  Star,
  Play,
  ArrowRight,
  Briefcase,
  Building2,
  ShieldCheck,
  TrendingUp,
  CalendarCheck,
  MessageSquare,
  BarChart3,
  MapPin,
  Zap,
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { EventDashboardPreview } from "@/components/event-dashboard-preview";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MelaBridge — The AI-Powered Event Planning Platform" },
      {
        name: "description",
        content:
          "One intelligent platform connecting your AI planner, vendors, venues, guests, budgets and payments — so every event comes together beautifully.",
      },
      { property: "og:title", content: "MelaBridge — Where Every Event Comes Together" },
      {
        property: "og:description",
        content:
          "Replace the ten apps you use to plan an event with one AI-native platform for planners, vendors, venues and guests.",
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
    desc: "Your planning partner from first idea to final thank-you note.",
  },
  {
    icon: Store,
    title: "Marketplace",
    desc: "Discover trusted vendors and venues, curated to your event.",
  },
  {
    icon: Users,
    title: "Guest Portal",
    desc: "Invitations, RSVPs, updates and communication in one place.",
  },
  {
    icon: Wallet,
    title: "BridgePay™",
    desc: "Collect payments, manage budgets and track every dollar.",
  },
  {
    icon: ScaleIcon,
    title: "Decision Center™",
    desc: "Compare options side-by-side and choose with confidence.",
  },
  {
    icon: UsersRound,
    title: "Collaboration",
    desc: "Family, team and vendors — working together in one workspace.",
  },
];

const vendorBenefits = [
  "Qualified leads matched by AI",
  "Calendar & availability management",
  "In-app messaging with clients",
  "Online contracts & e-signatures",
  "Portfolio, reviews & analytics",
  "Faster payouts via BridgePay™",
  "Premium business profile",
  "Subscription revenue tools",
];

const plannerBenefits = [
  "Unlimited events & clients",
  "Branded client dashboards",
  "AI-drafted plans & timelines",
  "Team collaboration & roles",
  "Vendor coordination inbox",
  "Live budget tracking",
  "Full guest management",
  "Milestones on one timeline",
];

const venueBenefits = [
  "Showcase real-time availability",
  "Receive qualified booking requests",
  "Coordinate on-site vendors",
  "Share tiered pricing & packages",
  "Capacity & room management",
  "Event timelines & run-of-show",
  "Interactive floor plans",
  "Analytics on inquiries & revenue",
];

const testimonials = [
  {
    quote:
      "MelaBridge replaced the spreadsheets, group chats and four planning tools we used to juggle. It's the calmest launch we've had.",
    name: "Amara Okonkwo",
    role: "Bride, Lagos",
  },
  {
    quote:
      "We run 40+ corporate events a year. MelaBridge cut planning time in half and gave our clients a dashboard they actually love.",
    name: "David Chen",
    role: "Head of Events, Northwind",
  },
  {
    quote:
      "The vendor marketplace alone paid for our subscription in the first month. Leads arrive already qualified.",
    name: "Priya Menon",
    role: "Founder, Bloom & Bough Florals",
  },
];


const faqs = [
  {
    q: "How is MelaBridge different from the tools I already use?",
    a: "Instead of stitching together a planner, a spreadsheet, a group chat, a vendor directory and a payment app, MelaBridge is a single AI-native workspace where every decision, message and dollar lives in one place.",
  },
  {
    q: "Do I need to be technical to use the AI planner?",
    a: "No. You describe your event in plain language. The AI drafts the timeline, budget, vendor shortlist and guest communications — you review and adjust.",
  },
  {
    q: "Can vendors, planners and venues really share the same platform?",
    a: "Yes. Each side gets a dedicated experience — hosts plan, vendors sell, planners manage clients, venues receive bookings — all connected through one ecosystem.",
  },
  {
    q: "Is my guest and payment data safe?",
    a: "Always. Data is encrypted at rest and in transit, never sold, and never used to train external models. BridgePay™ is PCI-compliant.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Every paid plan can be cancelled in one click — no calls, no forms.",
  },
];

/* ————————————————————————————————————————
   Small building blocks
   ———————————————————————————————————————— */

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-8 w-8">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-glow to-primary" />
        <div className="absolute inset-1 rounded-full border border-gold/70" />
        <div className="absolute inset-2.5 rounded-full bg-gold" />
      </div>
      <span className="font-display text-xl font-semibold tracking-tight">MelaBridge</span>
    </div>
  );
}

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
}: {
  eyebrow: string;
  title: string;
  description: string;
  benefits: string[];
  cta: string;
  icon: React.ComponentType<{ className?: string }>;
  reverse?: boolean;
  accent?: "primary" | "gold";
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
          <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">{title}</h2>
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
              <Link to="/auth">
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
      {/* NAV */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#platform" className="text-sm text-muted-foreground hover:text-foreground">
              Platform
            </a>
            <a href="#vendors" className="text-sm text-muted-foreground hover:text-foreground">
              Vendors
            </a>
            <a href="#planners" className="text-sm text-muted-foreground hover:text-foreground">
              Planners
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="rounded-full" asChild>
              <Link to="/auth">Log in</Link>
            </Button>
            <Button variant="hero" size="sm" className="rounded-full" asChild>
              <Link to="/auth">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-hero-radial relative">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 pt-14 pb-20 sm:px-6 md:pt-24 md:pb-28">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
              The AI-native event platform · now in early access
            </div>
            <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl md:text-7xl">
              Plan Every Moment.
              <br />
              <span className="text-gradient">Together.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              MelaBridge replaces the ten apps, spreadsheets and group chats you use to plan an
              event — with one AI-powered workspace for hosts, planners, vendors and venues.
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
                <Play className="h-4 w-4 fill-current" /> Watch demo
              </Button>
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
            <h2 className="mt-3 font-display text-4xl md:text-5xl">This is the actual product.</h2>
            <p className="mt-4 text-muted-foreground">
              A calm, intelligent workspace where budget, guests, vendors, tasks and your AI
              planner work together in real time.
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
          <h2 className="mt-3 font-display text-4xl md:text-5xl">
            Where every detail comes together.
          </h2>
          <p className="mt-5 text-muted-foreground">
            One intelligent platform connecting your AI planner, vendors, venues, guests, budgets,
            payments, tickets, fundraising, travel, messaging and timelines — so every decision,
            conversation and milestone stays beautifully organized from beginning to end.
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

      {/* VENDOR MARKETPLACE */}
      <div id="vendors" className="bg-secondary/40">
        <AudienceSection
          eyebrow="For vendors"
          title="Grow your business with MelaBridge."
          description="Join the marketplace where couples, families and companies discover the vendors they trust. AI matches your services with the right customers — you focus on the work you love."
          benefits={vendorBenefits}
          cta="Join as a vendor"
          icon={Briefcase}
        />
      </div>

      {/* PROFESSIONAL PLANNERS */}
      <div id="planners">
        <AudienceSection
          eyebrow="For professional planners"
          title="Built for professional planners."
          description="Run your entire practice from one workspace. Every client, every event, every vendor — coordinated with AI-powered leverage instead of endless spreadsheets."
          benefits={plannerBenefits}
          cta="Built for professional planners"
          icon={ShieldCheck}
          reverse
        />
      </div>

      {/* VENUES */}
      <div id="venues" className="bg-secondary/40">
        <AudienceSection
          eyebrow="For venues"
          title="Fill your calendar. Effortlessly."
          description="Showcase your space to planners and hosts actively booking events. Coordinate vendors, share pricing and manage every booking in one calm place."
          benefits={venueBenefits}
          cta="List your venue"
          icon={Building2}
          accent="gold"
        />
      </div>

      {/* AI PLANNING */}
      <section className="mx-auto max-w-7xl px-6 py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionEyebrow>AI planning</SectionEyebrow>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">
              An AI that plans <span className="text-gradient">with you</span>, not for you.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Bridge Concierge™ is your always-on planning partner. It drafts your timeline,
              suggests vendors that match your style and budget, writes guest communications and
              flags risks before they become problems.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "Natural-language planning — describe your vision, get a full plan back",
                "BridgeMind™ continuously optimizes budget, tasks and logistics",
                "AI Event Simulator™ stress-tests your plan against 10,000+ scenarios",
                "Event Health Score™ reflects your event's readiness in a single number",
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
                  { icon: Zap, title: "Drafted a full 12-month wedding plan", meta: "in 38 seconds" },
                  { icon: CalendarCheck, title: "Rescheduled 6 vendor calls to avoid a conflict", meta: "auto-resolved" },
                  { icon: TrendingUp, title: "Suggested a $2,400 budget reallocation", meta: "+8% guest impact" },
                  { icon: MessageSquare, title: "Drafted 142 personalized RSVP reminders", meta: "ready to send" },
                ].map((row) => (
                  <div
                    key={row.title}
                    className="flex items-center gap-4 rounded-xl border border-border/70 bg-background/70 p-4 backdrop-blur"
                  >
                    <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                      <row.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{row.title}</div>
                      <div className="text-xs text-muted-foreground">{row.meta}</div>
                    </div>
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BRIDGEPAY */}
      <section className="bg-gradient-to-b from-background to-secondary/40 py-28">
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
                      { label: "Vendors paid", value: "18" },
                      { label: "Tickets sold", value: "246" },
                      { label: "Raised", value: "$12.4k" },
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
              <SectionEyebrow>BridgePay™</SectionEyebrow>
              <h2 className="mt-3 font-display text-4xl md:text-5xl">
                One wallet for every event dollar.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Sell tickets, collect contributions, pay vendors and track every line item —
                without leaving MelaBridge. Faster payouts, fewer fees, zero spreadsheet math.
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  "Tickets & tiered pricing",
                  "Fundraising & donations",
                  "Vendor invoicing & payouts",
                  "Group contributions",
                  "Live budget tracking",
                  "PCI-compliant checkout",
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
                  <Link to="/bridgepay">
                    Learn about BridgePay™ <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Pricing</SectionEyebrow>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">
            Simple plans. Serious leverage.
          </h2>
          <p className="mt-4 text-muted-foreground">Start free. Upgrade when the moment grows.</p>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-3xl border p-8 ${
                p.featured
                  ? "border-primary/40 bg-gradient-to-b from-primary/5 to-transparent shadow-elegant"
                  : "border-border bg-card"
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-1 text-xs font-medium text-gold-foreground">
                  Most loved
                </div>
              )}
              <div className="text-sm font-medium text-primary">{p.name}</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-5xl">{p.price}</span>
                {p.period && <span className="text-muted-foreground">{p.period}</span>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.tagline}</p>
              <ul className="mt-6 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button variant={p.variant} size="lg" className="w-full" asChild>
                  <Link to="/auth">{p.cta}</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-secondary/40 py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Loved by the people who plan</SectionEyebrow>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">
              Moments people won't forget.
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure
                key={t.name}
                className="rounded-2xl border border-border bg-card p-7 shadow-soft"
              >
                <div className="mb-4 flex gap-0.5 text-gold">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="font-display text-lg leading-snug">"{t.quote}"</blockquote>
                <figcaption className="mt-6 text-sm">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-muted-foreground">{t.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="mx-auto mt-14 flex max-w-3xl flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-muted-foreground">
            {[
              { icon: BarChart3, label: "12,400+ events planned" },
              { icon: MapPin, label: "38 countries" },
              { icon: ShieldCheck, label: "SOC 2 aligned" },
            ].map((s) => (
              <div key={s.label} className="inline-flex items-center gap-2">
                <s.icon className="h-4 w-4 text-primary" />
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-28">
        <div className="text-center">
          <SectionEyebrow>FAQ</SectionEyebrow>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">Answers before you ask.</h2>
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
      <section className="mx-auto max-w-7xl px-6 py-28">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-border bg-gradient-to-br from-primary via-primary to-primary-glow px-8 py-20 text-center text-primary-foreground shadow-elegant">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <h2 className="relative font-display text-4xl md:text-6xl">
            Your next moment is waiting.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Join thousands of hosts, planners, vendors and venues building the future of events —
            together, on MelaBridge.
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
