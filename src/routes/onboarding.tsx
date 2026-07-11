import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Rocket, CheckCircle2, Circle, Sparkles, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome to MelaBridge" },
      { name: "description", content: "Set up MelaBridge in five calm steps." },
    ],
  }),
  component: OnboardingPage,
});

const STEPS = [
  { t: "Create your profile", d: "Name, photo, and preferred language.", done: true, to: "/profile" as const },
  { t: "Meet Bridge Concierge™", d: "Answer a few questions to shape your first event.", done: true, to: "/concierge" as const },
  { t: "Invite your team", d: "Co-hosts, planners, and vendors.", done: false, to: "/team" as const },
  { t: "Connect BridgePay™", d: "Secure payments in under two minutes.", done: false, to: "/bridgepay" as const },
  { t: "Share your event", d: "Public microsite and guest portal.", done: false, to: "/share" as const },
];

function OnboardingPage() {
  const done = STEPS.filter((s) => s.done).length;
  const pct = Math.round((done / STEPS.length) * 100);
  return (
    <AppShell active="/onboarding">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Welcome"
          title={<>Let's set you up in <span className="bg-gradient-to-r from-primary to-gold bg-clip-text text-transparent">under 5 minutes</span></>}
          description="MelaBridge learns as you go. Complete these steps and Concierge takes it from there."
          icon={Rocket}
          actions={<Badge variant="secondary">{done}/{STEPS.length} complete</Badge>}
        />
        <Card className="border-border/60 p-5 shadow-soft">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Setup progress</span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <Progress value={pct} />
        </Card>
        <div className="space-y-3">
          {STEPS.map((s, i) => (
            <Card key={s.t} className={`flex items-center justify-between gap-4 border-border/60 p-4 shadow-soft ${s.done ? "opacity-70" : ""}`}>
              <div className="flex items-center gap-3">
                {s.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-semibold">Step {i + 1} · {s.t}</p>
                  <p className="text-xs text-muted-foreground">{s.d}</p>
                </div>
              </div>
              <Button asChild variant={s.done ? "outline" : "default"} size="sm" className="gap-1">
                <Link to={s.to}>{s.done ? "Review" : "Start"} <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </Card>
          ))}
        </div>
        <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm">Prefer a guided tour? Concierge can walk you through the whole platform.</p>
          </div>
          <Button asChild><Link to="/tutorials">Start tutorial</Link></Button>
        </Card>
      </div>
    </AppShell>
  );
}
