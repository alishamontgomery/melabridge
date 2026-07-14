import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STUDIO_STEPS = [
  { id: "design", label: "Choose Design" },
  { id: "personalize", label: "Personalize" },
  { id: "suite", label: "Invitation Suite" },
  { id: "review", label: "Review" },
  { id: "send", label: "Send" },
] as const;

export type StudioStepId = (typeof STUDIO_STEPS)[number]["id"];

export function StudioStepper({ current, onStep }: { current: StudioStepId; onStep?: (id: StudioStepId) => void }) {
  const currentIdx = STUDIO_STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/60 p-2 backdrop-blur">
      {STUDIO_STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={s.id} className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => onStep?.(s.id)}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left transition",
                active && "bg-gradient-to-br from-primary/15 to-gold/10 ring-1 ring-primary/40",
                !active && !done && "hover:bg-accent/60",
                done && "opacity-80",
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                  active && "bg-primary text-primary-foreground shadow-soft",
                  done && "bg-primary/20 text-primary",
                  !active && !done && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn("truncate text-xs font-medium sm:text-sm", active ? "text-foreground" : "text-muted-foreground")}>
                {s.label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
