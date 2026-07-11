import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Share2, Link as LinkIcon, Globe2, Lock, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModuleGrid } from "@/components/module-page";

export const Route = createFileRoute("/share")({
  head: () => ({
    meta: [
      { title: "Event sharing — MelaBridge" },
      { name: "description", content: "Share your event with guests, vendors, and collaborators with the right level of access." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  return (
    <AppShell active="/share">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Event sharing"
          title="Share thoughtfully. Control precisely."
          description="Public microsite, private guest portal, vendor-scoped views, and collaborator invites — each with the right level of access."
          icon={Share2}
        />
        <Card className="space-y-3 border-border/60 p-5 shadow-soft">
          <p className="text-sm font-semibold">Public event microsite</p>
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-border/60 bg-accent/30 px-3 py-2 text-sm">
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">melabridge.com/e/amara-june-14</span>
            </div>
            <Button variant="outline">Copy</Button>
            <Button>Open</Button>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="gap-1"><Globe2 className="h-3 w-3" /> Public</Badge>
            <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Password protected</Badge>
            <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> Guests-only</Badge>
          </div>
        </Card>
        <ModuleGrid
          features={[
            { icon: Globe2, title: "Public microsite", detail: "Beautiful landing page with story, schedule, and RSVP.", badge: "SEO ready" },
            { icon: Users, title: "Guest portal link", detail: "Private link with personalized schedules and travel info." },
            { icon: Lock, title: "Password-protected", detail: "Add a passcode for extra privacy on sensitive events." },
            { icon: Share2, title: "One-tap invites", detail: "WhatsApp, email, SMS, or copy-link with tracked opens." },
            { icon: LinkIcon, title: "Vendor scoped views", detail: "Vendors see only their brief, deliverables, and payouts." },
            { icon: Users, title: "Collaborator invites", detail: "Add co-hosts and planners with role-based permissions." },
          ]}
        />
      </div>
    </AppShell>
  );
}
