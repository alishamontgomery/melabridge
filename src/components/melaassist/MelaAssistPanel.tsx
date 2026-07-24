import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { melaAssistTurn, executeMelaAction } from "@/lib/melaassist-actions.functions";
import { useMelaAssist } from "./context";
import { MelaAssistHeader } from "./MelaAssistHeader";
import { MelaAssistSuggestions } from "./MelaAssistSuggestions";
import { MelaAssistConversation } from "./MelaAssistConversation";
import { ActionCard } from "./ActionCard";
import { ActionHistory } from "./ActionHistory";
import { NextSteps } from "./NextSteps";
import { getActionMeta } from "./action-registry";
import { getPageContext } from "./page-context";
import { ContinueWorkBanner } from "./ContinueWorkBanner";
import type { MelaAssistAction, MelaAssistActionKind, MelaAssistMessage } from "./types";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const EXECUTABLE_KINDS = new Set<MelaAssistActionKind>([
  "update_business_description",
  "update_event_notes",
  "create_budget_item",
  "create_task",
  "create_event_draft",
  "add_timeline_milestone",
]);

type ExecutableKind =
  | "update_business_description"
  | "update_event_notes"
  | "create_budget_item"
  | "create_task"
  | "create_event_draft"
  | "add_timeline_milestone";

