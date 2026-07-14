import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const LS_LAST = "melabridge:lastMoodCheckin";
const LS_MOOD = "melabridge:mood";
const INTERVAL_MS = 3 * 24 * 3600 * 1000;

type Mood = "excited" | "good" | "stressed" | "overwhelmed" | "checkin";
const OPTIONS: { key: Mood; label: string; emoji: string }[] = [
  { key: "excited", label: "Excited", emoji: "😊" },
  { key: "good", label: "Feeling good", emoji: "😌" },
  { key: "stressed", label: "A little stressed", emoji: "😅" },
  { key: "overwhelmed", label: "Overwhelmed", emoji: "😬" },
  { key: "checkin", label: "Just checking in", emoji: "🙂" },
];

const RESPONSES: Record<Mood, string> = {
  excited: "Love that energy! Try a fun task like seating layouts or an inspiration board today.",
  good: "You're in a great rhythm — a small win today keeps the momentum going.",
  stressed: "Totally normal. Focus on just one task today — MelaAssist will handle the rest quietly.",
  overwhelmed: "You're actually doing better than you think. Let's tackle only one thing today.",
  checkin: "Glad you stopped by. Here's what's most useful today.",
};

export function DailyCheckIn() {
  const [show, setShow] = useState(false);
  const [chosen, setChosen] = useState<Mood | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const last = Number(localStorage.getItem(LS_LAST) ?? 0);
    if (!last || Date.now() - last > INTERVAL_MS) setShow(true);
  }, []);

  if (!show) return null;

  const pick = (m: Mood) => {
    setChosen(m);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_LAST, String(Date.now()));
      localStorage.setItem(LS_MOOD, m);
    }
  };

  return (
    <section className="relative rounded-3xl border border-border bg-card p-6 shadow-soft">
      <button
        aria-label="Dismiss check-in"
        onClick={() => setShow(false)}
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
      {!chosen ? (
        <>
          <h3 className="font-display text-lg font-semibold">How are you feeling about your event today?</h3>
          <p className="mt-1 text-sm text-muted-foreground">MelaAssist will tailor today's brief to match your mood.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {OPTIONS.map((o) => (
              <Button key={o.key} variant="outline" size="sm" onClick={() => pick(o.key)} className="rounded-full">
                <span className="mr-1.5">{o.emoji}</span>{o.label}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Thanks for sharing.</p>
          <p className="mt-1 font-display text-lg">{RESPONSES[chosen]}</p>
        </>
      )}
    </section>
  );
}

export function getStoredMood(): Mood | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(LS_MOOD) as Mood | null) ?? null;
}
