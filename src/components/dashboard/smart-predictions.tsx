import { Brain } from "lucide-react";

export function SmartPredictions({ items }: { items: string[] }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
        <Brain className="h-3.5 w-3.5" /> Smart predictions
      </div>
      <ul className="mt-3 space-y-2.5">
        {items.map((t, i) => (
          <li key={i} className="rounded-xl border border-dashed border-border bg-background p-3 text-sm">{t}</li>
        ))}
      </ul>
    </section>
  );
}