export function MelaAssistPanel() {
  const {
    open,
    closeAssistant,
    context,
    initialPrompt,
    consumeInitialPrompt,
    memory,
    setMemory,
    history,
    recordHistory,
  } = useMelaAssist();

  const turn = useServerFn(melaAssistTurn);
  const execute = useServerFn(executeMelaAction);

  const [messages, setMessages] = useState<MelaAssistMessage[]>([]);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastQuestionRef = useRef<string | null>(null);

  const pageContext = useMemo(
    () => getPageContext(context.pathname, context.role),
    [context.pathname, context.role],
  );

  const send = useCallback(
    async (raw: string, opts?: { silent?: boolean }) => {
      const question = raw.trim();
      if (!question || busy) return;
      lastQuestionRef.current = question;

      const userMsg: MelaAssistMessage = { id: uid(), role: "user", content: question, createdAt: Date.now() };
      const pendingId = uid();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: pendingId, role: "assistant", content: "", createdAt: Date.now(), pending: true },
      ]);
      if (!opts?.silent) setInput("");
      setBusy(true);
      // Track current task in workspace memory
      setMemory({ currentTask: question.slice(0, 200) });

      try {
        // Send trimmed conversation history for natural follow-ups
        const historyPayload = messages
          .filter((m) => !m.pending && !m.error)
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await turn({
          data: {
            question,
            eventId: context.eventId ?? undefined,
            vendorId: context.vendorId ?? undefined,
            role: context.role,
            pathname: context.pathname,
            history: historyPayload,
            memory: {
              currentTask: memory.currentTask ?? null,
              currentDraft: memory.currentDraft ?? null,
              currentEventId: memory.currentEventId ?? context.eventId ?? null,
              currentVendorId: memory.currentVendorId ?? context.vendorId ?? null,
            },
          },
        });

        const full = res.answer ?? "";
        const inflatedActions: MelaAssistAction[] = (res.actions ?? []).map((a) => {
          let payload: Record<string, unknown> = {};
          try {
            const parsed = JSON.parse(a.payloadJson);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
              payload = parsed as Record<string, unknown>;
          } catch {
            payload = { text: a.payloadJson };
          }
          const kind = a.kind as MelaAssistActionKind;
          return {
            id: uid(),
            kind,
            title: a.title,
            summary: a.summary ?? undefined,
            payload,
            previewOnly: !EXECUTABLE_KINDS.has(kind),
            status: "pending",
            createdAt: Date.now(),
          };
        });

        // Typewriter reveal
        const chunkSize = Math.max(2, Math.ceil(full.length / 60));
        let i = 0;
        await new Promise<void>((resolve) => {
          const tick = () => {
            i = Math.min(full.length, i + chunkSize);
            const partial = full.slice(0, i);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === pendingId
                  ? {
                      ...m,
                      content: partial,
                      pending: i < full.length,
                      actions: i >= full.length ? inflatedActions : undefined,
                    }
                  : m,
              ),
            );
            if (i < full.length) window.setTimeout(tick, 18);
            else resolve();
          };
          tick();
        });

        setNextSteps(res.nextSteps ?? []);
        if (inflatedActions.length > 0) {
          setMemory({ currentDraft: JSON.stringify(inflatedActions[0].payload).slice(0, 4000) });
        }
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
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [busy, turn, context, memory, setMemory, messages],
  );

  // Handle inbound initialPrompt when panel opens
  useEffect(() => {
    if (!open) return;
    if (initialPrompt) {
      const p = consumeInitialPrompt();
      if (p) void send(p, { silent: true });
    }
    requestAnimationFrame(() => inputRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt]);

  // ------- Action lifecycle -------
  const updateAction = useCallback(
    (messageId: string, actionId: string, patch: Partial<MelaAssistAction>) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.actions
            ? { ...m, actions: m.actions.map((a) => (a.id === actionId ? { ...a, ...patch } : a)) }
            : m,
        ),
      );
    },
    [],
  );

  const approveAction = useCallback(
    async (messageId: string, action: MelaAssistAction) => {
      if (action.previewOnly) {
        // Client-only accept: mark executed but note it's preview.
        updateAction(messageId, action.id, { status: "executed" });
        recordHistory({ kind: action.kind, title: `${getActionMeta(action.kind).label} (preview)`, status: "executed" });
        toast.success("Draft accepted — copy or apply manually.");
        return;
      }
      try {
        await execute({
          data: {
            kind: action.kind as ExecutableKind,
            payload: action.payload,
            eventId: context.eventId ?? undefined,
          },
        });
        updateAction(messageId, action.id, { status: "executed" });
        recordHistory({ kind: action.kind, title: getActionMeta(action.kind).label, status: "executed" });
        toast.success(`${getActionMeta(action.kind).label} applied`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Action failed";
        updateAction(messageId, action.id, { status: "failed", error: msg });
        recordHistory({ kind: action.kind, title: getActionMeta(action.kind).label, status: "failed", note: msg });
        toast.error(msg);
      }
    },
    [execute, context.eventId, updateAction, recordHistory],
  );

  const regenerateAction = useCallback(
    (action: MelaAssistAction) => {
      const last = lastQuestionRef.current;
      const prompt = last
        ? `Regenerate the "${action.title}" — try a different angle. Keep it aligned with the current task.`
        : `Regenerate the "${action.title}".`;
      void send(prompt);
    },
    [send],
  );

  function reset() {
    setMessages([]);
    setNextSteps([]);
    setInput("");
    setMemory({ currentTask: null, currentDraft: null });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  const hasMessages = messages.length > 0;

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? null : closeAssistant())}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        aria-describedby={undefined}
      >
        <MelaAssistHeader onClose={closeAssistant} onReset={reset} />

        <div className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            <>
              {memory.currentTask && (
                <ContinueWorkBanner
                  task={memory.currentTask}
                  onContinue={() => void send(`Continue helping me with: ${memory.currentTask}`, { silent: true })}
                  onStartNew={() => setMemory({ currentTask: null, currentDraft: null })}
                  onDiscard={() => setMemory({ currentTask: null, currentDraft: null })}
                />
              )}
              <MelaAssistSuggestions
                suggestions={pageContext.suggestions}
                greeting={pageContext.greeting}
                surface={pageContext.surface}
                tip={pageContext.tip}
                tipKey={pageContext.tipKey}
                onPick={(p) => void send(p)}
              />
            </>
          ) : (
            <div className="space-y-3 px-4 py-4">
              <MelaAssistConversation messages={messages} />
              {/* Render action cards under the latest assistant message */}
              {messages
                .filter((m) => m.role === "assistant" && m.actions && m.actions.length > 0)
                .slice(-1)
                .map((m) => (
                  <div key={`${m.id}-actions`} className="space-y-2">
                    {m.actions!.map((a) => (
                      <ActionCard
                        key={a.id}
                        action={a}
                        onApprove={() => approveAction(m.id, a)}
                        onEditSave={(nextPayload) => updateAction(m.id, a.id, { payload: nextPayload })}
                        onRegenerate={() => regenerateAction(a)}
                        onCancel={() => {
                          updateAction(m.id, a.id, { status: "cancelled" });
                          recordHistory({
                            kind: a.kind,
                            title: getActionMeta(a.kind).label,
                            status: "cancelled",
                          });
                        }}
                      />
                    ))}
                  </div>
                ))}
              {nextSteps.length > 0 && (
                <NextSteps steps={nextSteps} onPick={(s) => void send(s)} />
              )}
            </div>
          )}
        </div>

        <ActionHistory history={history} />

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
