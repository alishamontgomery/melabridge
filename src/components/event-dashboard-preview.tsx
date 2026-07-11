import { useEffect, useRef, useState } from "react";
import {
  Calendar, Users, Wallet, ClipboardList, Sparkles, Bell,
  Check, Circle, Store, GitBranch, Vote, Activity, MapPin,
  TrendingUp, Clock, Heart,
} from "lucide-react";

/**
 * EventDashboardPreview — the canonical MelaBridge event dashboard.
 * Renders with demo data by default (homepage), real data when passed props.
 * Used both as the marketing showcase and inside the authenticated app.
 */

export type DashboardData = {
  eventName: string;
  eventType: string;
  location: string;
  daysRemaining: number;
  guests: { invited: number; confirmed: number; pending: number; declined: number };
  budget: { spent: number; total: number };
  tasks: { id: string; title: string; done: boolean; due?: string }[];
  vendors: { name: string; role: string; status: "confirmed" | "pending" | "quoted" }[];
  aiRecommendation: string;
  activity: { who: string; what: string; when: string }[];
  notifications: { title: string; body: string; when: string }[];
  timeline: { date: string; label: string; done: boolean }[];
  decisions: { title: string; options: number; votes: number }[];
};

export const DEMO_DASHBOARD: DashboardData = {
  eventName: "The Johnson Wedding",
  eventType: "Wedding",
  location: "Napa Valley, CA",
  daysRemaining: 97,
  guests: { invited: 142, confirmed: 96, pending: 34, declined: 12 },
  budget: { spent: 18250, total: 25000 },
  tasks: [
    { id: "1", title: "Finalize venue contract", done: true, due: "Mar 12" },
    { id: "2", title: "Send save-the-dates", done: true, due: "Mar 18" },
    { id: "3", title: "Schedule cake tasting", done: true, due: "Apr 02" },
    { id: "4", title: "Confirm florist palette", done: false, due: "Apr 09" },
    { id: "5", title: "Book rehearsal dinner", done: false, due: "Apr 15" },
  ],
  vendors: [
    { name: "Bloomhaus Florals", role: "Florist", status: "confirmed" },
    { name: "Lumen Studio", role: "Photographer", status: "confirmed" },
    { name: "Estelle Catering", role: "Caterer", status: "quoted" },
    { name: "The Grove Quartet", role: "Music", status: "pending" },
  ],
  aiRecommendation:
    "You're ahead of schedule. Send invitations this week to maximize RSVP responses before the Easter travel rush.",
  activity: [
    { who: "Lumen Studio", what: "confirmed the shoot date", when: "2m ago" },
    { who: "Estelle Catering", what: "sent a $6,400 quote", when: "1h ago" },
    { who: "Sarah", what: "voted for Napa Valley venue", when: "3h ago" },
    { who: "BridgeMind", what: "drafted your welcome note", when: "Yesterday" },
  ],
  notifications: [
    { title: "3 new RSVPs", body: "Aunt Mira, David & Priya replied yes.", when: "just now" },
    { title: "Budget nudge", body: "Florals pacing 8% over — 2 alternatives ready.", when: "12m ago" },
  ],
  timeline: [
    { date: "Mar", label: "Venue booked", done: true },
    { date: "Apr", label: "Vendors confirmed", done: true },
    { date: "May", label: "Invitations sent", done: false },
    { date: "Jun", label: "Rehearsal", done: false },
    { date: "Jul", label: "The day", done: false },
  ],
  decisions: [
    { title: "Reception color palette", options: 3, votes: 8 },
    { title: "Signature cocktail", options: 4, votes: 12 },
  ],
};

/* ---------- animation hooks ---------- */

function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setInView(true),
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, threshold]);
  return { ref, inView };
}

function useCountUp(target: number, start: boolean, duration = 1200) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, start, duration]);
  return n;
}

/* ---------- main component ---------- */

