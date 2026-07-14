import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { EventDashboardPreview, type DashboardData } from "@/components/event-dashboard-preview";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useActiveEvent } from "@/lib/use-active-event";
import { Sparkles, Plus, LayoutDashboard, Loader2 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MelaBridge" },
      {
        name: "description",
        content: "Your live event dashboard: countdown, guests, budget, tasks and vendor activity in one place.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDue(iso?: string | null) {
  if (!iso) return undefined;
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function daysBetween(from: Date, iso?: string | null) {
  if (!iso) return 0;
  const then = new Date(iso);
  return Math.max(0, Math.ceil((then.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

function DashboardPage() {
  const { user } = useRequireAuth();
  const { event, loading } = useActiveEvent();

  const dashQ = useQuery({
    queryKey: ["dashboard", event?.id],
    enabled: !!event?.id,
    queryFn: async () => {
      const eventId = event!.id;
      const [g, t, b] = await Promise.all([
        supabase.from("guests").select("id, plus_ones, rsvp_status").eq("event_id", eventId).is("deleted_at", null),
        supabase.from("tasks").select("id, title, status, due_date, completed_at").eq("event_id", eventId).is("deleted_at", null).order("due_date", { ascending: true }).limit(6),
        supabase.from("budget_items").select("estimated_amount, actual_amount, paid_amount").eq("event_id", eventId).is("deleted_at", null),
      ]);
      return {
        guests: g.data ?? [],
        tasks: t.data ?? [],
        budgetItems: b.data ?? [],
      };
    },
  });

  const dashboardData: DashboardData | null = useMemo(() => {
    if (!event) return null;
    const guests = dashQ.data?.guests ?? [];
    const tasks = dashQ.data?.tasks ?? [];
    const items = dashQ.data?.budgetItems ?? [];
    const invited = guests.reduce((s: number, g: any) => s + 1 + Number(g.plus_ones ?? 0), 0);
    const confirmed = guests.filter((g: any) => g.rsvp_status === "confirmed" || g.rsvp_status === "attending").length;
    const pending = guests.filter((g: any) => g.rsvp_status === "pending" || g.rsvp_status == null).length;
    const declined = guests.filter((g: any) => g.rsvp_status === "declined").length;
    const spent = items.reduce((s: number, i: any) => s + Number(i.paid_amount ?? i.actual_amount ?? 0), 0);
    const total = Number(event.budget_target ?? 0);
    const today = new Date();
    return {
      eventName: event.name ?? "Untitled event",
      eventType: event.event_type ?? "Event",
      location: event.location ?? "—",
      daysRemaining: daysBetween(today, event.event_date),
      guests: { invited, confirmed, pending, declined },
      budget: { spent, total },
      tasks: tasks.length
        ? tasks.map((t: any) => ({
            id: t.id,
            title: t.title,
            done: t.status === "done" || t.status === "completed" || !!t.completed_at,
            due: fmtDue(t.due_date),
          }))
        : [],
      vendors: [],
      aiRecommendation: tasks.length
        ? "Focus on the earliest due tasks first — small wins compound. MelaAssist will nudge collaborators when a task is at risk."
        : "Add your first tasks to unlock timeline suggestions and AI nudges tailored to your event.",
      activity: [],
      notifications: [],
      timeline: [],
      decisions: [],
    };
  }, [event, dashQ.data]);

  return (
    <AppShell active="/dashboard">
      <PageHeader
        eyebrow="Dashboard"
        icon={LayoutDashboard}
        title={<>Your event, <span className="text-gradient">at a glance</span>.</>}
        description="Live signals from every module — guests, budget, tasks — in one calm view."
        actions={
          <Button asChild variant="hero">
            <Link to="/events/new"><Plus className="mr-2 h-4 w-4" />New event</Link>
          </Button>
        }
      />

      <div className="mt-8">
        {!user || loading || dashQ.isLoading ? (
          <div className="grid min-h-[360px] place-items-center rounded-3xl border border-border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !event ? (
          <EmptyDashboard />
        ) : dashboardData ? (
          <EventDashboardPreview data={dashboardData} chrome={false} />
        ) : null}
      </div>
    </AppShell>
  );
}

function EmptyDashboard() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </span>
      <h2 className="mt-4 font-display text-xl font-semibold">Create your first event to see your dashboard</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Once you create an event, this page fills with real-time signals from your guests, budget, tasks and vendors.
      </p>
      <Button asChild className="mt-5" variant="hero">
        <Link to="/events/new"><Plus className="mr-2 h-4 w-4" />Create an event</Link>
      </Button>
    </div>
  );
}
