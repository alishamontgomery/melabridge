import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Bell, Settings as SettingsIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — MelaBridge" },
      { name: "description", content: "Ripples, mentions, RSVPs and payment updates in one calm feed." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <AppShell active="/notifications">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Notifications"
          title="Your event, calmly delivered"
          description="Grouped by urgency. MelaAssist™ pre-triages what needs your attention."
          icon={Bell}
          actions={
            <Button variant="outline" asChild>
              <Link to="/settings"><SettingsIcon className="mr-2 h-4 w-4" />Preferences</Link>
            </Button>
          }
        />
        <Card className="border-border/60 p-10 text-center shadow-soft">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <h3 className="font-display text-lg font-semibold">You're all caught up</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            New notifications about your events, guests, and vendors will appear here.
            Configure your channels and quiet hours in Settings.
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/settings">Notification preferences</Link>
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
