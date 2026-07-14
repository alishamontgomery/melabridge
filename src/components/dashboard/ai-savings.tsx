import { PiggyBank } from "lucide-react";

export function AISavings({ items, total }: { items: string[]; total: number }) {
  const list = items.length ? items : ["MelaAssist will surface savings as vendors and budget items grow."];
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Potential savings</h2>
        {total > 0 && <span className="font-display text-xl font-semibold text-emerald-500">~${total}</span>}
      </div>
      <ul className="mt-4 space-y-3">
        {list.map((t, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3 text-sm">
            <PiggyBank className="mt-0.5 h-4 w-4 text-emerald-500" /> {t}
          </li>
        ))}
      </ul>
    </section>
  );
}
