import { RouteError } from "@/components/module-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useActiveEvent } from "@/lib/use-active-event";
import { Sparkles, Plus, LayoutDashboard, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { WelcomeHeader } from "@/components/dashboard/welcome-header";
import { CountdownStrip } from "@/components/dashboard/countdown-strip";
import { DailyCheckIn } from "@/components/dashboard/daily-checkin";
import { TodaysBrief } from "@/components/dashboard/todays-brief";
import { TodaysFocus } from "@/components/dashboard/todays-focus";
import { EventHealthScore } from "@/components/dashboard/event-health-score";
import { CelebrateProgress } from "@/components/dashboard/celebrate-progress";
import { AIConcierge } from "@/components/dashboard/ai-concierge";
import { AISavings } from "@/components/dashboard/ai-savings";
import { SmartPredictions } from "@/components/dashboard/smart-predictions";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { seedSampleWorkspace } from "@/lib/sample-workspace.functions";
import { MelaAssistInsights, MelaAssistActivityFeed, type MelaAssistInsight } from "@/components/melaassist";
import { useDisplayName } from "@/lib/use-display-name";

import {
  computeCountdown,
  computeHealthScore,
  buildDailyBrief,
  pickTodaysFocus,
  computePredictions,
  computeSavings,
  getMilestones,
} from "@/lib/dashboard-intelligence";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MelaBridge" },
      { name: "description", content: "Your AI planning companion: personalized brief, health score, and today's focus." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
  errorComponent: RouteError,
});


