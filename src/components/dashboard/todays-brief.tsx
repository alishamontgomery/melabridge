import { Link } from "@tanstack/react-router";
import type { BriefItem } from "@/lib/dashboard-intelligence";
import { Users, Wallet, CheckSquare, Store, Cloud, Sparkles, Calendar, ArrowRight } from "lucide-react";

const ICONS = {
  guests: Users,
  budget: Wallet,
  task: CheckSquare,
  vendor: Store,
  weather: Cloud,
  tip: Sparkles,
  timeline: Calendar,
} as const;

// Map icon type to the relevant app route. Weather and tip items are informational only.
const ROUTES: Partial<Record<BriefItem["icon"], string>> = {
  guests: "/guests",
  budget: "/budget",
  task: "/tasks",
  vendor: "/marketplace",
  timeline: "/timeline",
};

export function TodaysBrief({ items }: { items: BriefItem[] }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Today's brief</h2>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">MelaAssist</span>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((it, i) => {
          const Icon = ICONS[it.icon] ?? Sparkles;
          const route = ROUTES[it.icon];

          const inner = (
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3 transition hover:border-primary/30 hover:bg-accent/20">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 text-sm">{it.text}</span>
              {route && (
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
              )}
            </div>
          );

          return (
            <li key={i}>
              {route ? (
                <Link to={route as "/dashboard"} className="block focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-xl">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
