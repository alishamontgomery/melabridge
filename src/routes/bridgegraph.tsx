import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { PublicShell } from "@/components/public-shell";
import { Network, Users, Store, Calendar, Sparkles } from "lucide-react";
import { ModuleGrid } from "@/components/module-page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/bridgegraph")({
  head: () => ({
    meta: [
      { title: "BridgeGraph™ — MelaBridge" },
      { name: "description", content: "The living relationship graph across every event, guest, vendor, and moment." },
    ],
  }),
  component: GraphPage,
});

function GraphPage() {
  return (
    <PublicShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="BridgeGraph™"
          title="Your relationships, mapped"
          description="A living graph of every person, vendor, event, and moment across your MelaBridge life. Concierge uses it to recommend, remember, and reconnect."
          icon={Network}
        />
        <Card className="relative aspect-[16/9] overflow-hidden border-border/60 shadow-soft">
          <svg viewBox="0 0 400 220" className="absolute inset-0 h-full w-full">
            <defs>
              <radialGradient id="g" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="200" cy="110" r="90" fill="url(#g)" />
            {[
              [200, 110], [80, 60], [320, 60], [70, 170], [330, 170], [200, 30], [200, 190], [140, 100], [260, 120],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i === 0 ? 12 : 6} className="fill-primary" opacity={i === 0 ? 1 : 0.7} />
            ))}
            {[
              [200, 110, 80, 60], [200, 110, 320, 60], [200, 110, 70, 170], [200, 110, 330, 170],
              [200, 110, 200, 30], [200, 110, 200, 190], [200, 110, 140, 100], [200, 110, 260, 120],
              [80, 60, 140, 100], [320, 60, 260, 120],
            ].map(([x1, y1, x2, y2], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-primary" strokeWidth="0.5" opacity="0.4" />
            ))}
          </svg>
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> 1,204 people</Badge>
            <Badge variant="secondary" className="gap-1"><Store className="h-3 w-3" /> 86 vendors</Badge>
            <Badge variant="secondary" className="gap-1"><Calendar className="h-3 w-3" /> 12 events</Badge>
            <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" /> 340 memories</Badge>
          </div>
        </Card>
        <ModuleGrid
          features={[
            { icon: Users, title: "People you plan with", detail: "Family, friends, and collaborators — grouped by household and role." },
            { icon: Store, title: "Trusted vendors", detail: "Vendors you've booked, plus those recommended by your circle." },
            { icon: Calendar, title: "Event constellations", detail: "How each event connects to milestones in your BridgeWorld™ timeline." },
            { icon: Sparkles, title: "Memory threads", detail: "Auto-linked photos, notes, and voice memos across events." },
          ]}
        />
      </div>
    </PublicShell>
  );
}
