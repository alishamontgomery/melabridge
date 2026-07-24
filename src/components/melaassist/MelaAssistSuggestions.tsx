import { Sparkles } from "lucide-react";
import type { MelaAssistPrompt } from "./types";

export function MelaAssistSuggestions({
  suggestions,
  greeting,
  onPick,
}: {
  suggestions: MelaAssistPrompt[];
  greeting: string;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-gold/20 text-primary">
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="mt-3 font-display text-lg font-semibold">How can I help?</p>
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
    </div>
  );
}
