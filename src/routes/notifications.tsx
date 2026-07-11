import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Bell, CheckCircle2, AlertTriangle, Sparkles, Users, Wallet, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — MelaBridge" },
      { name: "description", content: "Every ripple, mention, RSVP, and payment update in one calm feed." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

const ITEMS = [
  { icon: Sparkles, tone: "text-primary", title: "Concierge optimized your timeline", detail: "Health score +8. Review 4 changes.", time: "2m", unread: true },
  { icon: Wallet, tone: "text-gold", title: "Milestone payment released", detail: "$1,200 sent to Aurora Blooms.", time: "1h", unread: true },
  { icon: Users, tone: "text-primary", title: "12 new RSVPs", detail: "Reception count updated to 168.", time: "3h", unread: true },
  { icon: AlertTriangle, tone: "text-destructive", title: "Vendor overlap detected", detail: "Simulator found load-in conflict at 10:00.", time: "5h" },
  { icon: Calendar, tone: "text-primary", title: "Master timeline reminder", detail: "Book photographer within 14 days.", time: "Yesterday" },
  { icon: CheckCircle2, tone: "text-primary", title: "Contract signed — Studio Nine", detail: "Archived in BridgeVault™.", time: "2d" },
];

function NotificationsPage() {
  return (
    <AppShell active="/notifications">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Notifications"
          title="Your event, calmly delivered"
          description="Grouped by urgency. Bridge Concierge™ pre-triages what needs your attention."
          icon={Bell}
          actions={<Button variant="outline">Mark all read</Button>}
        />
        <div className="flex flex-wrap gap-2">
          {["All", "Mentions", "Payments", "RSVPs", "Vendors", "Concierge"].map((t, i) => (
            <Badge key={t} variant={i === 0 ? "default" : "secondary"} className="cursor-pointer">{t}</Badge>
          ))}
        </div>
        <Card className="divide-y divide-border/60 border-border/60 shadow-soft">
          {ITEMS.map((n, i) => (
            <div key={i} className={`flex items-start gap-3 p-4 ${n.unread ? "bg-accent/30" : ""}`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent ${n.tone}`}>
                <n.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{n.time}</span>
                </div>
                <p className="text-xs text-muted-foreground">{n.detail}</p>
              </div>
              {n.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </div>
          ))}
        </Card>
      </div>
    </AppShell>
  );
}
