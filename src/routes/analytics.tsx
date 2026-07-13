import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Users, Wallet, ClipboardList, Activity, Sparkles } from "lucide-react";
import { useEcosystem } from "@/lib/ecosystem-store";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — MelaBridge" },
      { name: "description", content: "Guest, budget, timeline and Event Health Score™ analytics." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { event, health, budgetPct, hasEvent } = useEcosystem();

  if (!hasEvent) {
    return (
      <AppShell active="/analytics">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Analytics"
            icon={BarChart3}
            title="Event analytics"
            description="Guest, budget, timeline, and health analytics for your active event."
          />
          <Card className="p-8 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h3 className="font-display text-lg font-semibold">No active event</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Create an event to see live analytics on your guests, budget, tasks, and event health.
            </p>
          </Card>
        </div>
      </AppShell>
    );
  }

  const rsvpPct = event.guests ? Math.round((event.rsvps / event.guests) * 100) : 0;
  const taskPct = event.tasksTotal ? Math.round((event.tasksDone / event.tasksTotal) * 100) : 0;

  return (
    <AppShell active="/analytics">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Analytics"
          icon={BarChart3}
          title="The full picture"
          description="Live analytics for your active event, updated as your plan changes."
        />

        <section className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={Activity} label="Event Health Score™" value={`${health}/100`} tone="good" />
          <MetricCard icon={Users} label="RSVP response" value={`${rsvpPct}%`} sub={`${event.rsvps}/${event.guests}`} tone="info" />
          <MetricCard icon={Wallet} label="Budget consumed" value={`${budgetPct}%`} sub={`$${event.spent.toLocaleString()}`} tone="info" />
          <MetricCard icon={ClipboardList} label="Task progress" value={`${taskPct}%`} sub={`${event.tasksDone}/${event.tasksTotal}`} tone="good" />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-display text-lg font-semibold">Guests</h3>
            <div className="mt-3 space-y-3 text-sm">
              <Bar label="Confirmed" value={rsvpPct} />
              <Bar label="Pending" value={100 - rsvpPct} />
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="font-display text-lg font-semibold">Budget</h3>
            <div className="mt-3 space-y-3 text-sm">
              <Bar label="Spent" value={budgetPct} />
              <Bar label="Remaining" value={Math.max(0, 100 - budgetPct)} />
            </div>
          </Card>
          <Card className="p-5 md:col-span-2">
            <h3 className="font-display text-lg font-semibold">Tasks</h3>
            <div className="mt-3 space-y-3 text-sm">
              <Bar label="Completed" value={taskPct} />
              <Bar label="Outstanding" value={Math.max(0, 100 - taskPct)} />
            </div>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: "info" | "good";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <Icon className={`h-4 w-4 ${tone === "good" ? "text-emerald-600" : "text-primary"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between">
        <span>{label}</span>
        <span className="text-muted-foreground">{value}%</span>
      </div>
      <Progress value={value} className="mt-1" />
    </div>
  );
}
