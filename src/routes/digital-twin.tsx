import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Boxes, Sparkles, Users, Route as RouteIcon, BarChart3, Clock,
  Layers, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/digital-twin")({
  head: () => ({
    meta: [
      { title: "Digital Twin™ — MelaBridge" },
      { name: "description", content: "A live simulation of your entire event — venue, guests, timelines, and flow." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TwinPage,
});

const FEATURES = [
  {
    icon: Layers,
    title: "Live venue simulation",
    desc: "A real-time model of your venue, table layouts, stage positioning, and foot-traffic flow — updated as your guest list evolves.",
  },
  {
    icon: Users,
    title: "Guest movement modeling",
    desc: "See how guests will flow through your space. Identify bottlenecks at check-in, the bar, and the dance floor before the event.",
  },
  {
    icon: RouteIcon,
    title: "Timeline stress testing",
    desc: "Run your runsheet through thousands of simulations to surface where delays cascade and what buffers actually matter.",
  },
  {
    icon: BarChart3,
    title: "Predictive event health",
    desc: "Your Digital Twin feeds the Event Health Score in real time — so you always know if you're on track or if something needs attention.",
  },
];

function TwinPage() {
  return (
    <AppShell active="/digital-twin">
      <div className="space-y-8">
        <PageHeader
          eyebrow="Digital Twin™"
          title="A live simulation of your event"
          description="See your venue, guest flow, timelines, and vendor movement as a real-time twin."
          icon={Boxes}
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
              Digital Twin™ is in active development
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              A first-of-its-kind simulation layer for live events. No more guesswork — run your event before it happens.
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
