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

function firstNameFromUser(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const raw = (meta.full_name as string) || (meta.name as string) || (meta.first_name as string) || "";
  const trimmed = raw.trim();
  if (trimmed) return trimmed.split(/\s+/)[0];
  const email = user?.email ?? "";
  if (!email) return "there";
  const local = email.split("@")[0].split(/[._-]/)[0];
  return local ? local[0].toUpperCase() + local.slice(1) : "there";
}

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

  const firstName = firstNameFromUser(user);

  return (
    <AppShell active="/dashboard">
      <PageHeader
        eyebrow="Dashboard"
        icon={LayoutDashboard}
        title={<>Your planning <span className="text-gradient">companion</span>.</>}
        description="A calm, personalized command center — refreshed every time you visit."
        actions={
          <Button asChild variant="hero">
            <Link to="/events/new"><Plus className="mr-2 h-4 w-4" />New event</Link>
          </Button>
        }
      />

      <div className="mt-8 space-y-6">
        {!user || loading || dashQ.isLoading ? (
          <DashboardSkeleton />
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
                <TodaysFocus focus={derived.focus} onCompleted={() => qc.invalidateQueries({ queryKey: ["dashboard-companion", event.id] })} />
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

function buildDashboardInsights(derived: NonNullable<ReturnType<typeof useMemo<any>>>, event: { id: string; name?: string | null }): MelaAssistInsight[] {
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

function EmptyDashboard({ firstName }: { firstName: string }) {
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
    <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </span>
      <h2 className="mt-4 font-display text-xl font-semibold">Welcome, {firstName} — let's plan something beautiful</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Create an event and MelaAssist will prepare a personalized brief, focus task, and health score every time you sign in.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button asChild variant="hero">
          <Link to="/events/new"><Plus className="mr-2 h-4 w-4" />Create an event</Link>
        </Button>
        <Button variant="outline" onClick={trySample} disabled={busy}>
          <Wand2 className="mr-2 h-4 w-4" />
          {busy ? "Loading sample…" : "Try with sample data"}
        </Button>
      </div>
    </div>
  );
}
