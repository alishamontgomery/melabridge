import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { PublicShell } from "@/components/public-shell";
import { Sparkles, Clock, BookOpen, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tutorials")({
  head: () => ({
    meta: [
      { title: "AI Tutorials — MelaBridge" },
      { name: "description", content: "Interactive AI-guided walkthroughs for every part of MelaBridge." },
    ],
  }),
  component: TutorialsPage,
});

const TUTORIALS = [
  {
    t: "Meet MelaAssist™",
    d: "Your guided tour of the AI planner. Learn to ask the right questions and unlock instant planning power.",
    len: "4 min",
    level: "Beginner",
    color: "from-primary/30 to-gold/20",
  },
  {
    t: "Building your first budget",
    d: "Let MelaAssist allocate spend intelligently across categories based on your guest count and event type.",
    len: "6 min",
    level: "Beginner",
    color: "from-emerald-500/20 to-teal-500/10",
  },
  {
    t: "Running the Event Simulator™",
    d: "Find schedule conflicts and vendor gaps before they surface on event day.",
    len: "5 min",
    level: "Intermediate",
    color: "from-blue-500/20 to-indigo-500/10",
  },
  {
    t: "Finding vendors via Marketplace",
    d: "From discovery and inquiry to a confirmed vendor — the full workflow.",
    len: "7 min",
    level: "Beginner",
    color: "from-rose-500/20 to-pink-500/10",
  },
  {
    t: "Setting up milestone payments",
    d: "Tracking payment milestones agreed directly with your vendors.",
    len: "5 min",
    level: "Intermediate",
    color: "from-amber-500/20 to-yellow-400/10",
  },
  {
    t: "Livestreaming with BridgeLive™",
    d: "Bring remote guests into the room. Configure hybrid streaming in minutes.",
    len: "8 min",
    level: "Advanced",
    color: "from-purple-500/20 to-violet-500/10",
  },
];

const LEVEL_COLOR: Record<string, string> = {
  Beginner: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Intermediate: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  Advanced: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

function TutorialsPage() {
  return (
    <PublicShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="AI Tutorials"
          title="Learn by doing — with MelaAssist as your guide"
          description="Each tutorial is interactive: MelaAssist walks you through the real product, step by step, in your own workspace."
          icon={Sparkles}
        />

        {/* Coming soon notice */}
        <Card className="flex flex-wrap items-center gap-4 border-primary/20 bg-primary/5 p-5 shadow-soft">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Interactive tutorials are launching soon</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Until then, MelaAssist can walk you through any feature in real time — just ask.
            </p>
          </div>
          <Button asChild variant="hero" size="sm" className="gap-1.5 shrink-0">
            <Link to="/dashboard">
              Open MelaAssist <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TUTORIALS.map((v) => (
            <Card
              key={v.t}
              className="group overflow-hidden border-border/60 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className={`relative aspect-video bg-gradient-to-br ${v.color}`}>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30 transition group-hover:scale-110">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                </div>
                <Badge className="absolute right-2 top-2 gap-1 bg-black/50 text-white text-[10px]">
                  <Clock className="h-3 w-3" /> {v.len}
                </Badge>
                <Badge className={`absolute left-2 top-2 text-[10px] ${LEVEL_COLOR[v.level] ?? ""}`}>
                  {v.level}
                </Badge>
                <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-foreground shadow">
                    Coming soon
                  </span>
                </div>
              </div>
              <div className="space-y-1 p-4">
                <p className="text-sm font-semibold">{v.t}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{v.d}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