function DashboardPage() {
  const { user } = useRequireAuth();
  const { event, loading } = useActiveEvent();
  const qc = useQueryClient();

  const dashQ = useQuery({
    queryKey: ["dashboard-companion", event?.id],
    enabled: !!event?.id,
    queryFn: async () => {
      const eventId = event!.id;
      const [g, t, b] = await Promise.all([
        supabase.from("guests").select("id, plus_ones, rsvp_status, created_at").eq("event_id", eventId).is("deleted_at", null),
        supabase.from("tasks").select("id, title, status, priority, due_date, completed_at").eq("event_id", eventId).is("deleted_at", null),
        supabase.from("budget_items").select("id, category, estimated_amount, actual_amount, paid_amount, vendor_name").eq("event_id", eventId).is("deleted_at", null),
      ]);
      return { guests: g.data ?? [], tasks: t.data ?? [], budget: b.data ?? [] };
    },
  });

  const derived = useMemo(() => {
    if (!event) return null;
    const guests = (dashQ.data?.guests ?? []) as any[];
    const tasks = (dashQ.data?.tasks ?? []) as any[];
    const budget = (dashQ.data?.budget ?? []) as any[];
    const countdown = computeCountdown(event.event_date);
    const health = computeHealthScore({ event, guests, tasks, budget });
    const brief = buildDailyBrief({ event, guests, tasks, budget, countdown });
    const focus = pickTodaysFocus({ event, tasks, guests, budget, countdown });
    const predictions = computePredictions({ event, guests, budget, countdown });
    const savings = computeSavings({ event, budget, countdown });
    const milestones = getMilestones({ event, guests, budget, tasks, countdown });
    return { countdown, health, brief, focus, predictions, savings, milestones };
  }, [event, dashQ.data]);

  const { firstName } = useDisplayName();

  return (
    <AppShell active="/dashboard">
      <PageHeader
        eyebrow="Dashboard"
        icon={LayoutDashboard}
        title={<>Your planning <span className="text-gradient">companion</span>.</>}
        description="A calm, personalized command center — refreshed every time you visit."
        actions={
          event ? (
            <Button asChild variant="hero">
              <Link to="/events/new"><Plus className="mr-2 h-4 w-4" />New event</Link>
            </Button>
          ) : null
        }
      />

      <div className="mt-8 space-y-6">
        {!user || loading || dashQ.isLoading ? (
          <DashboardSkeleton />
        ) : dashQ.isError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <p className="font-semibold text-destructive">Could not load dashboard data</p>
            <p className="mt-1 text-sm text-muted-foreground">There was a problem connecting to your workspace. Please refresh the page.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => dashQ.refetch()}>Try again</Button>
          </div>
        ) : !event || !derived ? (
          <EmptyDashboard firstName={firstName} />
        ) : (
          <>
            <WelcomeHeader
              firstName={firstName}
              eventLabel={event.name ?? "Your event"}
              daysAway={derived.countdown.days}
              onTrack={derived.health.overall}
            />
            <CountdownStrip eventDate={event.event_date} />
            <CelebrateProgress milestones={derived.milestones} />
            <DailyCheckIn />

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <TodaysFocus focus={derived.focus} />
                <TodaysBrief items={derived.brief} />
                <AIConcierge eventId={event.id} />
              </div>
              <div className="space-y-6">
                <MelaAssistInsights insights={buildDashboardInsights(derived, event)} />
                <EventHealthScore health={derived.health} />
                <SmartPredictions items={derived.predictions} />
                <AISavings items={derived.savings.items} total={derived.savings.total} />
                <MelaAssistActivityFeed />
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function buildDashboardInsights(derived: any, event: { id: string; name?: string | null }): MelaAssistInsight[] {
  const out: MelaAssistInsight[] = [];
  const health = derived.health?.overall ?? 100;
  if (health < 70) {
    out.push({
      id: "health-low",
      label: `Event health at ${health}%`,
      detail: "A few areas are slipping — let's tighten them up.",
      tone: "warn",
      prompt: `My event health score is ${health}%. What are the top 3 things I should fix this week?`,
    });
  }
  const focus = derived.focus;
  if (focus?.title) {
    out.push({
      id: "focus-today",
      label: `Today's focus: ${focus.title}`,
      detail: focus.reason ?? "Knock this one out first.",
      prompt: `Help me complete: ${focus.title}.`,
    });
  }
  const brief = (derived.brief ?? []) as Array<{ title: string; detail?: string; tone?: string }>;
  const warn = brief.find((b) => b.tone === "warn" || b.tone === "risk");
  if (warn) {
    out.push({
      id: "brief-warn",
      label: warn.title,
      detail: warn.detail,
      tone: "warn",
      prompt: `Help me address: ${warn.title}.`,
    });
  }
  const days = derived.countdown?.days;
  if (typeof days === "number" && days <= 14 && days >= 0) {
    out.push({
      id: "countdown-tight",
      label: `${days} days until "${event.name ?? "your event"}"`,
      detail: "I can build a final-stretch checklist for you.",
      prompt: `Draft a final ${days}-day checklist to run "${event.name ?? "my event"}" smoothly.`,
    });
  }
  return out.slice(0, 4);
}

function EmptyDashboard({ firstName: _ }: { firstName: string }) {
  const seed = useServerFn(seedSampleWorkspace);
  const [busy, setBusy] = useState(false);

  async function trySample() {
    setBusy(true);
    try {
      await seed({ data: undefined as unknown as never });
      toast.success("Sample workspace ready — refreshing your dashboard.");
      window.location.reload();
    } catch {
      toast.error("Could not load the sample workspace.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-dashed border-border bg-card px-8 py-14 text-center sm:px-12">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </span>
      <h2 className="mt-5 font-display text-2xl font-semibold">No events yet</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        Create your first event to unlock your personalized dashboard — timelines, budgets,
        vendor recommendations, and MelaAssist planning insights, all in one place.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button asChild variant="hero" className="w-full sm:w-auto">
          <Link to="/events/new"><Plus className="mr-2 h-4 w-4" />Create your first event</Link>
        </Button>
        <Button variant="outline" onClick={trySample} disabled={busy} className="w-full sm:w-auto">
          <Wand2 className="mr-2 h-4 w-4" />
          {busy ? "Loading sample…" : "Try with sample data"}
        </Button>
      </div>
    </div>
  );
}
