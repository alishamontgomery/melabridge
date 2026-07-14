import { useEffect, useState } from "react";
import { computeCountdown } from "@/lib/dashboard-intelligence";

export function CountdownStrip({ eventDate, label = "Until the big day" }: { eventDate?: string | null; label?: string }) {
  const [cd, setCd] = useState(() => computeCountdown(eventDate));
  useEffect(() => {
    const id = setInterval(() => setCd(computeCountdown(eventDate)), 30_000);
    return () => clearInterval(id);
  }, [eventDate]);
  if (!eventDate || cd.total <= 0) return null;
  const cells = [
    { v: cd.days, l: "Days" },
    { v: cd.hours, l: "Hours" },
    { v: cd.minutes, l: "Minutes" },
  ];
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className="flex gap-3">
          {cells.map((c) => (
            <div key={c.l} className="min-w-[76px] rounded-2xl border border-border bg-background px-4 py-2 text-center">
              <div className="font-display text-2xl font-semibold tabular-nums">{c.v}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
