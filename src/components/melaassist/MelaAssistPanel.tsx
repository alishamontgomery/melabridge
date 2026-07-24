import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowUp } from "lucide-react";
import { askMelaAssist } from "@/lib/melaassist.functions";
import { useMelaAssist } from "./context";
import { MelaAssistHeader } from "./MelaAssistHeader";
import { MelaAssistSuggestions } from "./MelaAssistSuggestions";
import { MelaAssistConversation } from "./MelaAssistConversation";
import { getSuggestionsForRole, greetingForRole } from "./suggestions";
import type { MelaAssistMessage } from "./types";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function MelaAssistPanel() {
  const { open, closeAssistant, context, initialPrompt, consumeInitialPrompt } = useMelaAssist();
  const ask = useServerFn(askMelaAssist);
  const [messages, setMessages] = useState<MelaAssistMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const suggestions = useMemo(() => getSuggestionsForRole(context.role), [context.role]);
  const greeting = useMemo(() => greetingForRole(context.role), [context.role]);

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || busy) return;
      const userMsg: MelaAssistMessage = { id: uid(), role: "user", content: question, createdAt: Date.now() };
      const pendingId = uid();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: pendingId, role: "assistant", content: "", createdAt: Date.now(), pending: true },
      ]);
      setInput("");
      setBusy(true);
      try {
        const res = await ask({ data: { question, eventId: context.eventId ?? undefined } });
        // Typewriter-style reveal for a premium feel
        const full = res.answer ?? "";
        const chunkSize = Math.max(2, Math.ceil(full.length / 60));
        let i = 0;
        await new Promise<void>((resolve) => {
          const tick = () => {
            i = Math.min(full.length, i + chunkSize);
            const partial = full.slice(0, i);
            setMessages((prev) =>
              prev.map((m) => (m.id === pendingId ? { ...m, content: partial, pending: i < full.length } : m)),
            );
            if (i < full.length) window.setTimeout(tick, 18);
            else resolve();
          };
          tick();
        });
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, content: "MelaAssist couldn't respond. Please try again.", pending: false, error: true }
              : m,
          ),
        );
      } finally {
        setBusy(false);
        // Refocus composer
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [ask, busy, context.eventId],
  );

  // Handle inbound initialPrompt when panel opens
  useEffect(() => {
    if (!open) return;
    if (initialPrompt) {
      const p = consumeInitialPrompt();
      if (p) void send(p);
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, initialPrompt, consumeInitialPrompt, send]);

  function reset() {
    setMessages([]);
    setInput("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? null : closeAssistant())}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        aria-describedby={undefined}
      >
        <MelaAssistHeader onClose={closeAssistant} onReset={reset} />

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <MelaAssistSuggestions
              suggestions={suggestions}
              greeting={greeting}
              onPick={(p) => void send(p)}
            />
          ) : (
            <MelaAssistConversation messages={messages} />
          )}
        </div>

        <form onSubmit={onSubmit} className="border-t border-border/60 bg-background/80 p-3 backdrop-blur">
          <div className="relative">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Ask MelaAssist anything…"
              className="min-h-[56px] resize-none pr-12"
              disabled={busy}
              aria-label="Message MelaAssist"
            />
            <Button
              type="submit"
              size="icon"
              variant="hero"
              disabled={busy || input.trim().length < 2}
              className="absolute bottom-2 right-2 h-8 w-8 rounded-full"
              aria-label="Send message"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-2 px-1 text-[10.5px] leading-tight text-muted-foreground">
            MelaAssist drafts suggestions only — nothing is saved or sent without your approval.
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default MelaAssistPanel;
