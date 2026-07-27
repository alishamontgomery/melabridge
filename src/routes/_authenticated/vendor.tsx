import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Store, Calendar, Wallet, Bell, Sparkles,
  UserPlus, FileText, ScrollText, CreditCard, Mail, CalendarSync, CalendarX2,
  TrendingUp, Activity, CheckCircle2, Clock, AlertCircle, Briefcase, Inbox, Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDisplayName } from "@/lib/use-display-name";
import { MelaAssistInsights, MelaAssistActivityFeed, type MelaAssistInsight } from "@/components/melaassist";

export const Route = createFileRoute("/_authenticated/vendor")({
  head: () => ({ meta: [{ title: "Vendor Dashboard — MelaBridge" }] }),
  component: VendorDashboardPage,
});

type EventRow = {
  id: string; name: string; event_date: string | null; start_time: string | null;
  status: string; client_name: string | null; deposit_required: number | null;
  deposit_paid: number | null; payment_status: string | null;
};
type TaskRow = { id: string; title: string; due_date: string | null; status: string; priority: string | null };
type NotifRow = { id: string; title: string; body: string | null; category: string | null; created_at: string; read_at: string | null };


function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const hh = ((h + 11) % 12) + 1;
  const ap = h >= 12 ? "PM" : "AM";
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

const QUICK_ACTIONS = [
  { label: "Complete with MelaAssist", to: "/vendor-profile-builder", icon: Sparkles },
  { label: "Marketplace Listing", to: "/profile", icon: Store },
  { label: "AI Draft Inbox", to: "/drafts", icon: Sparkles },
  { label: "New Lead", to: "/vendor-portal", icon: UserPlus },
  { label: "Create Quote", to: "/bookings", icon: FileText },
  { label: "Send Contract", to: "/bookings", icon: ScrollText },
  { label: "Collect Payment", to: "/bookings", icon: CreditCard },
  { label: "Client Notes", to: "/bookings", icon: Mail },
  { label: "Calendar Sync", to: "/settings/calendar", icon: CalendarSync },
  { label: "Block Dates", to: "/calendar/settings", icon: CalendarX2 },
] as const;

