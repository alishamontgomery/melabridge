import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { PlayCircle, Sparkles, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  { t: "Meet Bridge Concierge™", d: "Your guided tour of the AI planner.", len: "4 min", level: "Beginner" },
  { t: "Building your first budget", d: "Let Concierge allocate spend intelligently.", len: "6 min", level: "Beginner" },
  { t: "Running the Event Simulator™", d: "Find issues before they happen.", len: "5 min", level: "Intermediate" },
  { t: "Booking vendors via Marketplace", d: "From match to signed contract.", len: "7 min", level: "Beginner" },
  { t: "Setting up BridgePay™ escrow", d: "Protect every payment.", len: "5 min", level: "Intermediate" },
  { t: "Livestreaming with BridgeLive™", d: "Bring remote guests into the room.", len: "8 min", level: "Advanced" },
];

function TutorialsPage() {
  return (
    <AppShell active="/tutorials">
      <div className="space-y-6">
        <PageHeader
          eyebrow="AI Tutorials"
          title="Learn by doing — with Concierge as your guide"
          description="Each tutorial is interactive: Concierge walks you through the real product, in your workspace."
          icon={Sparkles}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TUTORIALS.map((v) => (
            <Card key={v.t} className="group overflow-hidden border-border/60 shadow-soft transition hover:shadow-elegant">
              <div className="relative aspect-video bg-gradient-to-br from-primary/30 via-primary/10 to-gold/20">
                <div className="absolute inset-0 grid place-items-center">
                  <PlayCircle className="h-14 w-14 text-white/90 transition group-hover:scale-110" />
                </div>
                <Badge className="absolute right-2 top-2 gap-1 bg-black/60 text-white">
                  <Clock className="h-3 w-3" /> {v.len}
                </Badge>
              </div>
              <div className="space-y-1 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{v.t}</p>
                  <Badge variant="secondary" className="text-[10px]">{v.level}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{v.d}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
