import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Calendar, Store, Users, Wallet, Ticket, ClipboardList, Loader2, ArrowUp } from "lucide-react";
import { askMelaAssist } from "@/lib/melaassist.functions";

const SHORTCUTS = [
  { to: "/timeline", label: "Runsheet", icon: Calendar },
  { to: "/vendors", label: "Vendors", icon: Store },
  { to: "/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/guests", label: "Guests", icon: Users },
  { to: "/budget", label: "Budget", icon: Wallet },
  { to: "/tickets", label: "Tickets", icon: Ticket },
] as const;

const SUGGESTIONS = [
  "What should I focus on this week?",
  "How do I stay on budget?",
  "Give me a seating-plan strategy.",
  "Which vendors should I book first?",
];

export function AIConcierge({ eventId }: { eventId?: string }) {
  const ask = useServerFn(askMelaAssist);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await ask({ data: { question: q, eventId } });
      setAnswer(res.answer);
    } catch {
      setError("MelaAssist couldn't respond. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function usePrompt(p: string) {
    setQuestion(p);
    setAnswer(null);
    setError(null);
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
        <Sparkles className="h-3.5 w-3.5" /> Ask MelaAssist
      </div>
      <h2 className="mt-2 font-display text-xl font-semibold">Your AI planning concierge</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ask anything about your event — budgets, timelines, vendors, guest logistics.
      </p>

      <form onSubmit={submit} className="mt-4">
        <div className="relative">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="e.g. What are my top three risks this week?"
            className="min-h-[92px] resize-none pr-14"
            disabled={busy}
            aria-label="Ask MelaAssist"
          />
          <Button
            type="submit"
            size="icon"
            variant="hero"
            disabled={busy || question.trim().length < 2}
            className="absolute bottom-2 right-2 h-9 w-9 rounded-full"
            aria-label="Send"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>

        {!answer && !busy && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => usePrompt(s)}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </form>

      {busy && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-background p-3 text-sm text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" /> MelaAssist is thinking…
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      )}

      {answer && !busy && (
        <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
          {answer}
        </div>
      )}

      <div className="mt-6 border-t border-border/60 pt-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Jump to</p>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
          {SHORTCUTS.map((a) => (
            <Button key={a.label} asChild variant="outline" size="sm" className="h-auto justify-start rounded-2xl py-2.5">
              <Link to={a.to}>
                <a.icon className="mr-2 h-4 w-4 text-primary" />
                <span className="text-sm">{a.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
