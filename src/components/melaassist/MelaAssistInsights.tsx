import { useState, type ReactNode } from "react";
import { ChevronDown, Sparkles, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMelaAssist } from "./context";
import { cn } from "@/lib/utils";

export type MelaAssistInsight = {
  id: string;
  label: string;
  detail?: string;
  tone?: "default" | "warn" | "good";
  /** Optional prompt that opens the panel focused on this insight. */
  prompt?: string;
};

export function MelaAssistInsights({
  title = "MelaAssist Insights",
  insights,
  emptyLabel = "Everything looks healthy — I'll let you know when something needs attention.",
  defaultOpen = true,
  extra,
}: {
  title?: string;
  insights: MelaAssistInsight[];
  emptyLabel?: string;
  defaultOpen?: boolean;
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { openAssistant } = useMelaAssist();

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] via-card to-gold/[0.04] p-4 shadow-soft sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold">{title}</p>
            <p className="text-[11px] text-muted-foreground">
              {insights.length === 0 ? "All clear" : `${insights.length} insight${insights.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open ? "rotate-180" : "rotate-0",
          )}
        />
      </button>

      {open && (
        <div className="mt-4 space-y-2">
          {insights.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
              {emptyLabel}
            </p>
          ) : (
            insights.map((i) => (
              <div
                key={i.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/60 p-3",
                  i.tone === "warn" && "border-amber-400/40 bg-amber-50/40 dark:bg-amber-500/5",
                  i.tone === "good" && "border-emerald-400/40 bg-emerald-50/40 dark:bg-emerald-500/5",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{i.label}</p>
                  {i.detail && <p className="mt-0.5 text-xs text-muted-foreground">{i.detail}</p>}
                </div>
                {i.prompt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => openAssistant({ initialPrompt: i.prompt, task: i.label })}
                  >
                    Fix with MelaAssist <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))
          )}
          {extra}
        </div>
      )}
    </Card>
  );
}
