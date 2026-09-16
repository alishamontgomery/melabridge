import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { RippleFeed } from "@/components/ripple-feed";
import { useEcosystem } from "@/lib/ecosystem-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Network,
  Users,
  Wallet,
  Store,
  ClipboardList,
  Calendar,
  Bell,
  Vault,
  Sparkles,
  BarChart3,
  Lightbulb,
  CloudRain,
  Sun,
  CloudLightning,
} from "lucide-react";

export const Route = createFileRoute("/ecosystem")({
  head: () => ({
    meta: [
      { title: "Ecosystem Map — MelaBridge" },
      {
        name: "description",
        content: "See how every MelaBridge module — guests, budget, vendors, AI, memory — reacts to every change in real time.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EcosystemPage,
});

function EcosystemPage() {
  return (
    <AppShell active="/ecosystem">
      <PageHeader
        eyebrow="MelaBridge Ecosystem™"
        icon={Network}
        title={<>One platform. <span className="text-gradient">Every module talking to every other.</span></>}
        description="Change guest count and budgets recalculate, catering shifts, seating adjusts, AI re-suggests vendors. Confirm a vendor and the timeline advances, reminders clear, the collaboration feed lights up. Nothing lives in isolation."
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <SimulatorCard />
          <RelationshipsCard />
        </div>
        <RippleFeed />
      </div>
    </AppShell>
  );
}

function SimulatorCard() {
  const { event, setGuests, confirmVendor, setWeatherRisk, health, budgetPct, perGuest, cateringRecommendation, seatingTables } = useEcosystem();
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Live simulator</p>
          <h3 className="font-display text-xl font-semibold">Move a lever. Watch the platform react.</h3>
        </div>
        <Badge className="bg-primary/10 text-primary">Health {health}</Badge>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="guests" className="font-medium">Guest count</label>
            <span className="text-muted-foreground">{event.guests}</span>
          </div>
          <input
            id="guests"
            type="range"
            min={20}
            max={300}
            step={1}
            value={event.guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="mt-2 w-full accent-[color:var(--primary)]"
          />
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <Stat label="Per guest" value={`$${perGuest}`} />
            <Stat label="Catering" value={`${cateringRecommendation}`} />
            <Stat label="Tables" value={`${seatingTables}`} />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Weather forecast</p>
          <div className="flex gap-2">
            {(
              [
                { r: "low", label: "Clear", icon: Sun },
                { r: "medium", label: "Rainy", icon: CloudRain },
                { r: "high", label: "Storm", icon: CloudLightning },
              ] as const
            ).map(({ r, label, icon: Icon }) => (
              <button
                key={r}
                onClick={() => setWeatherRisk(r)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs transition ${
                  event.weatherRisk === r ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <p className="text-sm font-medium">Simulate vendor confirmation</p>
          <div className="flex flex-wrap gap-2">
            {["Florist", "Photographer", "Caterer", "DJ", "Stationery"].map((v) => (
              <Button key={v} size="sm" variant="soft" onClick={() => confirmVendor(v)}>Confirm {v}</Button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Stat label="Budget %" value={`${budgetPct}%`} />
            <Stat label="Vendors" value={`${event.vendorsConfirmed}/${event.vendorsTotal}`} />
            <Stat label="RSVPs" value={`${event.rsvps}/${event.guests}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-accent/50 px-2 py-1.5 text-center">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display text-sm font-semibold">{value}</p>
    </div>
  );
}

const RELATIONSHIPS = [
  {
    trigger: "Guest count changes",
    icon: Users,
    reacts: [
      { m: "Budget", to: "/budget", icon: Wallet, note: "Per-guest projection" },
      { m: "Vendors", to: "/marketplace", icon: Store, note: "Catering + rentals" },
      { m: "Tasks", to: "/tasks", icon: ClipboardList, note: "Seating chart auto-updates" },
      { m: "MelaAssist", to: "/concierge", icon: Sparkles, note: "Refines recommendations" },
    ],
  },
  {
    trigger: "Vendor confirms",
    icon: Store,
    reacts: [
      { m: "Timeline", to: "/timeline", icon: Calendar, note: "Milestones added" },
      { m: "Tasks", to: "/tasks", icon: ClipboardList, note: "Reminders cleared" },
      { m: "Budget", to: "/budget", icon: Wallet, note: "Marks amount planned" },
      { m: "Team", to: "/team", icon: Users, note: "Team notified" },
    ],
  },
  {
    trigger: "Weather changes",
    icon: CloudRain,
    reacts: [
      { m: "Decision Center™", to: "/decisions", icon: Lightbulb, note: "AI drafts contingency" },
      { m: "Notifications", to: "/notifications", icon: Bell, note: "Alerts ready" },
      { m: "BridgeVault™", to: "/bridgevault", icon: Vault, note: "Forecast archived" },
      { m: "Intelligence", to: "/bridge-intelligence", icon: BarChart3, note: "Benchmark check" },
    ],
  },
] as const;

function RelationshipsCard() {
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Relationships</p>
      <h3 className="font-display text-xl font-semibold">How the modules talk</h3>
      <ul className="mt-6 space-y-5">
        {RELATIONSHIPS.map((r) => (
          <li key={r.trigger}>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <r.icon className="h-4 w-4" />
              </span>
              <p className="font-medium">{r.trigger}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 pl-10">
              {r.reacts.map((x) => (
                <Link
                  key={x.m}
                  to={x.to as "/budget"}
                  className="group inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs transition hover:border-primary/30 hover:text-primary"
                >
                  <x.icon className="h-3 w-3" />
                  <span className="font-medium">{x.m}</span>
                  <span className="text-muted-foreground group-hover:text-primary">· {x.note}</span>
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
