import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Bell, Settings as SettingsIcon, CheckCheck, Trash2, MessageSquare, CreditCard, Sparkles, Users, ShieldCheck, Circle, Search, Briefcase } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useNotifications, type NotificationRow } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

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
    case "booking": return Briefcase;
    case "system": return ShieldCheck;
    default: return Bell;
  }
};

type Filter = "all" | "unread" | "messages" | "booking" | "payments" | "team" | "system" | "ai";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "booking", label: "Bookings" },
  { key: "messages", label: "Messages" },
  { key: "payments", label: "Payments" },
  { key: "team", label: "Team" },
  { key: "ai", label: "AI" },
  { key: "system", label: "System" },
];

function NotificationsPage() {
  const { items, unreadCount, isLoading, markRead, markAllRead, remove } = useNotifications(100);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((n) => {
      if (filter === "unread" && n.read_at) return false;
      if (filter !== "all" && filter !== "unread" && n.category !== filter) return false;
      if (!term) return true;
      return `${n.title} ${n.body ?? ""}`.toLowerCase().includes(term);
    });
  }, [items, filter, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length, unread: unreadCount };
    for (const n of items) c[n.category] = (c[n.category] ?? 0) + 1;
    return c;
  }, [items, unreadCount]);

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

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search notifications…"
              className="pl-9"
            />
          </div>
          <div className="-mx-1 flex flex-wrap gap-1.5 overflow-x-auto px-1">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const n = counts[f.key];
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                  {typeof n === "number" && n > 0 && (
                    <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-primary-foreground/20" : "bg-muted")}>
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">Loading…</Card>
        ) : filtered.length === 0 ? (
          <Card className="border-border/60 p-10 text-center shadow-soft">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-semibold">
              {items.length === 0 ? "You're all caught up" : "No matching notifications"}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {items.length === 0
                ? "New notifications about your events, guests, and vendors will appear here."
                : "Try a different filter or clear the search."}
            </p>
            {items.length === 0 && (
              <Button variant="outline" className="mt-4" asChild>
                <Link to="/settings">Notification preferences</Link>
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => (
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
        aria-label="Archive notification"
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
