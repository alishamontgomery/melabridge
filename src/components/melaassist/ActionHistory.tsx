import { CheckCircle2, XCircle, AlertTriangle, History } from "lucide-react";
import type { MelaAssistHistoryEntry } from "./types";

export function ActionHistory({ history }: { history: MelaAssistHistoryEntry[] }) {
  if (history.length === 0) return null;
  return (
    <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <History className="h-3 w-3" /> Recent actions
      </div>
      <ul className="space-y-1">
        {history.slice(0, 5).map((h) => (
          <li key={h.id} className="flex items-center gap-2 text-xs">
            {h.status === "executed" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : h.status === "failed" ? (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="truncate text-foreground/90">{h.title}</span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
              {formatRelative(h.at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
