import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  Bell,
  Settings as SettingsIcon,
  CheckCheck,
  Trash2,
  MessageSquare,
  CreditCard,
  Sparkles,
  Users,
  ShieldCheck,
  Circle,
  Search,
  Briefcase,
  Ticket,
  Wallet,
  Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useNotifications, type NotificationRow } from "@/hooks/use-notifications";
import { useRole } from "@/lib/use-role";
import {
  formatDistanceToNow,
  isToday,
  isYesterday,
  isThisWeek,
} from "date-fns";
import { cn } from "@/lib/utils";
import { ModuleLoading, RouteError } from "@/components/module-states";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — MelaBridge" },
      {
        name: "description",
        content: "Ripples, mentions, RSVPs and payment updates in one calm feed.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
  errorComponent: RouteError,
});

const iconFor = (category: string) => {
  switch (category) {
    case "messages":
      return MessageSquare;
    case "payments":
      return CreditCard;
    case "ai":
      return Sparkles;
    case "team":
      return Users;
    case "booking":
      return Briefcase;
    case "system":
      return ShieldCheck;
    case "tickets":
      return Ticket;
    case "budget":
      return Wallet;
    case "rsvp":
      return Users;
    case "calendar":
      return Calendar;
    default:
      return Bell;
  }
};

type Filter =
  | "all"
  | "unread"
  | "rsvp"
  | "budget"
  | "booking"
  | "messages"
  | "payments"
  | "team"
  | "system"
  | "ai"
  | "tickets"
  | "calendar";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "rsvp", label: "RSVPs" },
  { key: "budget", label: "Budget" },
  { key: "booking", label: "Bookings" },
  { key: "calendar", label: "Calendar" },
  { key: "messages", label: "Messages" },
  { key: "payments", label: "Payments" },
  { key: "tickets", label: "Tickets" },
  { key: "team", label: "Team" },
  { key: "ai", label: "AI" },
  { key: "system", label: "System" },
];

// ── Date grouping ────────────────────────────────────────────────────────────

type DateGroup = "Today" | "Yesterday" | "This week" | "Older";

function getDateGroup(iso: string): DateGroup {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return "This week";
  return "Older";
}

const GROUP_ORDER: DateGroup[] = ["Today", "Yesterday", "This week", "Older"];

// ── Page ─────────────────────────────────────────────────────────────────────

