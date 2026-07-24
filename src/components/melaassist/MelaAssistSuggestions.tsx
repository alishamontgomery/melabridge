import { useEffect, useState } from "react";
import { Sparkles, Lightbulb, X } from "lucide-react";
import type { MelaAssistPrompt } from "./types";

export function MelaAssistSuggestions({
  suggestions,
  greeting,
  surface,
  tip,
  tipKey,
  onPick,
}: {
  suggestions: MelaAssistPrompt[];
  greeting: string;
  surface?: string;
  tip?: string;
  tipKey?: string;
  onPick: (prompt: string) => void;
}) {
  const [tipDismissed, setTipDismissed] = useState(false);

  useEffect(() => {
    if (!tipKey) return;
    if (typeof window === "undefined") return;
    try {
      setTipDismissed(window.sessionStorage.getItem(`melaassist:tip:${tipKey}`) === "1");
    } catch {
      // ignore
    }
  }, [tipKey]);

  function dismissTip() {
    setTipDismissed(true);
    if (!tipKey || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(`melaassist:tip:${tipKey}`, "1");
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-gold/20 text-primary">
        <Sparkles className="h-5 w-5" />
      </span>
      {surface && (
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-primary">{surface}</p>
      )}
      <p className="mt-1 font-display text-lg font-semibold">How can I help?</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{greeting}</p>

      <div className="mt-5 grid w-full gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onPick(s.prompt)}
            className="group rounded-2xl border border-border bg-card p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
          >
            <p className="text-sm font-medium">{s.label}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.prompt}</p>
          </button>
        ))}
      </div>

      {tip && !tipDismissed && (
        <div className="mt-5 flex w-full items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-left">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Tip. </span>
            {tip}
          </p>
          <button
            type="button"
            onClick={dismissTip}
            aria-label="Dismiss tip"
            className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
