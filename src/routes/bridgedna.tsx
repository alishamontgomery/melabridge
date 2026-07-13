import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { PublicShell } from "@/components/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dna,
  Palette,
  Wallet,
  Users,
  MessageSquare,
  Music,
  Utensils,
  Clock,
  Pencil,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

export const Route = createFileRoute("/bridgedna")({
  head: () => ({
    meta: [
      { title: "BridgeDNA™ — Your Planning Personality · MelaBridge" },
      {
        name: "description",
        content:
          "A personalization engine that learns your style, budget, favorite vendors, and planning habits from every event — so future recommendations feel unmistakably yours.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BridgeDNA,
});

const traits = [
  { label: "Aesthetic", value: "Timeless · Warm minimal", confidence: 92, icon: Palette },
  { label: "Budget instinct", value: "Considered premium", confidence: 88, icon: Wallet },
  { label: "Guest style", value: "Intimate over large", confidence: 81, icon: Users },
  { label: "Voice & tone", value: "Warm, playful, sincere", confidence: 86, icon: MessageSquare },
  { label: "Music mood", value: "Afrobeats + jazz + soul", confidence: 78, icon: Music },
  { label: "Food identity", value: "West African · Italian fusion", confidence: 84, icon: Utensils },
  { label: "Planning rhythm", value: "Early planner · weekend batches", confidence: 90, icon: Clock },
];

const palette = ["#3b1a5b", "#7c4dff", "#efe9ff", "#d9b26a", "#f5efe4", "#1b1030"];

const budgets = [
  { cat: "Venue", pref: 34 },
  { cat: "Food & drink", pref: 22 },
  { cat: "Photography", pref: 14 },
  { cat: "Florals & décor", pref: 12 },
  { cat: "Music", pref: 8 },
  { cat: "Attire", pref: 6 },
  { cat: "Other", pref: 4 },
];

const vendors = [
  { name: "Bloomhaus Florals", cat: "Florist", uses: 3, rating: 5 },
  { name: "Studio Nero", cat: "Photography", uses: 4, rating: 5 },
  { name: "Onyema Catering", cat: "Catering", uses: 2, rating: 5 },
  { name: "DJ Kairo", cat: "Music", uses: 3, rating: 4 },
  { name: "Paperlane", cat: "Stationery", uses: 2, rating: 5 },
];

const guestTrends = [
  { k: "Avg guest count", v: "72" },
  { k: "RSVP rate", v: "88%" },
  { k: "Repeat guests", v: "34" },
  { k: "Kids attending", v: "12%" },
];

const habits = [
  "Books venues 9–11 months out",
  "Approves vendor contracts on Sundays",
  "Prefers a single tasting over multiple",
  "Writes personal notes to VIPs by hand",
  "Asks AI to draft, then edits by voice",
];

const suggestions = [
  { text: "Because you loved Studio Nero, I've shortlisted 3 similar photographers for your Houston reunion.", tag: "Vendor match" },
  { text: "Your last 3 events came in 4% under budget on florals — I've raised the recommended cap by $600.", tag: "Budget tune" },
  { text: "Guests responded 41% faster to your warm-playful invite tone. I'll default drafts to it.", tag: "Voice" },
];

function BridgeDNA() {
  const [feedback, setFeedback] = useState<Record<string, "up" | "down" | null>>({});

  return (
    <PublicShell>
      <PageHeader
        eyebrow="BridgeDNA™ · Personalization engine"
        icon={Dna}
        title={
          <>
            The <span className="text-gradient">taste profile</span> of everything you plan.
          </>
        }
        description="MelaBridge quietly learns from every event you complete — your aesthetic, your budget instincts, your favorite people to work with, the way you talk to guests — and uses it to make every future recommendation feel unmistakably yours."
      />

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Your planning traits</p>
              <h2 className="font-display text-xl font-semibold">Learned from 6 completed events</h2>
            </div>
            <Badge className="bg-primary/10 text-primary">Confidence 86%</Badge>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {traits.map((t) => (
              <li key={t.label} className="rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-gold/15 text-primary">
                    <t.icon className="h-4 w-4" />
                  </span>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{t.label}</p>
                </div>
                <p className="mt-2 font-medium">{t.value}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Progress value={t.confidence} className="h-1.5" />
                  <span className="text-xs text-muted-foreground">{t.confidence}%</span>
                </div>
                <button className="mt-3 inline-flex items-center gap-1 text-xs text-primary">
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Signature palette</p>
          <h3 className="font-display text-lg font-semibold">Your recurring colors</h3>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {palette.map((c) => (
              <div key={c} className="aspect-square rounded-xl border border-border" style={{ background: c }} title={c} />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Deep purple and warm gold anchor 4 of your last 5 events. I'll bias moodboards accordingly.</p>
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Guest trends</p>
            <ul className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {guestTrends.map((g) => (
                <li key={g.k} className="rounded-xl bg-accent/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{g.k}</p>
                  <p className="font-display text-lg font-semibold">{g.v}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Budget instincts</p>
          <h3 className="font-display text-lg font-semibold">How you actually spend</h3>
          <ul className="mt-4 space-y-3">
            {budgets.map((b) => (
              <li key={b.cat}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{b.cat}</span>
                  <span className="text-muted-foreground">{b.pref}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-gold" style={{ width: `${b.pref * 2.4}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Favorite vendors</p>
          <h3 className="font-display text-lg font-semibold">People you keep coming back to</h3>
          <ul className="mt-4 divide-y divide-border">
            {vendors.map((v) => (
              <li key={v.name} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.cat} · booked {v.uses} times</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gold-foreground">{"★".repeat(v.rating)}</span>
                  <Button size="sm" variant="soft">Rebook</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Planning habits</p>
          <h3 className="font-display text-lg font-semibold">The way you work</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {habits.map((h) => (
              <li key={h} className="flex items-start gap-2 rounded-xl bg-accent/50 px-3 py-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-hero-radial p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Suggestions from your DNA</p>
          <h3 className="font-display text-lg font-semibold">Applied to your active events</h3>
          <ul className="mt-4 space-y-3">
            {suggestions.map((s, i) => {
              const key = `s${i}`;
              const state = feedback[key];
              return (
                <li key={key} className="rounded-2xl border border-border bg-card p-4">
                  <Badge className="bg-primary/10 text-primary">{s.tag}</Badge>
                  <p className="mt-2 text-sm">{s.text}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => setFeedback((f) => ({ ...f, [key]: state === "up" ? null : "up" }))}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
                        state === "up" ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ThumbsUp className="h-3 w-3" /> Learn more from this
                    </button>
                    <button
                      onClick={() => setFeedback((f) => ({ ...f, [key]: state === "down" ? null : "down" }))}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
                        state === "down" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ThumbsDown className="h-3 w-3" /> Not me
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </PublicShell>
  );
}