function NotificationsPage() {
  const { items, unreadCount, isLoading, markRead, markAllRead, remove } =
    useNotifications(200);
  const { role } = useRole();
  const vendorMode = role === "vendor";
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const { user, loading: authLoading } = useRequireAuth();

  const visibleItems = useMemo(
    () =>
      vendorMode
        ? items.filter((n) => ["system", "ai", "calendar"].includes(n.category))
        : items,
    [items, vendorMode],
  );
  const visibleUnreadCount = useMemo(
    () => visibleItems.filter((n) => !n.read_at).length,
    [visibleItems],
  );
  const visibleFilters = vendorMode
    ? FILTERS.filter((f) => ["all", "unread", "calendar", "ai", "system"].includes(f.key))
    : FILTERS;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return visibleItems.filter((n) => {
      if (filter === "unread" && n.read_at) return false;
      if (filter !== "all" && filter !== "unread" && n.category !== filter)
        return false;
      if (!term) return true;
      return `${n.title} ${n.body ?? ""}`.toLowerCase().includes(term);
    });
  }, [visibleItems, filter, q]);

  // Group by date bucket
  const grouped = useMemo(() => {
    const map = new Map<DateGroup, NotificationRow[]>();
    for (const n of filtered) {
      const g = getDateGroup(n.created_at);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(n);
    }
    // Return only non-empty groups in canonical order
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      label: g,
      items: map.get(g)!,
    }));
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: visibleItems.length, unread: visibleUnreadCount };
    for (const n of visibleItems) c[n.category] = (c[n.category] ?? 0) + 1;
    return c;
  }, [visibleItems, visibleUnreadCount]);

  if (authLoading || !user) return null; // AppShell redirect handles unauthenticated

  return (
    <AppShell active="/notifications">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Notifications"
          title={vendorMode ? "Profile updates, calmly delivered" : "Your event, calmly delivered"}
          description={
            vendorMode
              ? "Profile, availability, and MelaAssist updates grouped by recency."
              : "Grouped by recency. MelaAssist™ pre-triages what needs your attention."
          }
          icon={Bell}
          actions={
            <div className="flex items-center gap-2">
              {visibleUnreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    vendorMode
                      ? markRead(visibleItems.filter((n) => !n.read_at).map((n) => n.id))
                      : markAllRead()
                  }
                >
                  <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings">
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  Preferences
                </Link>
              </Button>
            </div>
          }
        />

        {/* Search + filter bar */}
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
            {visibleFilters.map((f) => {
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
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px]",
                        active ? "bg-primary-foreground/20" : "bg-muted",
                      )}
                    >
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <ModuleLoading rows={4} showStats={false} />
        ) : filtered.length === 0 ? (
          <Card className="border-border/60 p-10 text-center shadow-soft">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-semibold">
                {visibleItems.length === 0
                ? "You're all caught up"
                : "No matching notifications"}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {visibleItems.length === 0
                 ? vendorMode
                   ? "Profile, availability, and MelaAssist updates will appear here."
                   : "Budget alerts, RSVP activity, vendor responses, and task reminders will appear here."
                : "Try a different filter or clear the search."}
            </p>
            {visibleItems.length === 0 && (
              <Button variant="outline" className="mt-4" asChild>
                <Link to="/settings">Notification preferences</Link>
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ label, items: groupItems }) => (
              <section key={label}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {label}
                </h2>
                <div className="space-y-2">
                  {groupItems.map((n) => (
                    <NotificationItem
                      key={n.id}
                      n={n}
                      onRead={() => !n.read_at && markRead([n.id])}
                      onDelete={() => remove(n.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ── Item ─────────────────────────────────────────────────────────────────────

function NotificationItem({
  n,
  onRead,
  onDelete,
}: {
  n: NotificationRow;
  onRead: () => void;
  onDelete: () => void;
}) {
  const Icon = iconFor(n.category);
  const unread = !n.read_at;

  // Use a Card as the root so we never nest interactive elements (<button> inside
  // <button> or <button> inside <a> are both invalid HTML). The text area handles
  // the read/navigate action; the delete button is a sibling, not a descendant of
  // another interactive element.
  const handleReadClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
    onRead();
    if (n.href) {
      // Let the Link's own onClick handle navigation — do nothing extra here.
    }
  };

  const textArea = n.href ? (
    <Link
      to={n.href as any}
      onClick={onRead}
      className="flex min-w-0 flex-1 items-start gap-3 focus:outline-none"
    >
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
          unread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{n.title}</p>
          {unread && (
            <Circle className="h-2 w-2 shrink-0 fill-primary text-primary" aria-label="Unread" />
          )}
          <Badge variant="secondary" className="ml-auto shrink-0 capitalize">
            {n.category}
          </Badge>
        </div>
        {n.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {n.body}
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </p>
      </div>
    </Link>
  ) : (
    <button
      type="button"
      onClick={handleReadClick as React.MouseEventHandler}
      className="flex min-w-0 flex-1 items-start gap-3 text-left focus:outline-none"
    >
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
          unread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{n.title}</p>
          {unread && (
            <Circle className="h-2 w-2 shrink-0 fill-primary text-primary" aria-label="Unread" />
          )}
          <Badge variant="secondary" className="ml-auto shrink-0 capitalize">
            {n.category}
          </Badge>
        </div>
        {n.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {n.body}
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </p>
      </div>
    </button>
  );

  return (
    <Card
      className={cn(
        "flex items-center gap-3 p-4 shadow-soft transition",
        unread ? "border-primary/40 bg-primary/5" : "border-border/60",
      )}
    >
      {textArea}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Archive notification"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </Card>
  );
}
