import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { PublicShell } from "@/components/public-shell";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Wallet,
  Users,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/bridge-intelligence")({
  head: () => ({
    meta: [
      { title: "Bridge Intelligence™ — Community Benchmarks · MelaBridge" },
      {
        name: "description",
        content:
          "Anonymized community insights: planning timelines, budgeting benchmarks, RSVP trends, and seasonal recommendations — designed to grow with the platform while protecting your privacy.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BridgeIntelligence,
});

const rsvpCurve = [8, 14, 22, 31, 42, 55, 67, 76, 83, 88, 91, 93];
const budgetBands = [
  { cat: "Venue", low: 28, mid: 34, high: 41 },
  { cat: "Catering", low: 18, mid: 22, high: 27 },
  { cat: "Photography", low: 8, mid: 12, high: 16 },
  { cat: "Florals & décor", low: 6, mid: 10, high: 15 },
  { cat: "Music", low: 5, mid: 8, high: 12 },
];

const timelineBenchmarks = [
  { phase: "Book venue", when: "9–11 months out", you: "10 months", pct: 62 },
  { phase: "Send save-the-dates", when: "6–8 months out", you: "7 months", pct: 71 },
  { phase: "Confirm vendors", when: "3–5 months out", you: "4 months", pct: 58 },
  { phase: "Send invitations", when: "8–10 weeks out", you: "9 weeks", pct: 80 },
  { phase: "Finalize headcount", when: "2 weeks out", you: "—", pct: 12 },
];

const seasons = [
  { season: "Spring", note: "Peak wedding demand — book florists 10+ months out", trend: "+18%" },
  { season: "Summer", note: "Vacation & reunion season — rentals fill by March", trend: "+24%" },
  { season: "Fall", note: "Best photography light; venues 12% more available midweek", trend: "+9%" },
  { season: "Winter", note: "Corporate + holiday parties surge; catering lead time doubles", trend: "+31%" },
];

const insights = [
  { title: "You're 2 weeks ahead of similar weddings", body: "Compared with 1,284 anonymized weddings in your budget band, your vendor confirmations are pacing 12% faster.", tag: "Timeline" },
  { title: "Your florals allocation is under median", body: "Median for Lake Como–scale weddings is 12%; you're at 9%. Consider a $2,400 reserve.", tag: "Budget" },
  { title: "RSVPs typically stall at week 6", body: "Nudge non-responders on Sunday evening — response rates lift 34% in that window.", tag: "Guests" },
];

function BridgeIntelligence() {
  const maxBudget = Math.max(...budgetBands.map((b) => b.high));

  return (
    <PublicShell>
      <PageHeader
        eyebrow="Bridge Intelligence™ · Community benchmarks"
        icon={BarChart3}
        title={
          <>
            Learn from <span className="text-gradient">everyone's plans</span>, without knowing anyone's.
          </>
        }
        description="Anonymized, aggregated insights from the MelaBridge community — how long real events take to plan, where people actually spend, when guests RSVP, and what each season demands. Built to expand as the platform grows, and to keep your data yours."
      />

      <section className="mt-6 flex flex-wrap items-center gap-2 text-xs">
        <Badge className="bg-primary/10 text-primary"><ShieldCheck className="mr-1 h-3 w-3" /> Fully anonymized</Badge>
        <Badge variant="secondary">k-anonymity ≥ 50</Badge>
        <Badge variant="secondary">No PII shared</Badge>
        <Badge variant="secondary">Opt-out anytime</Badge>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        {insights.map((i) => (
          <div key={i.title} className="rounded-3xl border border-border bg-card p-6">
            <Badge className="bg-primary/10 text-primary">{i.tag}</Badge>
            <h3 className="mt-3 font-display text-lg font-semibold">{i.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{i.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Planning timeline benchmarks</p>
          </div>
          <h3 className="font-display text-lg font-semibold">When people actually do things</h3>
          <ul className="mt-4 space-y-3">
            {timelineBenchmarks.map((t) => (
              <li key={t.phase}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{t.phase}</span>
                  <span className="text-muted-foreground">{t.when} · you: {t.you}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-gold" style={{ width: `${t.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Budget bands</p>
          </div>
          <h3 className="font-display text-lg font-semibold">% of budget by category</h3>
          <ul className="mt-4 space-y-4">
            {budgetBands.map((b) => (
              <li key={b.cat}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{b.cat}</span>
                  <span className="text-muted-foreground">{b.low}% – {b.high}% (median {b.mid}%)</span>
                </div>
                <div className="relative h-3 w-full rounded-full bg-accent">
                  <div
                    className="absolute top-0 h-full rounded-full bg-primary/20"
                    style={{ left: `${(b.low / maxBudget) * 100}%`, width: `${((b.high - b.low) / maxBudget) * 100}%` }}
                  />
                  <div
                    className="absolute top-0 h-full w-0.5 bg-gold"
                    style={{ left: `${(b.mid / maxBudget) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">RSVP curve</p>
          </div>
          <h3 className="font-display text-lg font-semibold">Typical response over 12 weeks</h3>
          <div className="mt-6 flex h-40 items-end gap-2">
            {rsvpCurve.map((v, i) => (
              <div key={i} className="flex-1">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-primary to-gold"
                  style={{ height: `${v}%` }}
                  title={`Week ${i + 1}: ${v}%`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>Week 1</span>
            <span>Week 6</span>
            <span>Week 12</span>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-hero-radial p-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Seasonal recommendations</p>
          </div>
          <ul className="mt-4 space-y-3">
            {seasons.map((s) => (
              <li key={s.season} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{s.season}</p>
                  <Badge className="bg-primary/10 text-primary">{s.trend}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-xs uppercase tracking-widest text-muted-foreground">How this stays private</p>
            </div>
            <h3 className="font-display text-lg font-semibold">Insights from the community, never about individuals</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Benchmarks aggregate at least 50 comparable events before we show a number. Names, addresses, guest lists, and vault contents are never included. You can opt out of contributing anonymized signals in Settings.
            </p>
          </div>
          <Badge className="bg-primary/10 text-primary"><ShieldCheck className="mr-1 h-3 w-3" /> Privacy-first analytics</Badge>
        </div>
      </section>
    </PublicShell>
  );
}
