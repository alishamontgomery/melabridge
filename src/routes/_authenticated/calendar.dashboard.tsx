import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, ArrowLeft, CalendarClock, Wallet, Inbox } from "lucide-react";
import { getDashboardSummary } from "@/lib/calendar.functions";

export const Route = createFileRoute("/_authenticated/calendar/dashboard")({
  head: () => ({
    meta: [
      { title: "Calendar Dashboard — MelaBridge" },
      { name: "description", content: "Today, upcoming, and revenue at a glance." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const load = useServerFn(getDashboardSummary);
  const q = useQuery({ queryKey: ["cal-dashboard"], queryFn: () => load() });
  const d = q.data;

  return (
    <AppShell active="/calendar">
      <Link to="/calendar" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to calendar
      </Link>
      <div className="mt-2">
        <PageHeader
          eyebrow="Calendar Dashboard"
          icon={LayoutDashboard}
          title={<>Your day, <span className="text-gradient">at a glance</span>.</>}
          description="Today's schedule, upcoming events, pending approvals, and revenue."
        />
      </div>

      {q.isLoading || !d ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <section className="mt-6 grid gap-3 md:grid-cols-4">
            <Stat icon={CalendarClock} label="Today" value={String(d.today.length)} sub="events scheduled" />
            <Stat icon={CalendarClock} label="This month" value={String(d.monthBookingCount)} sub="confirmed bookings" />
            <Stat icon={Inbox} label="Pending" value={String(d.pending.length)} sub="approvals needed" />
            <Stat icon={Wallet} label="Revenue (mo)" value={`$${d.monthRevenue.toLocaleString()}`} sub="confirmed + completed" />
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-display text-lg font-semibold">Today</h3>
              <div className="mt-3 space-y-2">
                {d.today.length === 0 && <p className="text-sm text-muted-foreground">Nothing on today.</p>}
                {d.today.map((e: any) => (
                  <Link key={e.id} to="/calendar/events/$id" params={{ id: e.id }} className="block rounded-lg border border-border bg-card p-3 hover:bg-accent/40">
                    <div className="flex justify-between">
                      <p className="font-medium">{e.event_name}</p>
                      <Badge variant="secondary">{e.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {e.venue_name ?? "—"}
                    </p>
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-display text-lg font-semibold">Upcoming</h3>
              <div className="mt-3 space-y-2">
                {d.upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming events.</p>}
                {d.upcoming.map((e: any) => (
                  <Link key={e.id} to="/calendar/events/$id" params={{ id: e.id }} className="block rounded-lg border border-border bg-card p-3 hover:bg-accent/40">
                    <div className="flex justify-between">
                      <p className="font-medium">{e.event_name}</p>
                      <Badge variant="secondary">{e.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.starts_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">Pending approvals</h3>
                <Link to="/calendar/requests" className="text-sm text-primary hover:underline">View all →</Link>
              </div>
              <div className="mt-3 space-y-2">
                {d.pending.length === 0 && <p className="text-sm text-muted-foreground">You're all caught up.</p>}
                {d.pending.slice(0, 5).map((r: any) => (
                  <div key={r.id} className="rounded-lg border border-border bg-card p-3">
                    <p className="font-medium">{r.event_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.requested_start).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}