function VendorDashboardPage() {
  const { user } = useAuth();
  const { firstName, businessName } = useDisplayName();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [vendorProfile, setVendorProfile] = useState<Record<string, unknown> | null>(null);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [e, t, n, vp, cr] = await Promise.all([
        supabase.from("events").select("id,name,event_date,start_time,status,client_name,deposit_required,deposit_paid,payment_status").eq("owner_id", user.id).is("deleted_at", null).order("event_date", { ascending: true, nullsFirst: false }).limit(50),
        supabase.from("tasks").select("id,title,due_date,status,priority").eq("assigned_to", user.id).is("deleted_at", null).neq("status", "done").order("due_date", { ascending: true, nullsFirst: false }).limit(10),
        supabase.from("notifications").select("id,title,body,category,created_at,read_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
        supabase.from("vendor_profiles").select("business_name,business_category,business_description,phone,email,website,logo_url,city,state,starting_price,portfolio_urls,business_hours,years_in_business").eq("user_id", user.id).maybeSingle(),
        supabase.from("calendar_booking_requests").select("id", { count: "exact", head: true }).eq("vendor_id", user.id).eq("status", "pending"),
      ]);
      if (cancelled) return;
      setEvents((e.data as EventRow[]) ?? []);
      setTasks((t.data as TaskRow[]) ?? []);
      setNotifs((n.data as NotifRow[]) ?? []);
      setVendorProfile((vp.data as Record<string, unknown> | null) ?? null);
      setPendingRequests(cr.count ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const profileCompletion = useMemo(() => {
    if (!vendorProfile) return 0;
    const fields = ["business_name","business_category","business_description","phone","email","website","logo_url","city","starting_price","portfolio_urls","business_hours","years_in_business"];
    let filled = 0;
    for (const f of fields) {
      const v = vendorProfile[f];
      if (Array.isArray(v)) { if (v.length > 0) filled++; }
      else if (v && typeof v === "object") { if (Object.keys(v as Record<string, unknown>).length > 0) filled++; }
      else if (v != null && String(v).trim() !== "") { filled++; }
    }
    return Math.round((filled / fields.length) * 100);
  }, [vendorProfile]);

  const today = new Date().toISOString().slice(0, 10);
  const startOfMonth = new Date(); startOfMonth.setDate(1);
  const som = startOfMonth.toISOString().slice(0, 10);

  const todaysEvents = events.filter((e) => e.event_date === today);
  const upcomingBookings = events.filter((e) => e.event_date && e.event_date > today && ["confirmed", "tentative", "consultation_scheduled"].includes(e.status));
  const newLeads = events.filter((e) => e.status === "inquiry");
  const revenueThisMonth = events
    .filter((e) => e.event_date && e.event_date >= som && e.event_date <= today)
    .reduce((sum, e) => sum + (Number(e.deposit_paid) || 0), 0);
  const awaitingPayments = events.filter((e) => (Number(e.deposit_required) || 0) > (Number(e.deposit_paid) || 0));

  const overdueTasks = tasks.filter((t) => t.due_date && t.due_date < today);
  const todaysTasks = tasks.filter((t) => t.due_date === today);

  const businessHealth = useMemo(() => {
    let score = 60;
    if (upcomingBookings.length > 0) score += 10;
    if (newLeads.length > 0) score += 10;
    if (revenueThisMonth > 0) score += 10;
    if (overdueTasks.length === 0) score += 10;
    return Math.min(100, score);
  }, [upcomingBookings.length, newLeads.length, revenueThisMonth, overdueTasks.length]);

  return (
    <AppShell active="/vendor">
      <div className="space-y-6">
        {/* Greeting */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{greeting()},</p>
            <h1 className="truncate font-display text-3xl font-semibold">{firstName}</h1>
            {businessName && <p className="mt-1 text-sm text-muted-foreground">{businessName}</p>}
          </div>
          <Button asChild variant="hero" size="sm" className="shrink-0">
            <Link to="/concierge"><Sparkles className="mr-1.5 h-4 w-4" />Ask MelaAssist™</Link>
          </Button>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Calendar} label="Today's events" value={loading ? "—" : String(todaysEvents.length)} />
          <StatTile icon={TrendingUp} label="Revenue this month" value={loading ? "—" : `$${revenueThisMonth.toLocaleString()}`} />
          <StatTile icon={CheckCircle2} label="Upcoming bookings" value={loading ? "—" : String(upcomingBookings.length)} />
          <StatTile icon={UserPlus} label="New leads" value={loading ? "—" : String(newLeads.length)} />
        </div>

        {/* Quick actions */}
        <Card className="border-border/60 p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quick actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {QUICK_ACTIONS.map(({ label, to, icon: Icon }) => (
              <Link
                key={label}
                to={to}
                className="group flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm transition hover:border-primary hover:bg-primary/5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 truncate font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </Card>

        {/* Business modules — every card is a working destination */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ModuleTile icon={UserPlus} label="Leads" value={String(newLeads.length)} hint="Inquiries to reply" to="/vendor-portal" />
          <ModuleTile icon={Briefcase} label="Bookings" value={String(upcomingBookings.length)} hint="Confirmed & tentative" to="/bookings" />
          <ModuleTile icon={Inbox} label="Requests" value={String(pendingRequests)} hint="Pending calendar" to="/calendar/requests" />
          <ModuleTile icon={Calendar} label="Calendar" value={String(todaysEvents.length)} hint="Today" to="/calendar" />
          <ModuleTile icon={Wallet} label="Revenue" value={`$${revenueThisMonth.toLocaleString()}`} hint="This month" to="/bookings" />
          <ModuleTile icon={CheckCircle2} label="Tasks" value={String(tasks.length)} hint={overdueTasks.length ? `${overdueTasks.length} overdue` : "Up to date"} to="/vendor-portal" />
          <ModuleTile icon={Store} label="Marketplace Listing" value={vendorProfile ? "Live" : "Set up"} hint="Public page" to="/profile" />
          <ModuleTile icon={Building2} label="Profile Completion" value={`${profileCompletion}%`} hint={profileCompletion < 100 ? "Finish with MelaAssist" : "Complete"} to="/vendor-profile-builder" progress={profileCompletion} />
        </div>

        {/* Two column: Today / side */}
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Today's schedule */}
          <Card className="border-border/60 p-5 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Today's schedule</h2>
              <Button asChild variant="ghost" size="sm"><Link to="/calendar">Open calendar</Link></Button>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : todaysEvents.length === 0 ? (
              <EmptyRow icon={Calendar} text="Nothing scheduled for today." />
            ) : (
              <ul className="divide-y divide-border/60">
                {todaysEvents.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 py-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link to="/events/$eventId" params={{ eventId: e.id }} className="block truncate font-medium hover:text-primary">{e.name}</Link>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(e.start_time) || "Time TBD"}{e.client_name ? ` · ${e.client_name}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 capitalize">{e.status.replace(/_/g, " ")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Business health */}
          <Card className="border-border/60 p-5 shadow-soft">
            <h2 className="font-display text-base font-semibold">Business health</h2>
            <div className="mt-3 flex items-end gap-3">
              <span className="font-display text-4xl font-semibold">{businessHealth}</span>
              <span className="mb-1 text-xs text-muted-foreground">/ 100</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${businessHealth}%` }} />
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <HealthLine ok={upcomingBookings.length > 0} label={`${upcomingBookings.length} upcoming bookings`} />
              <HealthLine ok={newLeads.length > 0} label={`${newLeads.length} active leads`} />
              <HealthLine ok={revenueThisMonth > 0} label={`Revenue this month: $${revenueThisMonth.toLocaleString()}`} />
              <HealthLine ok={overdueTasks.length === 0} label={overdueTasks.length === 0 ? "No overdue tasks" : `${overdueTasks.length} overdue tasks`} warn={overdueTasks.length > 0} />
            </ul>
          </Card>
        </div>

        {/* Row: Upcoming / Leads / Awaiting payments */}
        <div className="grid gap-4 md:grid-cols-3">
          <ListCard title="Upcoming bookings" empty="No upcoming bookings yet." to="/events" items={upcomingBookings.slice(0, 5).map((e) => ({
            id: e.id, primary: e.name, secondary: `${e.event_date ?? "TBD"}${e.client_name ? ` · ${e.client_name}` : ""}`, href: `/events/${e.id}`,
          }))} loading={loading} />
          <ListCard title="New leads" empty="No leads waiting." to="/vendor-portal" items={newLeads.slice(0, 5).map((e) => ({
            id: e.id, primary: e.client_name ?? e.name, secondary: e.name, href: `/events/${e.id}`,
          }))} loading={loading} />
          <ListCard title="Awaiting payments" empty="All paid up." to="/bookings" items={awaitingPayments.slice(0, 5).map((e) => {
            const rem = (Number(e.deposit_required) || 0) - (Number(e.deposit_paid) || 0);
            return { id: e.id, primary: e.name, secondary: `$${rem.toLocaleString()} outstanding`, href: `/bookings` };
          })} loading={loading} />
        </div>

        {/* Tasks + Notifications */}
        <div className="grid gap-4 lg:grid-cols-2">


          <Card className="border-border/60 p-5 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Today's tasks</h2>
              <Button asChild variant="ghost" size="sm"><Link to="/tasks">All tasks</Link></Button>
            </div>
            {todaysTasks.length === 0 && overdueTasks.length === 0 ? (
              <EmptyRow icon={CheckCircle2} text="You're all caught up." />
            ) : (
              <ul className="divide-y divide-border/60">
                {[...overdueTasks, ...todaysTasks].slice(0, 6).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0 truncate text-sm">{t.title}</span>
                    {t.due_date && t.due_date < today
                      ? <Badge variant="destructive" className="shrink-0">Overdue</Badge>
                      : <Badge variant="secondary" className="shrink-0">Today</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="border-border/60 p-5 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Notifications</h2>
              <Button asChild variant="ghost" size="sm"><Link to="/notifications">All</Link></Button>
            </div>
            {notifs.length === 0 ? <EmptyRow icon={Bell} text="Nothing new." /> : (
              <ul className="divide-y divide-border/60">
                {notifs.slice(0, 5).map((n) => (
                  <li key={n.id} className="py-2.5">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* MelaAssist insights + activity */}
        <div className="grid gap-4 lg:grid-cols-2">
          <MelaAssistInsights
            insights={buildVendorInsights({ awaitingPayments, overdueTasks, newLeads })}
            emptyLabel="All clear. MelaAssist will surface work as it comes in."
          />
          <MelaAssistActivityFeed />
        </div>

      </div>
    </AppShell>
  );
}

function buildVendorInsights({
  awaitingPayments,
  overdueTasks,
  newLeads,
}: {
  awaitingPayments: unknown[];
  overdueTasks: unknown[];
  newLeads: unknown[];
}): MelaAssistInsight[] {
  const out: MelaAssistInsight[] = [];
  if (newLeads.length > 0) {
    out.push({
      id: "new-leads",
      label: `${newLeads.length} inquiry lead${newLeads.length === 1 ? "" : "s"} to answer`,
      detail: "Reply within 24h to boost conversion.",
      tone: "warn",
      prompt: "Draft a warm, professional reply for each of my new inquiry leads.",
    });
  }
  if (awaitingPayments.length > 0) {
    out.push({
      id: "deposits-out",
      label: `${awaitingPayments.length} deposit${awaitingPayments.length === 1 ? "" : "s"} outstanding`,
      detail: "Send a friendly reminder to keep bookings moving.",
      tone: "warn",
      prompt: "Draft a friendly deposit reminder I can send to clients with outstanding payments.",
    });
  }
  if (overdueTasks.length > 0) {
    out.push({
      id: "overdue-tasks",
      label: `${overdueTasks.length} task${overdueTasks.length === 1 ? "" : "s"} overdue`,
      detail: "Reschedule or mark them done.",
      prompt: "Help me triage my overdue tasks — what should I do first?",
    });
  }
  return out;
}

function StatTile({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card className="border-border/60 p-4 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-xs">{label}</p>
      </div>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </Card>
  );
}

function EmptyRow({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
      <Icon className="h-4 w-4" /> {text}
    </div>
  );
}

function HealthLine({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      {warn ? <AlertCircle className="h-4 w-4 text-amber-500" /> : ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Activity className="h-4 w-4 text-muted-foreground" />}
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}

function ListCard({ title, items, empty, to, loading }: {
  title: string; empty: string; to: string; loading: boolean;
  items: Array<{ id: string; primary: string; secondary: string; href: string }>;
}) {
  return (
    <Card className="border-border/60 p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <Button asChild variant="ghost" size="sm"><Link to={to}>View all</Link></Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((it) => (
            <li key={it.id} className="py-2.5">
              <p className="truncate text-sm font-medium">{it.primary}</p>
              <p className="truncate text-xs text-muted-foreground">{it.secondary}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecLine({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <span>{text}</span>
    </li>
  );
}
