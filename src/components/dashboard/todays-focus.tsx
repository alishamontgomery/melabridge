import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, ArrowRight } from "lucide-react";
import type { FocusSuggestion } from "@/lib/dashboard-intelligence";

export function TodaysFocus({ focus }: { focus: FocusSuggestion }) {
  const navigate = useNavigate();

  const handle = () => {
    if (focus.taskId) {
      // Navigate to tasks so the user can review and explicitly complete it
      navigate({ to: "/tasks", search: { highlight: focus.taskId } });
      return;
    }
    if (focus.route) navigate({ to: focus.route as never });
  };

  return (
    <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
        <Sparkles className="h-3.5 w-3.5" /> Today's focus
      </div>
      <h2 className="mt-2 font-display text-2xl font-semibold">{focus.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{focus.reason}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> {focus.estimatedMinutes} min
        </span>
        <Button onClick={handle} variant="hero">
          <ArrowRight className="mr-2 h-4 w-4" />
          {focus.taskId ? "Open task" : focus.cta}
        </Button>
      </div>
    </section>
  );
}
