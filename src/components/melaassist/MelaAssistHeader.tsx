import { Sparkles, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MelaAssistHeader({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-primary/10 via-transparent to-transparent px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="relative grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold leading-none">MelaAssist</p>
          <p className="mt-1 text-[11px] text-muted-foreground">AI planning concierge</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onReset} aria-label="New conversation">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
