import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Sparkles } from "lucide-react";

export const Route = createFileRoute("/decisions")({
  head: () => ({
    meta: [
      { title: "Decision Center™ — MelaBridge" },
      { name: "description", content: "Decision Center is not available yet. Use your team workspace to coordinate planning." },
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
          description="Polls, shared vendor comparisons, and approval workflows are not available yet."
        />

        <Card className="p-8 text-center">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h3 className="font-display text-lg font-semibold">Decision Center launching soon</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Decision Center is not available yet. In the meantime, manage team access, guest lists, budgets, tasks, and files using the tools that are live today.
          </p>
          <Button asChild className="mt-4"><Link to="/team">Open team</Link></Button>
        </Card>
      </div>
    </AppShell>
  );
}
