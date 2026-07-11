import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sparkles,
  Calendar,
  Users,
  Wallet,
  MessageSquareHeart,
  ClipboardList,
  Check,
  Star,
  Ticket,
  HeartHandshake,
  Handshake,
  Lightbulb,
  Rocket,
  PartyPopper,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
} from "lucide-react";
import heroImage from "@/assets/hero-ai.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
});

const eventTypes = [
  "Weddings",
  "Birthdays",
  "Baby Showers",
  "Reunions",
  "Funerals",
  "Corporate",
  "Conferences",
  "Vacations",
  "Nonprofits",
  "School Events",
];

const howItWorks = [
  {
    icon: Lightbulb,
    step: "01",
    title: "Share the idea",
    desc: "Tell MelaBridge what you're planning. A backyard birthday or a 500-guest gala — start with a sentence.",
  },
  {
    icon: Sparkles,
    step: "02",
    title: "Let AI build the plan",
    desc: "Timelines, budgets, vendor shortlists, guest lists and messaging drafts appear in seconds.",
  },
  {
    icon: PartyPopper,
    step: "03",
    title: "Bring everyone together",
    desc: "Invite co-planners, sell tickets, collect RSVPs, raise funds, and run the day from one dashboard.",
  },
];

const features = [
  {
    icon: Sparkles,
    title: "AI Planning",
    desc: "Describe your vision. MelaBridge drafts the timeline, guest list, and vendor shortlist in seconds.",
  },
  {
    icon: Wallet,
    title: "Budgets",
    desc: "Live budget tracking with vendor comparisons and gentle nudges when things drift.",
  },
  {
    icon: Users,
    title: "Guests",
    desc: "Smart RSVPs, dietary tracking, and seating suggestions — your guests feel seen.",
  },
  {
    icon: Handshake,
    title: "Vendors",
    desc: "Discover, compare, and book florists, venues, and caterers in one concierge inbox.",
  },
  {
    icon: Calendar,
    title: "Timelines",
    desc: "Every task and milestone across every event, on one calm shared timeline.",
  },
  {
    icon: Ticket,
    title: "Ticket Sales",
    desc: "Sell tickets in minutes with tiered pricing, promo codes, and instant payouts.",
  },
  {
    icon: HeartHandshake,
    title: "Fundraising",
    desc: "Run donation campaigns and silent auctions alongside your event, natively.",
  },
  {
    icon: MessageSquareHeart,
    title: "Messaging",
    desc: "Email, SMS and in-app messages — personalized and sent at the right moment.",
  },
  {
    icon: ClipboardList,
    title: "Collaboration",
    desc: "Invite family, friends, or teammates with granular permissions and live edits.",
  },
];


const testimonials = [
  {
    quote:
      "MelaBridge planned our 300-guest wedding better than the coordinator we almost hired. The AI suggestions were uncanny.",
    name: "Amara Okonkwo",
    role: "Bride, Lagos",
  },
  {
    quote:
      "We run 40+ corporate events a year. MelaBridge replaced four tools and cut planning time in half.",
    name: "David Chen",
    role: "Head of Events, Northwind",
  },
  {
    quote:
      "I planned my grandmother's memorial in a weekend. It handled everything with such grace.",
    name: "Priya Menon",
    role: "Family organizer",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    tagline: "For a single moment.",
    features: ["1 active event", "Up to 25 guests", "AI planning assistant", "Basic invitations"],
    cta: "Start free",
    variant: "soft" as const,
  },
  {
    name: "Pro",
    price: "$18",
    period: "/month",
    tagline: "For life's memorable moments.",
    features: [
      "Unlimited events",
      "Up to 500 guests per event",
      "Full AI concierge",
      "Vendor inbox & budgets",
      "Ticket sales & fundraising",
    ],
    cta: "Start 14-day trial",
    variant: "hero" as const,
    featured: true,
  },
  {
    name: "Business",
    price: "$79",
    period: "/month",
    tagline: "For planners & teams.",
    features: [
      "Everything in Pro",
      "Team collaboration",
      "Client portals",
      "White-label invitations",
      "Priority support",
    ],
    cta: "Talk to sales",
    variant: "gold" as const,
  },
];

