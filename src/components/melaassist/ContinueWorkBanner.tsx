import { Sparkles, RotateCcw, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContinueWorkBanner({
  task,
  onContinue,
  onStartNew,
  onDiscard,
}: {
  task: string;
  onContinue: () => void;
  onStartNew: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="mx-4 mt-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-gold/5 p-4">
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Welcome back</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-foreground">
            You were working on <span className="font-medium">{task}</span>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="hero" onClick={onContinue}>
              <ArrowRight className="mr-1.5 h-3.5 w-3.5" /> Continue
            </Button>
            <Button size="sm" variant="outline" onClick={onStartNew}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Start new
            </Button>
            <Button size="sm" variant="ghost" onClick={onDiscard}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Discard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
