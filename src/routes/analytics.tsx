import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Sparkles, TrendingUp, Users, Wallet, ClipboardList, Store, Activity } from "lucide-react";
import { useEcosystem } from "@/lib/ecosystem-store";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [
    { title: "Analytics — MelaBridge" },
    { name: "description", content: "Guest, budget, timeline and Event Health Score™ analytics." },
    { name: "robots", content: "noindex" },
  ]}),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { event, health, budgetPct } = useEcosystem();
  const healthHistory = [72,76,78,81,84,87,89,91,health];

  return (
    <AppShell active="/analytics">
      <PageHeader
        eyebrow="Analytics"
        icon={BarChart3}
        title={<>The full picture, <span className="text-gradient">at a glance</span>.</>}
        description="Guest, budget, timeline, vendor and Health Score analytics — updated live as the ecosystem changes."
      />

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <MetricCard icon={Activity} label="Event Health Score™" value={`${health}/100`} sub="+7 this week" tone="good"/>
        <MetricCard icon={Users} label="RSVP response" value={`${Math.round((event.rsvps/event.guests)*100)}%`} sub={`${event.rsvps}/${event.guests}`} tone="info"/>
        <MetricCard icon={Wallet} label="Budget consumed" value={`${budgetPct}%`} sub={`$${event.spent.toLocaleString()}`} tone="info"/>
        <MetricCard icon={ClipboardList} label="Task progress" value={`${Math.round((event.tasksDone/event.tasksTotal)*100)}%`} sub={`${event.tasksDone}/${event.tasksTotal}`} tone="good"/>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold">Health Score history</h3>
              <p className="text-xs text-muted-foreground">Weekly snapshots · trending up</p>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-700 gap-1"><TrendingUp className="h-3 w-3"/>+{health-72}</Badge>
          </div>
          <div className="mt-6 flex items-end justify-between gap-2 h-40">
            {healthHistory.map((v,i)=>(
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-gradient-to-t from-primary to-primary-glow" style={{height:`${v}%`}}/>
                <span className="text-[10px] text-muted-foreground">W{i+1}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-primary/20 bg-hero-radial p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary"><Sparkles className="h-3.5 w-3.5"/>AI recommendations</div>
          <ul className="space-y-2 text-sm">
            <li>• Send RSVP nudges Monday — response rate typically peaks midweek.</li>
            <li>• Vendor completion is at 80% — confirming Bloomhaus adds +4 to Health.</li>
            <li>• Milestone "Photographer contract" slips this week — draft escalation ready.</li>
            <li>• You're pacing 12% under budget — consider guest travel subsidy.</li>
          </ul>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-5">
          <h3 className="font-display text-lg font-semibold">Guest analytics</h3>
          <div className="mt-3 space-y-3 text-sm">
            <Bar label="Confirmed" value={72}/>
            <Bar label="Pending" value={18}/>
            <Bar label="Declined" value={10}/>
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <h3 className="font-display text-lg font-semibold">Vendor completion</h3>
          <div className="mt-3 space-y-3 text-sm">
            <Bar label="Confirmed"    value={80}/>
            <Bar label="In progress"  value={15}/>
            <Bar label="Not started"  value={5}/>
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <h3 className="font-display text-lg font-semibold">Budget by category</h3>
          <div className="mt-3 space-y-3 text-sm">
            <Bar label="Venue"       value={92}/>
            <Bar label="Catering"    value={64}/>
            <Bar label="Photo/Video" value={72}/>
            <Bar label="Florals"     value={68}/>
            <Bar label="Music"       value={71}/>
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <h3 className="font-display text-lg font-semibold">Milestone completion</h3>
          <div className="mt-3 space-y-3 text-sm">
            <Bar label="Nov 2025"  value={100}/>
            <Bar label="Dec 2025"  value={100}/>
            <Bar label="Jan 2026"  value={60}/>
            <Bar label="Mar 2026"  value={20}/>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
function MetricCard({ icon: Icon, label, value, sub, tone }: { icon:React.ComponentType<{className?:string}>; label:string; value:string; sub:string; tone:"info"|"good" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between"><Icon className={`h-4 w-4 ${tone==="good"?"text-emerald-600":"text-primary"}`}/><span className="text-xs text-muted-foreground">{label}</span></div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
function Bar({ label, value }: { label:string; value:number }) {
  return (
    <div><div className="flex justify-between"><span>{label}</span><span className="text-muted-foreground">{value}%</span></div><Progress value={value} className="mt-1"/></div>
  );
}
