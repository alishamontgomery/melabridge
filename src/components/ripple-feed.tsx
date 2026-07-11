import { useEcosystem } from "@/lib/ecosystem-store";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";

function timeAgo(ts: number) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function RippleFeed({ compact = false }: { compact?: boolean }) {
  const { ripples } = useEcosystem();
  const items = compact ? ripples.slice(0, 3) : ripples;

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Ecosystem ripples</p>
          <h3 className="font-display text-lg font-semibold">What changed reacted where</h3>
        </div>
        <Badge className="bg-primary/10 text-primary">Live</Badge>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Everything is stable. Make a change and watch it ripple.</p>
      ) : (
        <ol className="mt-4 space-y-4">
          {items.map((r) => (
            <li key={r.id} className="relative rounded-2xl border border-border bg-background/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full ${
                      r.tone === "good"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : r.tone === "warn"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-primary/10 text-primary"
                    }`}
                  >
                    {r.tone === "good" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : r.tone === "warn" ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </span>
                  <p className="text-sm font-medium">{r.source}</p>
                </div>
                <span className="text-xs text-muted-foreground">{timeAgo(r.ts)}</span>
              </div>
              <ul className="mt-3 grid gap-1.5 pl-9 text-sm text-muted-foreground">
                {r.effects.map((e, i) => (
                  <li key={i} className="relative before:absolute before:-left-4 before:top-2 before:h-1 before:w-1 before:rounded-full before:bg-primary/60">
                    {e}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
