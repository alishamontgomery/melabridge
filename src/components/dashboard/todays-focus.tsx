import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Clock, Sparkles } from "lucide-react";
import type { FocusSuggestion } from "@/lib/dashboard-intelligence";

export function TodaysFocus({ focus, onCompleted }: { focus: FocusSuggestion; onCompleted?: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handle = async () => {
    if (focus.taskId) {
      setBusy(true);
      const { error } = await supabase
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", focus.taskId);
      setBusy(false);
      if (error) return toast.error("Couldn't mark task complete");
      toast.success("Task marked complete");
      setDone(true);
      onCompleted?.();
      return;
    }
    if (focus.route) navigate({ to: focus.route });
  };

  return (
    <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
        <Sparkles className="h-3.5 w-3.5" /> Today's focus
      </div>
      <h2 className="mt-2 font-display text-2xl font-semibold">
        {done ? "Nicely done." : focus.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {done ? "One less thing between you and a beautiful event." : focus.reason}
      </p>
      {!done && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> {focus.estimatedMinutes} min
          </span>
          <Button onClick={handle} disabled={busy} variant="hero">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {focus.cta}
          </Button>
        </div>
      )}
    </section>
  );
}
