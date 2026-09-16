import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LifeBuoy, Sparkles, BellRing, MapPin, Zap, ShieldCheck, Clock,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/concierge")({
  head: () => ({
    meta: [
      { title: "Concierge — MelaBridge" },
      { name: "description", content: "Your dedicated event concierge — proactive risk alerts, smart recommendations, and day-of coordination support." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConciergePage,
});

const FEATURES = [
  {
    icon: BellRing,
    title: "Proactive risk alerts",
    desc: "Concierge monitors your event in real time — flagging vendor gaps, schedule conflicts, and budget overruns before they become problems.",
  },
  {
    icon: Zap,
    title: "Smart recommendations",
    desc: "AI-driven nudges based on your event type, guest count, and budget — right when you need them, not after.",
  },
  {
    icon: MapPin,
    title: "Day-of coordination",
    desc: "Real-time runsheet, vendor check-ins, and guest tracking all in one view so you can focus on the moment, not the logistics.",
  },
  {
    icon: ShieldCheck,
    title: "Contingency planning",
    desc: "Automatic backup suggestions for vendor no-shows, weather changes, and venue surprises — with one-tap rescheduling.",
  },
];

function ConciergePage() {
  return (
    <AppShell active="/concierge">
      <div className="space-y-8">
        <PageHeader
          eyebrow="Concierge"
          icon={LifeBuoy}
          title="Your dedicated event concierge"
          description="Proactive risk alerts, smart recommendations, and day-of coordination — all handled by MelaAssist™."
        />

        {/* Coming soon banner */}
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/8 to-gold/5 p-8 text-center shadow-soft">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
          <div className="relative">
            <Badge className="mb-4 gap-1.5 border-primary/30 bg-primary/10 px-3 py-1 text-primary">
              <Clock className="h-3.5 w-3.5" />
              Coming soon
            </Badge>
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h3 className="font-display text-xl font-semibold">
              Concierge is in active development
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              We're building the most capable event coordination layer in the industry. Early access opens with Pro and Elite plans.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="hero" className="gap-1.5">
                <Link to="/dashboard">
                  Back to dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/pricing">View plans</Link>
              </Button>
            </div>
          </div>
        </Card>

        {/* Feature preview grid */}
        <div>
          <p className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-widest">What's coming</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <Card
                key={f.title}
                className="flex items-start gap-4 border-border/60 p-5 shadow-soft"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{f.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
