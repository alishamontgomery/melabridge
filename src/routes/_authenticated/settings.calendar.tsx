import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar as CalendarIcon, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/calendar")({
  head: () => ({
    meta: [
      { title: "External Calendar Sync — MelaBridge" },
      {
        name: "description",
        content: "External calendar sync (Google, Outlook, Apple) coming soon.",
      },
    ],
  }),
  component: CalendarSyncPage,
});

function CalendarSyncPage() {
  const providers = [
    { name: "Google Calendar", icon: "G", iconClass: "bg-blue-500/10 text-blue-600" },
    { name: "Microsoft Outlook", icon: "O", iconClass: "bg-sky-500/10 text-sky-600" },
    { name: "Apple Calendar", icon: "A", iconClass: "bg-slate-500/10 text-slate-700" },
  ];

  return (
    <AppShell active="/settings">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">External calendar sync</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Two-way sync with your favorite calendar apps is on the roadmap. In the meantime, MelaBridge
            Calendar has everything you need to manage your bookings.
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <CalendarIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Use MelaBridge Calendar</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage availability, booking requests, events, and revenue all in one place.
              </p>
              <div className="mt-3">
                <Button asChild size="sm" variant="hero">
                  <Link to="/calendar">Open calendar</Link>
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          {providers.map((p) => (
            <Card key={p.name} className="p-5 opacity-80">
              <div className="flex items-center gap-4">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg font-semibold ${p.iconClass}`}>
                  {p.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{p.name}</h3>
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" /> Coming soon
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Two-way sync with {p.name} will be available in a future release.
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled>
                  Notify me
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
