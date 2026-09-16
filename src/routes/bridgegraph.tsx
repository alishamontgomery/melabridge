import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Network, Sparkles } from "lucide-react";

export const Route = createFileRoute("/bridgegraph")({
  head: () => ({
    meta: [
      { title: "BridgeGraph™ — MelaBridge" },
      { name: "description", content: "Your social event graph — the web of people, memories, and moments across every event." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BridgeGraphPage,
});

function BridgeGraphPage() {
  const navigate = useNavigate();
  return (
    <PublicShell>
      <PageHeader
        eyebrow="BridgeGraph™ · Social event graph"
        icon={Network}
        title="Your web of people and memories"
        description="See how guests, vendors, and moments connect across every event you've planned."
      />
      <Card className="mt-8 p-10 text-center shadow-soft border-border/60">
        <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h3 className="font-display text-lg font-semibold">This feature is in development</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          BridgeGraph™ — interactive social graphs, relationship maps, and cross-event memory connections — is coming to MelaBridge soon.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => navigate({ to: "/dashboard" })}>
          Back to dashboard
        </Button>
      </Card>
    </PublicShell>
  );
}
