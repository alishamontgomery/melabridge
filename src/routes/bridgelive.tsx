import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Radio, Sparkles } from "lucide-react";

export const Route = createFileRoute("/bridgelive")({
  head: () => ({
    meta: [
      { title: "BridgeLive™ — MelaBridge" },
      { name: "description", content: "Stream your event live to remote guests with interactive reactions, photo sharing, and real-time updates." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BridgeLivePage,
});

function BridgeLivePage() {
  const navigate = useNavigate();
  return (
    <PublicShell>
      <PageHeader
        eyebrow="BridgeLive™ · Live event streaming"
        icon={Radio}
        title="Bring remote guests into the room"
        description="Stream your event live with interactive reactions, real-time photo sharing, and live updates for guests who can't be there in person."
      />
      <Card className="mt-8 p-10 text-center shadow-soft border-border/60">
        <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h3 className="font-display text-lg font-semibold">This feature is in development</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          BridgeLive™ — live streaming, remote guest reactions, real-time photo sharing, and interactive event feeds — is coming to MelaBridge soon.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => navigate({ to: "/guests" })}>
          Back to guests
        </Button>
      </Card>
    </PublicShell>
  );
}