export function EventDashboardPreview({
  data = DEMO_DASHBOARD,
  chrome = true,
}: {
  data?: DashboardData;
  chrome?: boolean;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  const budgetPct = Math.round((data.budget.spent / data.budget.total) * 100);
  const rsvpPct = Math.round((data.guests.confirmed / data.guests.invited) * 100);
  const tasksDone = data.tasks.filter((t) => t.done).length;
  const tasksPct = Math.round((tasksDone / data.tasks.length) * 100);

  const days = useCountUp(data.daysRemaining, inView);
  const spent = useCountUp(data.budget.spent, inView);
  const confirmed = useCountUp(data.guests.confirmed, inView);

  return (
    <div
      ref={ref}
      className={[
        "relative w-full transition-all duration-700",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
      ].join(" ")}
    >
      {chrome && (
        <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-gold/20 blur-2xl" />
      )}

      <div className={chrome ? "rounded-[1.75rem] border border-border bg-card shadow-elegant" : ""}>
        {chrome && (
          <div className="flex min-w-0 items-center gap-1.5 rounded-t-[1.75rem] border-b border-border/70 bg-secondary/40 px-3 py-2.5 sm:px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-gold/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            <div className="ml-2 min-w-0 truncate rounded-md bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground sm:ml-3">
              app.melabridge.com / events / johnson-wedding
            </div>
          </div>
        )}

        <div className="grid gap-3 p-3 sm:gap-4 sm:p-5 lg:grid-cols-12 lg:p-6">
          {/* Header */}
          <header className="lg:col-span-12">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-widest text-primary">{data.eventType}</p>
                <h3 className="mt-0.5 truncate font-display text-2xl font-semibold sm:text-3xl">
                  {data.eventName}
                </h3>
                <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{data.location}</span>
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-primary/20 bg-hero-radial px-4 py-2.5 text-right">
                <div className="text-[10px] uppercase tracking-widest text-primary">Countdown</div>
                <div className="font-display text-2xl font-semibold tabular-nums text-primary">
                  {days}<span className="ml-1 text-xs font-normal text-muted-foreground">days</span>
                </div>
              </div>
            </div>
          </header>

          {/* Stat cards */}
          <StatCard className="lg:col-span-4" icon={Wallet} label="Budget" tone="primary">
            <div className="font-display text-2xl font-semibold tabular-nums">
              ${spent.toLocaleString()}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                / ${data.budget.total.toLocaleString()}
              </span>
            </div>
            <ProgressBar value={inView ? budgetPct : 0} tone="primary" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {100 - budgetPct}% remaining · pacing on target
            </p>
          </StatCard>

          <StatCard className="lg:col-span-4" icon={Users} label="Guests" tone="gold">
            <div className="font-display text-2xl font-semibold tabular-nums">
              {confirmed}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                of {data.guests.invited} confirmed
              </span>
            </div>
            <ProgressBar value={inView ? rsvpPct : 0} tone="gold" />
            <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
              <span>● {data.guests.pending} pending</span>
              <span>● {data.guests.declined} declined</span>
            </div>
          </StatCard>

          <StatCard className="lg:col-span-4" icon={ClipboardList} label="Tasks" tone="emerald">
            <div className="font-display text-2xl font-semibold tabular-nums">
              {tasksDone}<span className="ml-1 text-xs font-normal text-muted-foreground">/ {data.tasks.length} done</span>
            </div>
            <ProgressBar value={inView ? tasksPct : 0} tone="emerald" />
            <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
              <TrendingUp className="h-3 w-3" /> Ahead of schedule
            </p>
          </StatCard>

          {/* Upcoming tasks */}
          <Panel className="lg:col-span-5" icon={ClipboardList} title="Upcoming tasks">
            <ul className="space-y-2">
              {data.tasks.map((t, i) => (
                <li
                  key={t.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm transition hover:border-primary/40 hover:bg-background"
                  style={{ transitionDelay: `${i * 60}ms` }}
                >
                  <TaskCheck done={inView && t.done} delay={400 + i * 120} />
                  <span className={`flex-1 truncate ${inView && t.done ? "text-muted-foreground line-through" : ""}`}>
                    {t.title}
                  </span>
                  {t.due && <span className="text-[11px] text-muted-foreground">{t.due}</span>}
                </li>
              ))}
            </ul>
          </Panel>

          {/* AI Recommendation */}
          <Panel
            className="lg:col-span-7 border-primary/20 bg-hero-radial"
            icon={Sparkles}
            title="BridgeMind™ AI recommendation"
            tone="primary"
          >
            <p className="text-[15px] leading-relaxed text-foreground/90">
              "{data.aiRecommendation}"
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip>Draft invitations</Chip>
              <Chip>Preview timeline</Chip>
              <Chip>Notify co-planners</Chip>
            </div>
          </Panel>

          {/* Vendors */}
          <Panel className="lg:col-span-5" icon={Store} title="Vendor status">
            <ul className="space-y-2">
              {data.vendors.map((v) => (
                <li key={v.name} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{v.name}</p>
                    <p className="text-[11px] text-muted-foreground">{v.role}</p>
                  </div>
                  <VendorPill status={v.status} />
                </li>
              ))}
            </ul>
          </Panel>

          {/* Timeline / Live Planning Board */}
          <Panel className="lg:col-span-7" icon={GitBranch} title="Live Planning Board™">
            <ol className="relative grid grid-cols-2 items-stretch gap-3 sm:grid-cols-5">
              {data.timeline.map((m, i) => (
                <li key={i} className="flex min-w-0 flex-col items-center text-center">
                  <div
                    className={[
                      "grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-medium transition-all duration-500",
                      m.done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground",
                    ].join(" ")}
                    style={{ transitionDelay: `${300 + i * 150}ms` }}
                  >
                    {m.done ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <div className="mt-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">{m.date}</div>
                  <div className="max-w-full text-[11px] font-medium leading-tight">{m.label}</div>
                </li>
              ))}
              <div className="absolute left-4 right-4 top-[18px] -z-10 hidden h-0.5 bg-border sm:block" />
            </ol>
          </Panel>

          {/* Recent activity */}
          <Panel className="lg:col-span-5" icon={Activity} title="Recent activity">
            <ul className="space-y-2.5">
                {data.activity.length === 0 ? (
                  <li className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">No activity yet.</li>
                ) : data.activity.map((a, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm"
                  style={{ animation: inView ? `dashboardSlideIn 500ms ease-out ${i * 120}ms both` : "none" }}
                >
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                  <div className="min-w-0 flex-1">
                    <p><span className="font-medium">{a.who}</span> <span className="text-muted-foreground">{a.what}</span></p>
                    <p className="text-[11px] text-muted-foreground">{a.when}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          {/* Decision Center */}
          <Panel className="lg:col-span-4" icon={Vote} title="Decision Center™">
            <ul className="space-y-2">
                {data.decisions.length === 0 ? (
                  <li className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">No open decisions yet.</li>
                ) : data.decisions.map((d) => (
                <li key={d.title} className="rounded-lg border border-border/60 bg-background/60 p-3">
                  <p className="text-sm font-medium">{d.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {d.options} options · {d.votes} votes
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          {/* Notifications */}
          <Panel className="lg:col-span-3" icon={Bell} title="Notifications">
            <ul className="space-y-2">
                {data.notifications.length === 0 ? (
                  <li className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">No notifications yet.</li>
                ) : data.notifications.map((n, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm"
                  style={{ animation: inView ? `dashboardSlideIn 500ms ease-out ${400 + i * 200}ms both` : "none" }}
                >
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-primary/70">{n.when}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {/* Keyframes (scoped via unique animation name) */}
      <style>{`
        @keyframes dashboardSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  );
}

/* ---------- sub components ---------- */

function StatCard({
  icon: Icon, label, tone, className, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "primary" | "gold" | "emerald";
  className?: string;
  children: React.ReactNode;
}) {
  const iconTone =
    tone === "primary" ? "text-primary" : tone === "gold" ? "text-gold-foreground" : "text-emerald-600";
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:shadow-elegant ${className ?? ""}`}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${iconTone}`} /> {label}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Panel({
  icon: Icon, title, tone, className, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone?: "primary";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-4 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:shadow-elegant ${className ?? ""}`}>
      <header className="mb-3 flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-widest">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${tone === "primary" ? "text-primary" : "text-muted-foreground"}`} />
        <span className={`min-w-0 truncate ${tone === "primary" ? "text-primary" : "text-muted-foreground"}`}>{title}</span>
      </header>
      {children}
    </section>
  );
}

function ProgressBar({ value, tone }: { value: number; tone: "primary" | "gold" | "emerald" }) {
  const bar =
    tone === "primary"
      ? "bg-gradient-to-r from-primary to-primary-glow"
      : tone === "gold"
      ? "bg-gradient-to-r from-gold to-gold/70"
      : "bg-gradient-to-r from-emerald-500 to-emerald-400";
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${bar} transition-[width] duration-[1400ms] ease-out`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function TaskCheck({ done, delay }: { done: boolean; delay: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [done, delay]);
  return shown ? (
    <div className="grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground animate-scale-in">
      <Check className="h-3 w-3" />
    </div>
  ) : (
    <Circle className="h-5 w-5 text-muted-foreground" />
  );
}

function VendorPill({ status }: { status: "confirmed" | "pending" | "quoted" }) {
  const map = {
    confirmed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    quoted: "bg-primary/10 text-primary border-primary/20",
    pending: "bg-gold/20 text-gold-foreground border-gold/30",
  } as const;
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${map[status]}`}>
      {status}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-full border border-primary/20 bg-background/60 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary hover:text-primary-foreground">
      {children}
    </button>
  );
}

/* Re-export a small icon so consumers can reference the "loved" gold badge if needed */
export { Heart, Clock };
