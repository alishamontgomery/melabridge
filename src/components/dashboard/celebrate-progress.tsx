import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import type { Milestone } from "@/lib/dashboard-intelligence";
import { X } from "lucide-react";

const LS_KEY = "melabridge:celebratedMilestones";

function loadCelebrated(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) ?? "[]")); } catch { return new Set(); }
}
function saveCelebrated(s: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify([...s]));
}

export function CelebrateProgress({ milestones }: { milestones: Milestone[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadCelebrated());
  const active = milestones.find((m) => !dismissed.has(m.key));

  useEffect(() => {
    if (active && active.big) {
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.3 } });
    }
  }, [active?.key, active?.big]);

  if (!active) return null;
  const dismiss = () => {
    const next = new Set(dismissed);
    next.add(active.key);
    setDismissed(next);
    saveCelebrated(next);
  };

  return (
    <section className="relative flex items-center gap-4 rounded-3xl border border-gold/40 bg-gradient-to-r from-gold/20 via-card to-primary/10 p-5 shadow-soft">
      <span className="text-3xl" aria-hidden>{active.emoji}</span>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-widest text-gold-foreground/70">Milestone reached</p>
        <p className="font-display text-lg font-semibold">{active.label}</p>
      </div>
      <button aria-label="Dismiss" onClick={dismiss} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
        <X className="h-4 w-4" />
      </button>
    </section>
  );
}
