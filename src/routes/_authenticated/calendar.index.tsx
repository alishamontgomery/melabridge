import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Search, Inbox, LayoutDashboard, Settings2 } from "lucide-react";
import { listEvents } from "@/lib/calendar.functions";
import { useRole } from "@/lib/use-role";

export const Route = createFileRoute("/_authenticated/calendar/")({
  head: () => ({
    meta: [
      { title: "Calendar — MelaBridge" },
      { name: "description", content: "Manage bookings, availability, and requests in your MelaBridge Calendar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CalendarPage,
});

const STATUS_COLORS: Record<string, string> = {
  inquiry: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/15 text-amber-700",
  confirmed: "bg-primary/15 text-primary",
  completed: "bg-emerald-500/15 text-emerald-700",
  cancelled: "bg-rose-500/15 text-rose-700",
  declined: "bg-rose-500/10 text-rose-600",
};

const STATUS_DOT: Record<string, string> = {
  inquiry: "bg-muted-foreground",
  pending: "bg-amber-500",
  confirmed: "bg-primary",
  completed: "bg-emerald-500",
  cancelled: "bg-rose-500",
  declined: "bg-rose-400",
};

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function startOfWeek(d: Date) { const x = new Date(d); x.setDate(d.getDate() - d.getDay()); x.setHours(0,0,0,0); return x; }

function CalendarPage() {
  const load = useServerFn(listEvents);
  const { role } = useRole();
  const showBookingWorkflow = role === "vendor";
  const [cursor, setCursor] = useState(new Date());
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"month" | "agenda">("month");

  const range = useMemo(() => {
    if (view === "month") {
      const s = startOfMonth(cursor); const e = endOfMonth(cursor);
      const gridStart = startOfWeek(s);
      const gridEnd = new Date(gridStart); gridEnd.setDate(gridStart.getDate() + 41); gridEnd.setHours(23,59,59);
      return { from: gridStart.toISOString(), to: gridEnd.toISOString(), gridStart };
    }
    const s = new Date(cursor); s.setHours(0,0,0,0); const e = new Date(s); e.setDate(s.getDate() + 30);
    return { from: s.toISOString(), to: e.toISOString(), gridStart: s };
  }, [cursor, view]);

  const events = useQuery({
    queryKey: ["cal-events", range.from, range.to, status, q],
    queryFn: () =>
      load({
        data: {
          from: range.from,
          to: range.to,
          status: status === "all" ? undefined : (status as any),
          q: q || undefined,
        },
      }),
  });

  return (
    <AppShell active="/calendar">
      <PageHeader
        eyebrow="MelaBridge Calendar"
        icon={CalendarIcon}
        title={<>Your schedule, <span className="text-gradient">at a glance</span>.</>}
        description={showBookingWorkflow ? "Manage availability and incoming event requests." : "See your event dates and upcoming plans in one place."}
        actions={
          <div className="flex flex-wrap gap-2">
            {showBookingWorkflow && <Button asChild size="sm" variant="outline"><Link to="/calendar/dashboard"><LayoutDashboard className="mr-1.5 h-4 w-4" />Dashboard</Link></Button>}
            {showBookingWorkflow && <Button asChild size="sm" variant="outline"><Link to="/calendar/requests"><Inbox className="mr-1.5 h-4 w-4" />Requests</Link></Button>}
            {showBookingWorkflow && <Button asChild size="sm" variant="outline"><Link to="/calendar/settings"><Settings2 className="mr-1.5 h-4 w-4" />Availability</Link></Button>}
            <Button asChild size="sm" variant="hero"><Link to="/events/new"><Plus className="mr-1.5 h-4 w-4" />New event</Link></Button>
          </div>
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setCursor(view === "month" ? addMonths(cursor, -1) : new Date(cursor.getTime() - 30 * 86400000))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center font-display text-lg font-semibold">
            {view === "month"
              ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
              : "Next 30 days"}
          </div>
          <Button size="icon" variant="outline" onClick={() => setCursor(view === "month" ? addMonths(cursor, 1) : new Date(cursor.getTime() + 30 * 86400000))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCursor(new Date())}>Today</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events" className="h-9 w-[180px] pl-7" />
          </div>
          {showBookingWorkflow && <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="inquiry">Inquiry</SelectItem>
              <SelectItem value="pending">Pending approval</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>}
        </div>
      </div>

      {showBookingWorkflow && <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {Object.keys(STATUS_DOT).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} /> {s}
          </span>
        ))}
      </div>}

      <Tabs value={view} onValueChange={(v) => setView(v as "month" | "agenda")} className="mt-4">
        <TabsList className="w-full max-w-xs">
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
        </TabsList>

        <TabsContent value="month" className="mt-4">
          <MonthGrid gridStart={range.gridStart} events={events.data ?? []} cursorMonth={cursor.getMonth()} showStatus={showBookingWorkflow} />
        </TabsContent>
        <TabsContent value="agenda" className="mt-4">
          <AgendaList events={events.data ?? []} showStatus={showBookingWorkflow} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

type Evt = { id: string; event_name: string; starts_at: string; ends_at: string; status: string; venue_name: string | null };

function MonthGrid({ gridStart, events, cursorMonth, showStatus }: { gridStart: Date; events: Evt[]; cursorMonth: number; showStatus: boolean }) {
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d;
  });
  const byDay = new Map<string, Evt[]>();
  for (const e of events) {
    const k = new Date(e.starts_at).toDateString();
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(e);
  }
  const todayStr = new Date().toDateString();
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-medium text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const list = byDay.get(d.toDateString()) ?? [];
          const inMonth = d.getMonth() === cursorMonth;
          const isToday = d.toDateString() === todayStr;
          return (
            <div key={i} className={`min-h-[90px] border-b border-r border-border p-1.5 text-xs ${inMonth ? "" : "bg-muted/20 text-muted-foreground"}`}>
              <div className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${isToday ? "bg-primary text-primary-foreground font-semibold" : ""}`}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((e) => (
                  <Link key={e.id} to="/calendar/events/$id" params={{ id: e.id }} className={`block truncate rounded px-1 py-0.5 text-[10px] ${showStatus ? STATUS_COLORS[e.status] ?? "bg-accent" : "bg-primary/10 text-primary"}`}>
                    {new Date(e.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} {e.event_name}
                  </Link>
                ))}
                {list.length > 3 && <div className="text-[10px] text-muted-foreground">+{list.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaList({ events, showStatus }: { events: Evt[]; showStatus: boolean }) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No events in this range.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {events.map((e) => (
        <Link
          key={e.id}
          to="/calendar/events/$id"
          params={{ id: e.id }}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 transition hover:bg-accent/40"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${showStatus ? STATUS_DOT[e.status] : "bg-primary"}`} />
              <p className="truncate font-medium">{e.event_name}</p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(e.starts_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              {e.venue_name && ` · ${e.venue_name}`}
            </p>
          </div>
          {showStatus && <Badge className={STATUS_COLORS[e.status] ?? ""}>{e.status}</Badge>}
        </Link>
      ))}
    </div>
  );
}
