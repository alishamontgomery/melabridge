import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/bridgeworld")({
  head: () => ({
    meta: [
      { title: "BridgeWorld™ — MelaBridge" },
      { name: "description", content: "A living timeline of every event and memory you've ever created." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BridgeWorldPage,
});

function BridgeWorldPage() {
  const navigate = useNavigate();
  return (
    <PublicShell>
      <PageHeader
        eyebrow="BridgeWorld™ · Your event universe"
        icon={Globe2}
        title="Every event, every memory"
        description="A living timeline of every event, milestone, and memory you've ever planned and celebrated."
      />
      <Card className="mt-8 p-10 text-center shadow-soft border-border/60">
        <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h3 className="font-display text-lg font-semibold">This feature is in development</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          BridgeWorld™ — a visual timeline of your entire event history, with locations, milestones, and shared memories — is coming to MelaBridge soon.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => navigate({ to: "/events" })}>
          Back to events
        </Button>
      </Card>
    </PublicShell>
  );
}
