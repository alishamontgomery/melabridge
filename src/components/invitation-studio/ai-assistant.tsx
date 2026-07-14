import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Make this more elegant",
  "Use sage green",
  "Add gold foil",
  "Use watercolor flowers",
  "Make it black tie",
  "Create matching menus",
  "Generate bilingual version",
  "Shorten the wording",
  "Add a scripture verse",
  "Generate ceremony program",
];

export function AIAssistant({ onApply }: { onApply?: (instruction: string) => void }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  const apply = (text: string) => {
    onApply?.(text);
    toast.success("AI adjustment applied", { description: text });
    setPrompt("");
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-[calc(100vw-2rem)] sm:bottom-6 sm:right-6">
      {open && (
        <div className="mb-3 w-80 max-w-full rounded-3xl border border-border/60 bg-card/95 p-4 shadow-elegant backdrop-blur-xl animate-scale-in">
          <div className="mb-2 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Mela AI</p>
              <p className="truncate text-[11px] text-muted-foreground">Tell me how to refine the design.</p>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.slice(0, 6).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => apply(s)}
                className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] transition hover:bg-accent"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (prompt.trim()) apply(prompt.trim());
            }}
            className="flex items-center gap-2"
          >
            <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. 'Warmer palette, more romantic'" className="h-9" />
            <Button size="icon" type="submit" className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
      <Button
        onClick={() => setOpen((v) => !v)}
        className="h-12 gap-2 whitespace-normal rounded-full bg-gradient-to-r from-primary to-primary-glow px-5 text-primary-foreground shadow-elegant"
      >
        <Sparkles className="h-4 w-4" />
        {open ? "Close AI" : "Ask Mela AI"}
      </Button>
    </div>
  );
}
