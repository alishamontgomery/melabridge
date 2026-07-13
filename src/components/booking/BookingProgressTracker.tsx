import { STAGES, stageIndex, stageMeta, isConfirmed, type BookingStage } from "@/lib/booking-stages";
import { cn } from "@/lib/utils";
import { Check, Clock, Circle } from "lucide-react";

const KEY_STAGES: BookingStage[] = [
  "saved", "quote_sent", "contract_sent", "contract_signed", "deposit_paid", "booked", "completed",
];

export function BookingProgressTracker({
  currentStage,
  compact = false,
  waitingFor,
}: {
  currentStage: BookingStage;
  compact?: boolean;
  waitingFor?: string | null;
}) {
  const currentIdx = stageIndex(currentStage);
  const meta = stageMeta(currentStage);

  return (
    <div className="space-y-2">
      <div className={cn("flex items-center gap-1.5 overflow-x-auto", compact && "gap-1")}>
        {KEY_STAGES.map((key) => {
          const idx = stageIndex(key);
          const done = idx < currentIdx || (idx === currentIdx && isConfirmed(currentStage));
          const current = idx === currentIdx;
          const m = stageMeta(key);
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap",
                  done && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                  current && !done && "bg-primary/15 text-primary",
                  !done && !current && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : current ? <Clock className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                {!compact && <span>{m.short}</span>}
              </div>
              {idx < KEY_STAGES.length - 1 && (
                <div className={cn("h-px w-4", done ? "bg-emerald-500/60" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Current status:{" "}
        <span className="font-medium text-foreground">
          {waitingFor ?? meta.label}
        </span>
      </p>
    </div>
  );
}