const faqs = [
  {
    q: "What kinds of events can I plan?",
    a: "Anything — weddings, birthdays, funerals, corporate offsites, conferences, vacations, graduations, nonprofit galas, family reunions. MelaBridge adapts its playbook to the occasion.",
  },
  {
    q: "How does the AI actually help?",
    a: "It drafts timelines, suggests vendors, writes guest communications, tracks budget drift, and answers planning questions grounded in your event's real details.",
  },
  {
    q: "Can I collaborate with family or a team?",
    a: "Yes. Invite co-planners with granular permissions on Pro and Business plans. Everyone stays on the same timeline.",
  },
  {
    q: "Is my guest data private?",
    a: "Always. Guest data is encrypted, never sold, and never used to train external models. You control exports and deletion.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Every paid plan can be cancelled with one click — no calls, no forms.",
  },
];

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

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#how" className="text-sm text-muted-foreground hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="rounded-full">
              Log in
            </Button>
            <Button variant="hero" size="sm" className="rounded-full">
              Sign up
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-hero-radial relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 pt-20 pb-24 md:grid-cols-2 md:pt-28 md:pb-32">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
              AI event planning · now in early access
            </div>
            <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-7xl">
              Plan Every Moment.
              <br />
              <span className="text-gradient">Together.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              MelaBridge is the AI-powered platform for weddings, birthdays, baby
              showers, reunions, funerals, corporate events, conferences,
              vacations, nonprofit and school events — all in one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="hero" size="xl">
                Start planning
              </Button>
              <Button variant="soft" size="xl" asChild>
                <a href="#features">Explore features</a>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs uppercase tracking-widest text-muted-foreground">
              {eventTypes.slice(0, 6).map((e) => (
                <span key={e}>{e}</span>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-gold/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-border shadow-elegant">
              <img
                src={heroImage}
                alt="MelaBridge AI assistant illustration"
                width={1200}
                height={1200}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-widest text-primary">How it works</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">
            From idea to unforgettable, in three steps.
          </h2>
          <p className="mt-4 text-muted-foreground">
            MelaBridge is the bridge between a spark of inspiration and a moment
            people will talk about for years.
          </p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {howItWorks.map((s) => (
            <div
              key={s.step}
              className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-soft"
            >
              <div className="font-display text-6xl text-primary/10">{s.step}</div>
              <div className="mt-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* EVENT TYPES MARQUEE */}
      <section className="border-y border-border bg-white/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-8 text-sm text-muted-foreground">
          <span className="text-xs uppercase tracking-widest text-foreground/70">
            One platform for
          </span>
          {eventTypes.map((e) => (
            <span key={e} className="font-medium">
              {e}
            </span>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-widest text-primary">Features</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">
            Every planning tool, quietly intelligent.
          </h2>
          <p className="mt-4 text-muted-foreground">
            MelaBridge handles the invisible work so you can be present for the moment.
          </p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative rounded-2xl border border-border bg-card p-7 transition-all hover:shadow-soft"
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

      {/* TESTIMONIALS */}
      <section id="testimonials" className="bg-secondary/40 py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs uppercase tracking-widest text-primary">Loved by planners</p>
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
                <blockquote className="font-display text-lg leading-snug">
                  "{t.quote}"
                </blockquote>
                <figcaption className="mt-6 text-sm">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-muted-foreground">{t.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-widest text-primary">Pricing</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">
            Simple plans for every celebration.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Start free. Upgrade when the guest list grows.
          </p>
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
                <Button variant={p.variant} size="lg" className="w-full">
                  {p.cta}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-secondary/40 py-28">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-primary">FAQ</p>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">
              Answers before you ask.
            </h2>
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
                <AccordionContent className="pb-5 text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-28">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-border bg-gradient-to-br from-primary via-primary to-primary-glow px-8 py-20 text-center text-primary-foreground shadow-elegant">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <h2 className="relative font-display text-4xl md:text-6xl">
            Your next moment is waiting.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Join thousands planning weddings, birthdays, reunions and everything in
            between — with a little help from AI.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="gold" size="xl">
              Start planning free
            </Button>
            <Button
              variant="soft"
              size="xl"
              className="bg-white/10 text-primary-foreground border-white/20 hover:bg-white/20"
            >
              Log in
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              MelaBridge is the AI event planning platform for every moment that matters.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold">Product</div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground">Features</a></li>
              <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
              <li><a href="#faq" className="hover:text-foreground">FAQ</a></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold">Company</div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">About</a></li>
              <li><a href="#" className="hover:text-foreground">Careers</a></li>
              <li><a href="#" className="hover:text-foreground">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground md:flex-row">
            <div>© {new Date().getFullYear()} MelaBridge. Every moment, gathered.</div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-foreground">Privacy</a>
              <a href="#" className="hover:text-foreground">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
