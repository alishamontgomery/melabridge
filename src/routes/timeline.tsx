import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Sparkles, Flag, Check } from "lucide-react";
import { useEcosystem } from "@/lib/ecosystem-store";

export const Route = createFileRoute("/timeline")({
  head: () => ({ meta: [
    { title: "Timeline — MelaBridge" },
    { name: "description", content: "Milestone timeline with AI-generated critical path." },
    { name: "robots", content: "noindex" },
  ]}),
  component: TimelinePage,
});

const MILESTONES = [
  { date:"Nov 2025", title:"Venue booked · Save the Dates sent", done:true },
  { date:"Dec 2025", title:"Catering contract + tasting", done:true },
  { date:"Jan 2026", title:"Photographer + florist confirmed", done:false, current:true },
  { date:"Mar 2026", title:"Guest list locked · invitations printed", done:false },
  { date:"Jun 2026", title:"Final RSVPs · seating v1", done:false },
  { date:"Aug 2026", title:"Final vendor walkthrough · final payments", done:false },
  { date:"Oct 17, 2026", title:"Event day 🎉", done:false, milestone:true },
];

function TimelinePage() {
  const { event, health } = useEcosystem();
  return (
    <AppShell active="/timeline">
      <PageHeader
        eyebrow="Timeline"
        icon={Calendar}
        title={<>Your path to <span className="text-gradient">event day</span>.</>}
        description={`${event.name} · ${event.date} · Health ${health}/100 · BridgeMind adjusts the critical path when things slip.`}
        actions={<Button variant="outline"><Sparkles className="mr-2 h-4 w-4"/>Re-plan with AI</Button>}
      />

      <div className="mt-10 relative pl-6">
        <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border"/>
        <ul className="space-y-6">
          {MILESTONES.map(m=>(
            <li key={m.title} className="relative">
              <span className={`absolute -left-6 top-1.5 grid h-4 w-4 place-items-center rounded-full border-2 ${m.done?"border-emerald-500 bg-emerald-500":m.current?"border-primary bg-primary animate-pulse":m.milestone?"border-gold bg-gold":"border-border bg-background"}`}>
                {m.done && <Check className="h-2.5 w-2.5 text-white"/>}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{m.date}</p>
                {m.current && <Badge className="bg-primary/10 text-primary">In progress</Badge>}
                {m.milestone && <Badge className="bg-gold/20 text-foreground gap-1"><Flag className="h-3 w-3"/>Event day</Badge>}
              </div>
              <p className="mt-1 text-lg font-medium">{m.title}</p>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
