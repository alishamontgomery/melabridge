import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Globe2,
  Heart,
  GraduationCap,
  Plane,
  Baby,
  PartyPopper,
  Briefcase,
  Home,
  Sparkles,
  ArrowUpRight,
  Users,
  Camera,
} from "lucide-react";

export const Route = createFileRoute("/bridgeworld")({
  head: () => ({
    meta: [
      { title: "BridgeWorld™ — Your Life Journey Timeline · MelaBridge" },
      {
        name: "description",
        content:
          "A single chronological timeline of every milestone and event of your life — each connected to its planning workspace, memories, and related moments.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BridgeWorld,
});

type EraKey = "past" | "present" | "future";

type Milestone = {
  id: string;
  year: number;
  month: string;
  title: string;
  type: string;
  location: string;
  icon: React.ComponentType<{ className?: string }>;
  era: EraKey;
  people: number;
  vault: number;
  related?: string[];
  workspace?: string;
};

const timeline: Milestone[] = [
  { id: "m1", year: 2011, month: "Jun", title: "High school graduation", type: "Graduation", location: "Lagos, NG", icon: GraduationCap, era: "past", people: 45, vault: 128 },
  { id: "m2", year: 2015, month: "May", title: "College graduation — NYU", type: "Graduation", location: "New York, NY", icon: GraduationCap, era: "past", people: 60, vault: 214, related: ["m1"] },
  { id: "m3", year: 2018, month: "Sep", title: "First apartment together", type: "Life milestone", location: "Brooklyn, NY", icon: Home, era: "past", people: 2, vault: 41 },
  { id: "m4", year: 2021, month: "Jul", title: "Amara & Julien — Engagement", type: "Engagement", location: "Positano, IT", icon: Heart, era: "past", people: 12, vault: 302, related: ["e1"] },
  { id: "m5", year: 2023, month: "Mar", title: "Career pivot — new role", type: "Career", location: "Remote", icon: Briefcase, era: "past", people: 8, vault: 17 },
  { id: "m6", year: 2024, month: "Nov", title: "Family reunion — Houston '24", type: "Family Reunion", location: "Houston, TX", icon: Users, era: "past", people: 62, vault: 189 },

  { id: "e2", year: 2026, month: "Aug", title: "Ade turns 40", type: "Milestone Birthday", location: "Brooklyn, NY", icon: PartyPopper, era: "present", people: 60, vault: 12, workspace: "/dashboard" },
  { id: "e1", year: 2026, month: "Oct", title: "Amara & Julien — Wedding", type: "Wedding", location: "Lake Como, IT", icon: Heart, era: "present", people: 142, vault: 47, workspace: "/dashboard", related: ["m4"] },
  { id: "e3", year: 2026, month: "Dec", title: "Okafor Family Reunion", type: "Family Reunion", location: "Houston, TX", icon: Users, era: "present", people: 88, vault: 6, workspace: "/dashboard", related: ["m6"] },

  { id: "f1", year: 2027, month: "May", title: "Honeymoon — Japan", type: "Vacation", location: "Kyoto, JP", icon: Plane, era: "future", people: 2, vault: 0 },
  { id: "f2", year: 2028, month: "Mar", title: "First baby shower", type: "Baby Shower", location: "TBD", icon: Baby, era: "future", people: 30, vault: 0 },
  { id: "f3", year: 2031, month: "Jun", title: "10-year anniversary", type: "Anniversary", location: "TBD", icon: Heart, era: "future", people: 50, vault: 0, related: ["e1"] },
  { id: "f4", year: 2035, month: "—", title: "Kids' first big birthday", type: "Kids' Birthday", location: "TBD", icon: PartyPopper, era: "future", people: 25, vault: 0 },
];

const eraStyles: Record<EraKey, { dot: string; ring: string; chip: string; label: string }> = {
  past: { dot: "bg-muted", ring: "border-border", chip: "bg-accent text-accent-foreground", label: "Memory" },
  present: { dot: "bg-gradient-to-br from-primary to-gold", ring: "border-primary/40", chip: "bg-primary/10 text-primary", label: "Active" },
  future: { dot: "bg-gold/40", ring: "border-gold/40", chip: "bg-gold/10 text-gold-foreground", label: "Planned" },
};

function BridgeWorld() {
  const grouped = timeline.reduce<Record<number, Milestone[]>>((acc, m) => {
    (acc[m.year] ||= []).push(m);
    return acc;
  }, {});
  const years = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  return (
    <AppShell active="/bridgeworld">
      <PageHeader
        eyebrow="BridgeWorld™ · Your Life Journey"
        icon={Globe2}
        title={
          <>
            Every chapter, <span className="text-gradient">connected</span>.
          </>
        }
        description="A single chronological view of every milestone you've lived, every event you're planning, and every moment ahead. Each node opens its workspace, memories in BridgeVault™, and the people who made it happen."
      />

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          { k: "Milestones", v: `${timeline.length}` },
          { k: "Years covered", v: `${years[years.length - 1] - years[0]}` },
          { k: "People connected", v: "312" },
          { k: "Vault artifacts", v: "1,296" },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.k}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{s.v}</p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Life timeline</p>
            <h2 className="font-display text-2xl font-semibold">Your chronological journey</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(["past", "present", "future"] as EraKey[]).map((e) => (
              <span key={e} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${eraStyles[e].chip}`}>
                <span className={`h-2 w-2 rounded-full ${eraStyles[e].dot}`} />
                {eraStyles[e].label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute left-6 top-0 h-full w-px bg-gradient-to-b from-transparent via-border to-transparent md:left-1/2" />
          <ol className="space-y-8">
            {years.map((year) => (
              <li key={year}>
                <div className="relative mb-4 flex items-center gap-3 md:justify-center">
                  <span className="ml-[-2px] md:ml-0 grid h-12 w-12 place-items-center rounded-full border border-border bg-card font-display text-sm font-semibold shadow-soft">
                    {year}
                  </span>
                </div>
                <ul className="space-y-4">
                  {grouped[year].map((m, idx) => {
                    const s = eraStyles[m.era];
                    const isRight = idx % 2 === 1;
                    return (
                      <li key={m.id} className={`relative pl-14 md:pl-0 md:grid md:grid-cols-2 md:gap-8`}>
                        <span
                          className={`absolute left-4 top-6 h-3 w-3 rounded-full ring-4 ring-background md:left-1/2 md:-translate-x-1/2 ${s.dot}`}
                        />
                        <div className={`${isRight ? "md:col-start-2" : ""}`}>
                          <article className={`rounded-2xl border ${s.ring} bg-card p-5 shadow-sm transition hover:shadow-elegant`}>
                            <div className="flex items-start gap-3">
                              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-gold/15 text-primary">
                                <m.icon className="h-5 w-5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-display text-lg font-semibold leading-tight">{m.title}</h3>
                                  <Badge className={s.chip}>{s.label}</Badge>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {m.month} {m.year} · {m.type} · {m.location}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {m.people} people</span>
                                  <span className="inline-flex items-center gap-1"><Camera className="h-3 w-3" /> {m.vault} in vault</span>
                                  {m.related && <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> {m.related.length} linked</span>}
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {m.workspace ? (
                                    <Button asChild size="sm" variant="soft" className="gap-1">
                                      <Link to={m.workspace as "/dashboard"}>Open workspace <ArrowUpRight className="h-3 w-3" /></Link>
                                    </Button>
                                  ) : m.era === "future" ? (
                                    <Button asChild size="sm" variant="hero" className="gap-1">
                                      <Link to="/new-event">Start planning <ArrowUpRight className="h-3 w-3" /></Link>
                                    </Button>
                                  ) : (
                                    <Button asChild size="sm" variant="soft" className="gap-1">
                                      <Link to="/bridgevault">View memories <ArrowUpRight className="h-3 w-3" /></Link>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </article>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-border bg-card p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-semibold">Add a life chapter</h3>
            <p className="mt-1 text-sm text-muted-foreground">Log a past memory or start planning something new. MelaBridge weaves it into your journey.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="soft">
              <Link to="/bridgevault">Import a memory</Link>
            </Button>
            <Button asChild variant="hero">
              <Link to="/new-event">Plan a new event</Link>
            </Button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
