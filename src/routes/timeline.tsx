import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { RippleFeed } from "@/components/ripple-feed";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/timeline")({
  head: () => ({
    meta: [
      { title: "Timeline — MelaBridge" },
      { name: "description", content: "Your event roadmap — auto-updated as tasks, vendors, and RSVPs change." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TimelinePage,
});

const PHASES = [
  { when: "12 mo out", title: "Vision & venue", status: "done", items: ["Vision moodboard", "Venue booked · Villa d'Este"] },
  { when: "9 mo out", title: "Core vendors", status: "done", items: ["Photography confirmed", "Catering confirmed"] },
  { when: "6 mo out", title: "Guests & invites", status: "active", items: ["Save-the-dates sent (batch 1)", "Save-the-dates batch 2 · today"] },
  { when: "3 mo out", title: "Menus & attire", status: "upcoming", items: ["Menu tasting", "Final fittings"] },
  { when: "6 wk out", title: "Confirmations", status: "upcoming", items: ["RSVP finalization", "Seating chart lock"] },
  { when: "Event week", title: "Run of show", status: "upcoming", items: ["Rehearsal", "Vendor call sheet"] },
];

function TimelinePage() {
  return (
    <AppShell active="/timeline">
      <PageHeader
        eyebrow="Timeline"
        icon={Calendar}
        title={<>A living roadmap, <span className="text-gradient">rewritten as reality changes</span>.</>}
        description="Every vendor confirmation, task completion, and RSVP retunes the schedule."
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <ol className="relative border-l border-border pl-6">
          {PHASES.map((p) => (
            <li key={p.when} className="mb-8 last:mb-0">
              <span className={`absolute -left-2 grid h-4 w-4 place-items-center rounded-full ring-4 ring-background ${
                p.status === "done" ? "bg-emerald-500" : p.status === "active" ? "bg-gradient-to-br from-primary to-gold" : "bg-muted"
              }`} />
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{p.when}</p>
                  <Badge variant="secondary" className="capitalize">{p.status}</Badge>
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold">{p.title}</h3>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {p.items.map((i) => <li key={i}>• {i}</li>)}
                </ul>
              </div>
            </li>
          ))}
        </ol>
        <RippleFeed />
      </div>
    </AppShell>
  );
}
