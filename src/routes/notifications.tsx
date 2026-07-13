import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Bell, Settings as SettingsIcon, CheckCheck, Trash2, MessageSquare, CreditCard, Sparkles, Users, ShieldCheck, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications, type NotificationRow } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";

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

const iconFor = (category: string) => {
  switch (category) {
    case "messages": return MessageSquare;
    case "payments": return CreditCard;
    case "ai": return Sparkles;
    case "team": return Users;
    case "system": return ShieldCheck;
    default: return Bell;
  }
};

function NotificationsPage() {
  const { items, unreadCount, isLoading, markRead, markAllRead, remove } = useNotifications();

  return (
    <AppShell active="/notifications">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Notifications"
          title="Your event, calmly delivered"
          description="Grouped by urgency. MelaAssist™ pre-triages what needs your attention."
          icon={Bell}
          actions={
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => markAllRead()}>
                  <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings"><SettingsIcon className="mr-2 h-4 w-4" />Preferences</Link>
              </Button>
            </div>
          }
        />

        {isLoading ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">Loading…</Card>
        ) : items.length === 0 ? (
          <Card className="border-border/60 p-10 text-center shadow-soft">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-semibold">You're all caught up</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              New notifications about your events, guests, and vendors will appear here.
            </p>
            <Button variant="outline" className="mt-4" asChild>
              <Link to="/settings">Notification preferences</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <NotificationItem
                key={n.id}
                n={n}
                onRead={() => !n.read_at && markRead([n.id])}
                onDelete={() => remove(n.id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function NotificationItem({ n, onRead, onDelete }: { n: NotificationRow; onRead: () => void; onDelete: () => void }) {
  const Icon = iconFor(n.category);
  const unread = !n.read_at;
  const inner = (
    <Card
      className={`flex items-start gap-3 p-4 shadow-soft transition ${unread ? "border-primary/40 bg-primary/5" : "border-border/60"}`}
    >
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${unread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{n.title}</p>
          {unread && <Circle className="h-2 w-2 fill-primary text-primary" />}
          <Badge variant="secondary" className="ml-auto capitalize">{n.category}</Badge>
        </div>
        {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
        className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Delete notification"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </Card>
  );

  if (n.href) {
    return (
      <Link to={n.href as any} onClick={onRead} className="block">
        {inner}
      </Link>
    );
  }
  return <button type="button" onClick={onRead} className="block w-full text-left">{inner}</button>;
}
