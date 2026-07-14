import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function SampleDataBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400",
        className,
      )}
      title="This is sample data. Create your first event to replace it."
    >
      <Sparkles className="h-2.5 w-2.5" />
      Sample data
    </span>
  );
}
