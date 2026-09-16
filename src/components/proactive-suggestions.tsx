/**
 * ProactiveSuggestions
 *
 * Surfaces up to 3 forward-looking MelaAssist™ suggestions on the event
 * overview.  Suggestions are computed server-side from event data and cached
 * in React Query.  Individual suggestions can be dismissed — dismissals are
 * persisted to localStorage so they survive page refreshes within the same
 * event (but reset when event data materially changes via `refreshKey`).
 *
 * CTAs either open a tab in the event detail page or open the MelaAssist
 * panel with a pre-loaded prompt for deeper guidance.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, X, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  computeEventSuggestions,
  type EventSuggestion,
} from "@/lib/event-notifications.functions";
import { useMelaAssistOptional } from "@/components/melaassist/context";

// Persist dismissed suggestion keys for this event
function dismissedKey(eventId: string) {
  return `mela:suggest:dismissed:${eventId}`;
}
function loadDismissed(eventId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(dismissedKey(eventId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}
function saveDismissed(eventId: string, keys: Set<string>) {
  try {
    window.localStorage.setItem(
      dismissedKey(eventId),
      JSON.stringify([...keys]),
    );
  } catch {
    // ignore
  }
}

const TYPE_COLORS: Record<EventSuggestion["type"], string> = {
  warning: "border-amber-200/70 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20",
  tip: "border-border/60 bg-muted/20",
  action: "border-primary/20 bg-primary/5",
};

const TYPE_BADGE: Record<EventSuggestion["type"], string> = {
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  tip: "bg-muted text-muted-foreground",
  action: "bg-primary/10 text-primary",
};

export function ProactiveSuggestions({
  eventId,
  onOpenTab,
}: {
  eventId: string;
  onOpenTab: (tab: string) => void;
}) {
  const melaAssist = useMelaAssistOptional();
  const suggestFn = useServerFn(computeEventSuggestions);

  const { data, isLoading } = useQuery({
    queryKey: ["event-suggestions", eventId],
    queryFn: () => suggestFn({ data: { eventId } }),
    staleTime: 5 * 60 * 1000, // 5 min — refresh only on data change
  });

  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  // Load dismissals from localStorage after mount (SSR-safe)
  useEffect(() => {
    setDismissed(loadDismissed(eventId));
  }, [eventId]);

  const dismiss = useCallback(
    (key: string) => {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(key);
        saveDismissed(eventId, next);
        return next;
      });
    },
    [eventId],
  );

  const visible = useMemo(
    () =>
      (data?.suggestions ?? [])
        .filter((s) => !dismissed.has(s.key))
        .slice(0, 3),
    [data, dismissed],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="text-sm">MelaAssist is reviewing your event…</span>
      </div>
    );
  }

  if (visible.length === 0) {
    // Don't render empty panel — let NeedsAttention show the positive state
    return null;
  }

  function handleCta(s: EventSuggestion) {
    if (s.ctaTab) {
      onOpenTab(s.ctaTab);
    } else if (s.ctaRoute && typeof window !== "undefined") {
      window.location.href = s.ctaRoute;
    }
    if (s.ctaPrompt && melaAssist) {
      melaAssist.openAssistant({ initialPrompt: s.ctaPrompt });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          MelaAssist™ recommendations
        </h3>
      </div>

      <div className="space-y-2">
        {visible.map((s) => (
          <Card
            key={s.key}
            className={`group relative flex items-start gap-3 border p-4 shadow-none transition ${TYPE_COLORS[s.type]}`}
          >
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_BADGE[s.type]}`}
                >
                  {s.type === "action" ? "Action" : s.type === "warning" ? "Warning" : "Tip"}
                </span>
              </div>
              <p className="text-sm leading-snug">{s.message}</p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCta(s)}
                className="gap-1 text-xs"
              >
                {s.ctaLabel}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Button>
              <button
                type="button"
                onClick={() => dismiss(s.key)}
                aria-label="Dismiss suggestion"
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-background/80"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {melaAssist && (
        <p className="pl-1 text-[11px] text-muted-foreground">
          <button
            type="button"
            className="underline-offset-2 hover:underline"
            onClick={() => melaAssist.openAssistant()}
          >
            Ask MelaAssist anything about this event
          </button>{" "}
          · Suggestions dismiss individually and don't affect your data.
        </p>
      )}
    </div>
  );
}
