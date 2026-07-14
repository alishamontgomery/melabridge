import type { BriefItem } from "@/lib/dashboard-intelligence";
import { Users, Wallet, CheckSquare, Store, Cloud, Sparkles, Calendar } from "lucide-react";

const ICONS = {
  guests: Users,
  budget: Wallet,
  task: CheckSquare,
  vendor: Store,
  weather: Cloud,
  tip: Sparkles,
  timeline: Calendar,
} as const;

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
          return (
            <li key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3">
              <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm">{it.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
