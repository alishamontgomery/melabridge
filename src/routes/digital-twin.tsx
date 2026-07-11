import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Boxes, Sparkles, LayoutGrid, Route as RouteIcon, Users } from "lucide-react";
import { ModuleGrid, Section } from "@/components/module-page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/digital-twin")({
  head: () => ({
    meta: [
      { title: "Digital Twin™ — MelaBridge" },
      { name: "description", content: "A live simulation of your entire event — venue, guests, timelines, and flow." },
    ],
  }),
  component: TwinPage,
});

function TwinPage() {
  return (
    <AppShell active="/digital-twin">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Digital Twin™"
          title="A live simulation of your event"
          description="See your venue, guest flow, timelines, and vendor movement rendered as a real-time twin. Every change ripples here first."
          icon={Boxes}
          actions={<Button className="gap-2 bg-gradient-to-r from-primary to-gold text-primary-foreground"><Sparkles className="h-4 w-4" /> Re-simulate</Button>}
        />
        <Card className="relative aspect-[16/9] overflow-hidden border-border/60 shadow-soft">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,var(--primary)/0.2,transparent_50%),radial-gradient(circle_at_70%_60%,var(--gold)/0.2,transparent_45%)]" />
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 gap-1 p-4 opacity-40">
            {Array.from({ length: 48 }).map((_, i) => (
              <div key={i} className="rounded-sm border border-border/40" />
            ))}
          </div>
          <div className="absolute inset-0 grid place-items-center">
            <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-center backdrop-blur">
              <p className="text-sm font-semibold">Venue twin · Ceremony hall</p>
              <p className="text-xs text-muted-foreground">180 guests · 18 tables · 2 access ramps</p>
            </div>
          </div>
        </Card>
        <ModuleGrid
          features={[
            { icon: LayoutGrid, title: "3D venue layout", detail: "Drag tables, stages, and stations. See sightlines and clearances." },
            { icon: Users, title: "Guest flow simulation", detail: "Watch simulated guests arrive, dine, and dance. Spot bottlenecks." },
            { icon: RouteIcon, title: "Vendor movement paths", detail: "Load-in, service, and load-out routes without collisions." },
            { icon: Sparkles, title: "Time-of-day lighting", detail: "Preview the room at every hour, from ceremony to send-off." },
          ]}
        />
        <Section title="What the twin found">
          <Card className="border-border/60 p-5 text-sm text-muted-foreground shadow-soft">
            Simulator suggests widening the aisle by 40cm and moving the DJ booth 2m from the dance floor to prevent
            speaker fatigue during dinner service.
          </Card>
        </Section>
      </div>
    </AppShell>
  );
}
