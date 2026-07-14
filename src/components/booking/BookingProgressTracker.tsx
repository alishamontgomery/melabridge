import { TRACKER_STAGES, stageMeta, type BookingStage } from "@/lib/booking-stages";
import { cn } from "@/lib/utils";
import { Check, Clock, Circle } from "lucide-react";

type Props = {
  currentStage: BookingStage;
  compact?: boolean;
  waitingFor?: string | null;
  /** Optional map of stage -> ISO timestamp for tooltips/subtext. */
  timestamps?: Partial<Record<BookingStage, string | null | undefined>>;
};

function stageStatus(stage: BookingStage, current: BookingStage, timestamps?: Props["timestamps"]) {
  const currentIdx = TRACKER_STAGES.indexOf(current);
  const idx = TRACKER_STAGES.indexOf(stage);
  const hasTs = !!timestamps?.[stage];
  // Exception (cancelled/no_response/lost) or unknown -> mark only stages with timestamps as done.
  if (currentIdx === -1) {
    return hasTs ? "done" : "upcoming";
  }
  if (idx < currentIdx) return "done";
  if (idx === currentIdx) return "current";
  return "upcoming";
}

export function BookingProgressTracker({ currentStage, compact = false, waitingFor, timestamps }: Props) {
  const isException = TRACKER_STAGES.indexOf(currentStage) === -1;
  const currentMeta = stageMeta(currentStage);

  return (
    <div className="space-y-3">
      {/* Horizontal on md+, stacked/scrollable on mobile */}
      <ol
        className={cn(
          "flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible",
          compact && "gap-1.5",
        )}
        aria-label="Booking progress"
      >
        {TRACKER_STAGES.map((key, i) => {
          const status = stageStatus(key, currentStage, timestamps);
          const m = stageMeta(key);
          const Icon = m.icon;
          return (
            <li key={key} className="flex shrink-0 items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
                  status === "done" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  status === "current" && "border-primary/40 bg-primary/10 text-primary",
                  status === "upcoming" && "border-border bg-muted/40 text-muted-foreground",
                )}
                title={m.label}
              >
                {status === "done" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : status === "current" ? (
                  <Clock className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                {!compact && <span>{m.short}</span>}
              </div>
              {i < TRACKER_STAGES.length - 1 && (
                <div
                  className={cn(
                    "hidden h-px w-4 md:block",
                    status === "done" ? "bg-emerald-500/60" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <p className="text-muted-foreground">
          Current status:{" "}
          <span className={cn("font-medium", isException ? "text-destructive" : "text-foreground")}>
            {waitingFor ?? currentMeta.label}
          </span>
        </p>
        <p className="text-muted-foreground">Stages update automatically as actions are completed.</p>
      </div>
    </div>
  );
}
