import type { HealthBreakdown } from "@/lib/dashboard-intelligence";
import { scoreToStars } from "@/lib/dashboard-intelligence";
import { Star } from "lucide-react";

const ROWS: { key: keyof Omit<HealthBreakdown, "overall">; label: string }[] = [
  { key: "budget", label: "Budget" },
  { key: "guests", label: "Guests" },
  { key: "timeline", label: "Timeline" },
  { key: "vendors", label: "Vendors" },
  { key: "contracts", label: "Contracts" },
];

export function EventHealthScore({ health }: { health: HealthBreakdown }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Event health</h2>
        <span className="font-display text-3xl font-semibold text-gradient">{health.overall}%</span>
      </div>
      <ul className="mt-4 space-y-2.5">
        {ROWS.map((r) => {
          const stars = scoreToStars(health[r.key]);
          return (
            <li key={r.key} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`h-3.5 w-3.5 ${n <= stars ? "fill-gold text-gold" : "text-muted-foreground/40"}`}
                  />
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
