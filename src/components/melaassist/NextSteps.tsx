import { ArrowRight } from "lucide-react";

export function NextSteps({
  steps,
  onPick,
}: {
  steps: string[];
  onPick: (step: string) => void;
}) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="mt-2 rounded-2xl border border-dashed border-border/70 bg-background/60 p-2.5">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Suggested next steps
      </p>
      <div className="flex flex-wrap gap-1.5">
        {steps.slice(0, 6).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="group inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
          >
            {s}
            <ArrowRight className="h-3 w-3 opacity-60 transition group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
