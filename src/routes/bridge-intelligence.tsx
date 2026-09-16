import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Sparkles, TrendingUp, DollarSign, CalendarRange,
  Users, Clock, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/bridge-intelligence")({
  head: () => ({
    meta: [
      { title: "Bridge Intelligence™ — MelaBridge" },
      { name: "description", content: "AI-powered event benchmarks, market insights, and planning intelligence." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BridgeIntelligencePage,
});

const FEATURES = [
  {
    icon: DollarSign,
    title: "Budget benchmarks",
    desc: "See how your event budget compares to similar events by type, guest count, and region — so you know where you're overspending and where you can save.",
  },
  {
    icon: TrendingUp,
    title: "Vendor market rates",
    desc: "Real pricing data across vendor categories, updated continuously, so you can negotiate from a position of knowledge.",
  },
  {
    icon: CalendarRange,
    title: "Seasonal insights",
    desc: "Peak dates, popular venues, and vendor availability trends — surfaced months in advance so you can plan around the competition.",
  },
  {
    icon: Users,
    title: "RSVP trend analysis",
    desc: "Predict your final attendance with confidence based on response patterns from comparable events.",
  },
];

function BridgeIntelligencePage() {
  return (
    <PublicShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Bridge Intelligence™ · AI market insights"
          icon={BarChart3}
          title="Smarter decisions, backed by data"
          description="AI-powered benchmarks, vendor market rates, seasonal insights, and planning intelligence drawn from real events."
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
              Bridge Intelligence™ is in active development
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Real-time benchmarks, budget comparisons, RSVP trend analysis, and seasonal pricing insights — built into your planning workflow.
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

        {/* Feature preview */}
        <div>
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">What's coming</p>
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
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
