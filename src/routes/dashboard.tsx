import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Calendar,
  Users,
  Wallet,
  ClipboardList,
  AlertTriangle,
  CloudRain,
  Plane,
  Bell,
  Activity,
  CreditCard,
  Zap,
  MapPin,
  CheckCircle2,
  Clock,
  TrendingUp,
  Mail,
  MessageSquare,
  Image as ImageIcon,
  Video,
  Send,
  Plus,
  ChevronRight,
  Brain,
  ShieldCheck,
  PartyPopper,
  Heart,
  Lightbulb,
  ArrowUpRight,
  Circle,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "AI Command Center — MelaBridge Intelligence™" },
      {
        name: "description",
        content:
          "Your AI-powered mission control for every event: predictive insights, Event Health Score™, budgets, vendors, guests and more.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

// ---------------- Mock data ----------------

const events = [
  {
    id: "e1",
    name: "Amara & Julien — Wedding",
    type: "Wedding",
    date: "2026-10-17",
    location: "Lake Como, Italy",
    guests: 142,
    budget: 68000,
    spent: 41200,
    health: 92,
    cover: "from-primary via-primary-glow to-gold",
  },
  {
    id: "e2",
    name: "Ade turns 40",
    type: "Milestone Birthday",
    date: "2026-08-02",
    location: "Brooklyn, NY",
    guests: 60,
    budget: 8500,
    spent: 6100,
    health: 74,
    cover: "from-gold via-primary-glow to-primary",
  },
  {
    id: "e3",
    name: "Okafor Family Reunion",
    type: "Family Reunion",
    date: "2026-12-27",
    location: "Houston, TX",
    guests: 88,
    budget: 12000,
    spent: 2400,
    health: 61,
    cover: "from-primary via-gold to-primary-glow",
  },
];

const priorities = [
  { title: "Confirm florist contract — Bloomhaus", due: "Today, 5:00 PM", urgent: true },
  { title: "Send save-the-dates (batch 2)", due: "Today", urgent: true },
  { title: "Approve caterer tasting menu", due: "Tomorrow", urgent: false },
  { title: "Review DJ playlist draft", due: "In 2 days", urgent: false },
];

const deadlines = [
  { title: "Venue final payment", when: "in 3 days", amount: "$8,200" },
  { title: "Photographer 50% deposit", when: "in 6 days", amount: "$1,750" },
  { title: "RSVP cutoff", when: "in 12 days", amount: null },
  { title: "Invitation mailing window closes", when: "in 18 days", amount: null },
];

const aiPredictions = [
  {
    icon: AlertTriangle,
    tone: "warn",
    text: "Your venue contract is due in 3 days — I've drafted a reminder to the coordinator.",
    action: "Send now",
  },
  {
    icon: Users,
    tone: "info",
    text: "Only 54% of guests have RSVP'd. Response rates for similar events peak at day 21.",
    action: "Nudge guests",
  },
  {
    icon: Wallet,
    tone: "warn",
    text: "You're projected to exceed the catering budget by $420. I found 2 comparable alternatives.",
    action: "View options",
  },
  {
    icon: CloudRain,
    tone: "warn",
    text: "Rain forecast (68%) for Oct 17 in Como. I've prepared an indoor backup floorplan.",
    action: "Review plan",
  },
  {
    icon: Plane,
    tone: "info",
    text: "72% of out-of-town guests haven't booked accommodations. Room block expires in 9 days.",
    action: "Remind them",
  },
];

const insights = [
  { label: "Avg. budget for 140-guest weddings in Italy", value: "$71,400" },
  { label: "Typical RSVP response rate by week 3", value: "68%" },
  { label: "Most-booked vendor category this month", value: "Live musicians" },
  { label: "Recommended photographer booking window", value: "9–12 months out" },
  { label: "Guest-to-staff ratio benchmark", value: "1 : 12" },
  { label: "Avg. floral spend for peer events", value: "8.4% of budget" },
];

const vendors = [
  { name: "Villa del Balbianello", role: "Venue", status: "Confirmed", pct: 100 },
  { name: "Chef Marta Rinaldi", role: "Catering", status: "Contract sent", pct: 70 },
  { name: "Bloomhaus", role: "Florals", status: "Awaiting deposit", pct: 45 },
  { name: "Studio Lumen", role: "Photography", status: "In discussion", pct: 25 },
  { name: "Trio Nocturne", role: "Music", status: "Not started", pct: 0 },
];

const payments = [
  { name: "Villa final payment", date: "Aug 14", amount: 8200, status: "due" },
  { name: "Photographer deposit", date: "Aug 17", amount: 1750, status: "due" },
  { name: "Florist deposit", date: "Aug 24", amount: 1200, status: "scheduled" },
  { name: "Catering milestone 2", date: "Sep 02", amount: 4500, status: "scheduled" },
];

const activity = [
  { who: "MelaBridge AI", what: "generated a 14-week planning roadmap", when: "2m ago" },
  { who: "Sarah (co-planner)", what: "approved the invitation design", when: "1h ago" },
  { who: "Bloomhaus", what: "sent an updated floral proposal", when: "3h ago" },
  { who: "MelaBridge AI", what: "detected a budget risk in catering", when: "5h ago" },
  { who: "12 guests", what: "RSVP'd yes", when: "yesterday" },
];

const integrations = [
  { name: "Google Calendar", group: "Calendar" },
  { name: "Apple Calendar", group: "Calendar" },
  { name: "Outlook", group: "Calendar" },
  { name: "Gmail", group: "Email" },
  { name: "Stripe", group: "Payments" },
  { name: "Square", group: "Payments" },
  { name: "PayPal", group: "Payments" },
  { name: "Eventbrite", group: "Ticketing" },
  { name: "Zoom", group: "Meetings" },
  { name: "Teams", group: "Meetings" },
  { name: "Google Meet", group: "Meetings" },
  { name: "SMS gateway", group: "Messaging" },
  { name: "Weather API", group: "Signals" },
  { name: "Maps", group: "Signals" },
  { name: "AI image gen", group: "Creative" },
  { name: "AI invitations", group: "Creative" },
];

// ---------------- Helpers ----------------

// Deterministic (UTC) formatters so SSR and client render identical strings.
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function fmtMonthDay(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
function fmtFullDate(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()].slice(0,3)} ${d.getUTCDate()} ${d.getUTCFullYear()}`;
}
function daysUntil(iso: string) {
  // Stable anchor so SSR/client match; illustrative countdown.
  const now = new Date("2026-06-01T12:00:00Z");
  const then = new Date(iso + "T12:00:00Z");
  return Math.max(0, Math.ceil((then.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function healthTone(score: number) {
  if (score >= 90) return { label: "Excellent", color: "text-emerald-600", ring: "stroke-emerald-500", bg: "bg-emerald-500/10" };
  if (score >= 70) return { label: "Needs attention", color: "text-amber-600", ring: "stroke-amber-500", bg: "bg-amber-500/10" };
  return { label: "Action required", color: "text-rose-600", ring: "stroke-rose-500", bg: "bg-rose-500/10" };
}

// ---------------- Component ----------------

function Dashboard() {
  const [activeId, setActiveId] = useState(events[0].id);
  const [showHealth, setShowHealth] = useState(false);
  const event = useMemo(() => events.find((e) => e.id === activeId)!, [activeId]);
  const tone = healthTone(event.health);
  const budgetPct = Math.round((event.spent / event.budget) * 100);
  const countdown = daysUntil(event.date);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold">MelaBridge</span>
            <Badge variant="secondary" className="ml-2 hidden sm:inline-flex bg-accent text-accent-foreground">
              Intelligence™
            </Badge>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {["Overview", "Roadmap", "Guests", "Budget", "Vendors", "Messages"].map((n, i) => (
              <button
                key={n}
                className={`rounded-md px-3 py-1.5 transition ${
                  i === 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2">
              <Bell className="h-4 w-4" /> <span className="hidden sm:inline">3</span>
            </Button>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-gold text-sm font-semibold text-primary-foreground">
              A
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        {/* Event switcher */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Your events</span>
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => setActiveId(e.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                e.id === activeId
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {e.name}
            </button>
          ))}
          <Button variant="ghost" size="sm" className="ml-1 gap-1 text-primary" asChild>
            <Link to="/new-event"><Plus className="h-4 w-4" /> New event</Link>
          </Button>
        </div>

        {/* Hero: AI Command Center */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-hero-radial p-8 shadow-soft">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Brain className="h-3.5 w-3.5" />
                AI Command Center · analyzing in real time
              </div>
              <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
                Good morning, Amara. Here's what I've prepared for{" "}
                <span className="text-gradient">{event.name}</span>.
              </h1>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                I've built a {Math.ceil(countdown / 7)}-week roadmap from today until{" "}
                {fmtMonthDay(event.date)}, drafted your
                guest communications, matched {vendors.length} vendors, and flagged 3 things that need your attention.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {aiPredictions.slice(0, 2).map((p, i) => (
                  <div
                    key={i}
                    className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-elegant"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                          p.tone === "warn" ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
                        }`}
                      >
                        <p.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">{p.text}</p>
                        <button className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                          {p.action} <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="hero" className="gap-2">
                  <Sparkles className="h-4 w-4" /> Ask MelaBridge anything
                </Button>
                <Button variant="soft" className="gap-2">
                  <ClipboardList className="h-4 w-4" /> View full roadmap
                </Button>
              </div>
            </div>

            {/* Event Health Score ring */}
            <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-soft backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Event Health Score™</p>
                  <p className={`mt-1 text-sm font-medium ${tone.color}`}>{tone.label}</p>
                </div>
                <Badge className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">Live</Badge>
              </div>
              <div className="mt-4 flex items-center gap-6">
                <HealthRing score={event.health} tone={tone} />
                <div className="space-y-2 text-sm">
                  <MiniStat label="Tasks" value="72%" />
                  <MiniStat label="Budget" value={`${budgetPct}%`} />
                  <MiniStat label="Vendors" value="4 / 5" />
                  <MiniStat label="RSVPs" value="54%" />
                </div>
              </div>
              <button
                onClick={() => setShowHealth((v) => !v)}
                className="mt-5 inline-flex w-full items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-2 text-sm hover:bg-accent"
              >
                What's affecting my score?
                <ChevronRight className={`h-4 w-4 transition ${showHealth ? "rotate-90" : ""}`} />
              </button>
              {showHealth && (
                <ul className="mt-3 space-y-2 text-sm">
                  {[
                    { t: "Vendor confirmations behind pace", d: "+4 pts if florist confirms" },
                    { t: "RSVP progress under benchmark", d: "+3 pts if you nudge guests today" },
                    { t: "Weather risk (Oct 17)", d: "-2 pts, mitigated by backup plan" },
                  ].map((r) => (
                    <li key={r.t} className="flex items-start justify-between gap-3 rounded-lg bg-accent/50 px-3 py-2">
                      <span>{r.t}</span>
                      <span className="shrink-0 text-xs text-primary">{r.d}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="mt-8">
          <SectionTitle icon={Zap} title="Quick actions" />
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { icon: Mail, label: "Send update" },
              { icon: MessageSquare, label: "Draft with AI" },
              { icon: ImageIcon, label: "Design invite" },
              { icon: Users, label: "Add guests" },
              { icon: CreditCard, label: "Record payment" },
              { icon: Video, label: "Schedule call" },
            ].map((a) => (
              <button
                key={a.label}
                className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/30 hover:shadow-soft"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-gold/15 text-primary">
                  <a.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">{a.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Widget grid */}
        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          {/* Countdown + Today's priorities */}
          <Widget icon={Calendar} title="Event countdown" accent>
            <div className="flex items-end gap-3">
              <span className="font-display text-5xl font-semibold text-gradient">{countdown}</span>
              <span className="pb-2 text-sm text-muted-foreground">days to go</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(event.date).toDateString()} · <MapPin className="inline h-3 w-3" /> {event.location}
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-accent">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-gold"
                style={{ width: `${Math.min(100, 100 - (countdown / 365) * 100)}%` }}
              />
            </div>
          </Widget>

          <Widget icon={ClipboardList} title="Today's priorities" badge={`${priorities.length}`}>
            <ul className="space-y-3">
              {priorities.map((p) => (
                <li key={p.title} className="flex items-start gap-3">
                  <Circle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${p.urgent ? "text-rose-500" : "text-muted-foreground"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.due}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Widget>

          <Widget icon={Clock} title="Upcoming deadlines">
            <ul className="space-y-3">
              {deadlines.map((d) => (
                <li key={d.title} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.when}</p>
                  </div>
                  {d.amount && <span className="text-sm font-semibold text-primary">{d.amount}</span>}
                </li>
              ))}
            </ul>
          </Widget>

          {/* Budget health */}
          <Widget icon={Wallet} title="Budget health">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-2xl font-semibold">${event.spent.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground">of ${event.budget.toLocaleString()}</span>
            </div>
            <Progress value={budgetPct} className="mt-3" />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              {[
                { l: "Venue", v: 38 },
                { l: "Catering", v: 22 },
                { l: "Florals", v: 9 },
              ].map((c) => (
                <div key={c.l} className="rounded-lg bg-accent/50 py-2">
                  <div className="font-semibold text-foreground">{c.v}%</div>
                  <div className="text-muted-foreground">{c.l}</div>
                </div>
              ))}
            </div>
          </Widget>

          {/* Vendor progress */}
          <Widget icon={Handshake} title="Vendor progress">
            <ul className="space-y-3">
              {vendors.slice(0, 4).map((v) => (
                <li key={v.name}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{v.role} · {v.status}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{v.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-accent">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
                      style={{ width: `${v.pct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Widget>

          {/* Guest RSVPs */}
          <Widget icon={Users} title="Guest RSVPs">
            <div className="flex items-center gap-4">
              <DonutRing value={54} />
              <div className="text-sm">
                <p><span className="font-semibold text-foreground">77</span> attending</p>
                <p><span className="font-semibold text-foreground">18</span> declined</p>
                <p><span className="font-semibold text-foreground">47</span> awaiting</p>
              </div>
            </div>
            <Button variant="soft" size="sm" className="mt-4 w-full gap-2">
              <Send className="h-3.5 w-3.5" /> Send AI-drafted nudge
            </Button>
          </Widget>

          {/* AI Recommendations */}
          <Widget icon={Sparkles} title="AI recommendations" span={2} highlight>
            <ul className="grid gap-3 sm:grid-cols-2">
              {aiPredictions.map((p, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3"
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      p.tone === "warn" ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
                    }`}
                  >
                    <p.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm">{p.text}</p>
                    <button className="mt-1 text-xs font-medium text-primary">{p.action} →</button>
                  </div>
                </li>
              ))}
            </ul>
          </Widget>

          {/* Weather & travel */}
          <Widget icon={CloudRain} title="Weather & travel">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-gold/15">
                <CloudRain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Rain likely · 68%</p>
                <p className="text-xs text-muted-foreground">Lake Como · Oct 17</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-accent/50 p-3 text-xs text-muted-foreground">
              <Plane className="h-3.5 w-3.5" />
              12 of 41 travelers still need flights. Cheapest window closes Aug 22.
            </div>
          </Widget>

          {/* Payments */}
          <Widget icon={CreditCard} title="Upcoming payments">
            <ul className="space-y-3">
              {payments.map((p) => (
                <li key={p.name} className="flex items-center justify-between text-sm">
                  <div>
                    <p>{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">${p.amount.toLocaleString()}</span>
                    <Badge
                      variant="secondary"
                      className={p.status === "due" ? "bg-amber-500/10 text-amber-700" : "bg-accent text-accent-foreground"}
                    >
                      {p.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </Widget>

          {/* Recent activity */}
          <Widget icon={Activity} title="Recent activity">
            <ul className="space-y-3">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <p className="min-w-0">
                    <span className="font-medium">{a.who}</span>{" "}
                    <span className="text-muted-foreground">{a.what}</span>{" "}
                    <span className="text-xs text-muted-foreground">· {a.when}</span>
                  </p>
                </li>
              ))}
            </ul>
          </Widget>
        </section>

        {/* MelaBridge Intelligence Insights */}
        <section className="mt-10 rounded-3xl border border-border bg-gradient-to-br from-primary/[0.04] via-background to-gold/[0.05] p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Brain className="h-3.5 w-3.5" /> MelaBridge Intelligence™
              </div>
              <h2 className="mt-3 font-display text-2xl font-semibold">Insights from thousands of similar events</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Anonymized benchmarks that sharpen every recommendation. As you plan, the model learns and gets smarter
                for the next celebration.
              </p>
            </div>
            <Button variant="soft" className="gap-2">
              <TrendingUp className="h-4 w-4" /> Compare to peers
            </Button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {insights.map((i) => (
              <div key={i.label} className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground">{i.label}</p>
                <p className="mt-2 font-display text-xl font-semibold text-foreground">{i.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Integrations */}
        <section className="mt-10">
          <div className="flex items-end justify-between">
            <SectionTitle icon={ShieldCheck} title="Future-ready integrations" />
            <span className="text-xs text-muted-foreground">Placeholders · connect when ready</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {integrations.map((it) => (
              <div
                key={it.name}
                className="flex items-center justify-between rounded-2xl border border-dashed border-border bg-card/60 p-4"
              >
                <div>
                  <p className="text-sm font-medium">{it.name}</p>
                  <p className="text-xs text-muted-foreground">{it.group}</p>
                </div>
                <Button variant="ghost" size="sm">Connect</Button>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Heart className="h-3.5 w-3.5 text-primary" />
            Every event, planned with intention.
          </div>
          <div className="flex items-center gap-3">
            <Lightbulb className="h-3.5 w-3.5" /> MelaBridge Intelligence™ · v1.0
          </div>
        </footer>
      </main>
    </div>
  );
}

// ---------------- Subcomponents ----------------

function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
    </div>
  );
}

function Widget({
  icon: Icon,
  title,
  children,
  badge,
  span,
  accent,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  badge?: string;
  span?: number;
  accent?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-soft ${
        span === 2 ? "lg:col-span-2" : ""
      } ${accent ? "bg-gradient-to-br from-primary/5 to-gold/5" : ""} ${
        highlight ? "border-primary/20 bg-gradient-to-br from-primary/[0.06] to-primary-glow/[0.04]" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-primary">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {badge && (
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {badge}
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function HealthRing({ score, tone }: { score: number; tone: ReturnType<typeof healthTone> }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
        <circle cx="50" cy="50" r={r} className="fill-none stroke-accent" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className={`fill-none ${tone.ring}`}
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-display text-2xl font-semibold">{score}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">/ 100</div>
        </div>
      </div>
    </div>
  );
}

function DonutRing({ value }: { value: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div className="relative h-20 w-20">
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
        <circle cx="40" cy="40" r={r} className="fill-none stroke-accent" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          className="fill-none stroke-primary"
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-semibold">{value}%</div>
    </div>
  );
}

// Local Handshake icon fallback (avoids extra import if tree-shaken oddly)
function Handshake({ className }: { className?: string }) {
  return <CheckCircle2 className={className} />;
}

// Silence unused-import lint for icons kept for future use
void PartyPopper;
