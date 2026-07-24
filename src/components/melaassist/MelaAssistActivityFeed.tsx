import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw, Activity } from "lucide-react";
import { useMelaAssist } from "./context";
import { getActionMeta } from "./action-registry";

function formatRelative(ts: number): string {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function MelaAssistActivityFeed({ limit = 5 }: { limit?: number }) {
  const { history, openAssistant } = useMelaAssist();
  const items = history.slice(0, limit);

  return (
    <Card className="border-border/60 p-4 shadow-soft sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Activity className="h-4 w-4" />
        </span>
        <div>
          <p className="font-display text-sm font-semibold">AI activity</p>
          <p className="text-[11px] text-muted-foreground">Recent MelaAssist actions this session</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
          No AI actions yet — approved actions will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((h) => {
            const meta = getActionMeta(h.kind);
            return (
              <li key={h.id} className="flex items-center gap-2 py-2 text-sm">
                {h.status === "executed" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : h.status === "failed" ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 truncate">{h.title}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{formatRelative(h.at)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 px-2"
                  onClick={() =>
                    openAssistant({
                      initialPrompt: `Revisit the "${meta.label}" I ${h.status} earlier and refine it.`,
                      task: h.title,
                    })
                  }
                  aria-label={`Reopen ${h.title}`}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
