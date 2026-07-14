import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Handshake, Users, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/collaboration")({
  head: () => ({
    meta: [
      { title: "Collaboration Workspace™ — MelaBridge" },
      { name: "description", content: "Roles, mentions, shared notes, and activity for your event team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CollabPage,
});

function CollabPage() {
  return (
    <AppShell active="/collaboration">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Collaboration Workspace™"
          icon={Handshake}
          title="Plan together, without the chaos"
          description="Team access is managed on the Team page. Shared notes, approvals, and activity feed launching soon."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <ActionCard
            icon={Users}
            title="Manage your team"
            description="Invite planners, family, and collaborators to your event."
            to="/team"
            cta="Open Team"
          />
          <ActionCard
            icon={MessageSquare}
            title="Message your team"
            description="Threaded conversations with planners, vendors, and guests."
            to="/messaging"
            cta="Open Messages"
          />
        </div>

        <Card className="border-primary/20 bg-primary/5 p-5">
          <p className="text-sm">
            <span className="font-semibold">Roadmap: </span>
            Shared notes, approval workflows, activity feed, and AI meeting summaries are on our near-term roadmap. Vote on features in the Help Center.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  to,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  to: string;
  cta: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <Button asChild size="sm" className="mt-3"><Link to={to}>{cta}</Link></Button>
        </div>
      </div>
    </Card>
  );
}
