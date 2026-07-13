import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Sparkles } from "lucide-react";

export const Route = createFileRoute("/decisions")({
  head: () => ({
    meta: [
      { title: "Decision Center™ — MelaBridge" },
      { name: "description", content: "Polls, vendor comparisons, and approvals for your event." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DecisionsPage,
});

function DecisionsPage() {
  return (
    <AppShell active="/decisions">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Decision Center™"
          icon={Lightbulb}
          title="Big calls, made together"
          description="Create polls, compare vendors, and approve budget changes as a team."
        />

        <Card className="p-8 text-center">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h3 className="font-display text-lg font-semibold">Decision Center launching soon</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Polls, vendor comparisons, and MelaAssist™ recommendations are on the way. Meanwhile, discuss decisions with your team in messages.
          </p>
          <Button asChild className="mt-4"><Link to="/messaging">Open messages</Link></Button>
        </Card>
      </div>
    </AppShell>
  );
}
