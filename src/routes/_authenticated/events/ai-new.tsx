import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowUp, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ActionCard } from "@/components/melaassist/ActionCard";
import { MelaAssistConversation } from "@/components/melaassist/MelaAssistConversation";
import { NextSteps } from "@/components/melaassist/NextSteps";
import { getActionMeta } from "@/components/melaassist/action-registry";
import { useMelaAssist } from "@/components/melaassist/context";
import type { MelaAssistAction, MelaAssistActionKind, MelaAssistMessage } from "@/components/melaassist/types";
import { melaAssistTurn, executeMelaAction } from "@/lib/melaassist-actions.functions";
import { bootstrapEventPlan } from "@/lib/event-bootstrap.functions";

export const Route = createFileRoute("/_authenticated/events/ai-new")({
  head: () => ({
    meta: [
      { title: "Plan with MelaAssist — MelaBridge" },
      { name: "description", content: "Describe your event in plain language. MelaAssist drafts your event, timeline, budget, checklist, and vendor recommendations — you approve what to save." },
      { property: "og:title", content: "Plan with MelaAssist — MelaBridge" },
      { property: "og:description", content: "Conversational event creation. Drafts everything, saves nothing without your approval." },
    ],
  }),
  component: AiNewEventPage,
});

const EXECUTABLE_KINDS = new Set<MelaAssistActionKind>([
  "update_event_notes",
  "create_budget_item",
  "create_task",
  "create_event_draft",
  "add_timeline_milestone",
]);

type ExecutableKind =
  | "update_event_notes"
  | "create_budget_item"
  | "create_task"
  | "create_event_draft"
  | "add_timeline_milestone";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const STARTERS = [
  "I'm planning a wedding for 120 guests next October in Atlanta, budget around $30k.",
  "Help me plan my son's graduation party — around 50 people at our home.",
  "I'm hosting a baby shower for 40 guests in Chicago in June.",
  "Create a corporate holiday party for 150 employees in December.",
];

function AiNewEventPage() {
  const navigate = useNavigate();
  const { context, memory, setMemory, recordHistory } = useMelaAssist();
  const turn = useServerFn(melaAssistTurn);
  const execute = useServerFn(executeMelaAction);
  const bootstrap = useServerFn(bootstrapEventPlan);

  const [messages, setMessages] = useState<MelaAssistMessage[]>([]);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [approvedCounts, setApprovedCounts] = useState({ event: 0, timeline: 0, budget: 0, task: 0 });
  const [createdEventId, setCreatedEventId] = useState<string | null>(memory.currentEventId ?? null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastQuestionRef = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, nextSteps]);

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || busy) return;
      lastQuestionRef.current = question;
      setInput("");

      const userMsg: MelaAssistMessage = { id: uid(), role: "user", content: question, createdAt: Date.now() };
      const pendingId = uid();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: pendingId, role: "assistant", content: "", createdAt: Date.now(), pending: true },
      ]);
      setBusy(true);
      setMemory({ currentTask: question.slice(0, 200) });

      try {
        const historyPayload = messages
          .filter((m) => !m.pending && !m.error)
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await turn({
          data: {
            question,
            eventId: createdEventId ?? undefined,
            role: context.role === "organization" ? "organization" : "personal",
            pathname: "/events/ai-new",
            history: historyPayload,
            memory: {
              currentTask: question.slice(0, 200),
              currentEventId: createdEventId ?? memory.currentEventId ?? null,
            },
            builderMode: "event_builder",
          },
        });

        const full = res.answer ?? "";
        const inflated: MelaAssistAction[] = (res.actions ?? []).map((a) => {
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

        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId ? { ...m, content: full, pending: false, actions: inflated } : m,
          ),
        );
        setNextSteps(res.nextSteps ?? []);
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
    [busy, turn, messages, context.role, createdEventId, memory.currentEventId, setMemory],
  );

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
        updateAction(messageId, action.id, { status: "executed" });
        recordHistory({ kind: action.kind, title: `${getActionMeta(action.kind).label} (preview)`, status: "executed" });
        toast.success("Draft accepted — copy or apply manually.");
        return;
      }
      try {
        const res = (await execute({
          data: {
            kind: action.kind as ExecutableKind,
            payload: action.payload,
            eventId: createdEventId ?? undefined,
          },
        })) as { ok?: boolean; eventId?: string };

        if (action.kind === "create_event_draft" && res.eventId) {
          setCreatedEventId(res.eventId);
          setMemory({ currentEventId: res.eventId });
          setApprovedCounts((c) => ({ ...c, event: c.event + 1 }));
          // Kick off workspace bootstrap in the background — non-blocking
          setBootstrapping(true);
          bootstrap({ data: { event_id: res.eventId, only_if_empty: true } })
            .catch(() => {})
            .finally(() => setBootstrapping(false));
          toast.success("Event created — MelaAssist is scaffolding your workspace");
        } else if (action.kind === "add_timeline_milestone") {
          setApprovedCounts((c) => ({ ...c, timeline: c.timeline + 1 }));
          toast.success("Milestone added to timeline");
        } else if (action.kind === "create_budget_item") {
          setApprovedCounts((c) => ({ ...c, budget: c.budget + 1 }));
          toast.success("Budget line added");
        } else if (action.kind === "create_task") {
          setApprovedCounts((c) => ({ ...c, task: c.task + 1 }));
          toast.success("Checklist item added");
        } else {
          toast.success(`${getActionMeta(action.kind).label} applied`);
        }

        updateAction(messageId, action.id, { status: "executed" });
        recordHistory({ kind: action.kind, title: getActionMeta(action.kind).label, status: "executed" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Action failed";
        updateAction(messageId, action.id, { status: "failed", error: msg });
        recordHistory({ kind: action.kind, title: getActionMeta(action.kind).label, status: "failed", note: msg });
        toast.error(msg);
      }
    },
    [execute, bootstrap, createdEventId, updateAction, recordHistory, setMemory],
  );

  const regenerateAction = useCallback(
    (action: MelaAssistAction) => {
      const prompt = `Regenerate the "${action.title}" — try a different angle. Keep it aligned with the current event plan.`;
      void send(prompt);
    },
    [send],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  const totalApproved = approvedCounts.event + approvedCounts.timeline + approvedCounts.budget + approvedCounts.task;

  const eventCardActions = useMemo(() => {
    return messages
      .filter((m) => m.role === "assistant" && m.actions && m.actions.length > 0)
      .flatMap((m) => m.actions ?? []);
  }, [messages]);
  const eventDraftApproved = eventCardActions.some((a) => a.kind === "create_event_draft" && a.status === "executed");

  return (
    <AppShell active="/events">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-32">
        <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to events
        </Link>

        <PageHeader
          eyebrow="AI Event Builder"
          title="Plan with MelaAssist"
          description="Describe your event in your own words. MelaAssist drafts your event, timeline, budget, checklist, and vendor recommendations — nothing saves until you approve each card."
          icon={Sparkles}
        />

        {/* Progress strip */}
        <Card className="border-border/60 p-3 shadow-soft">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={eventDraftApproved ? "default" : "outline"} className="gap-1">
              {eventDraftApproved && <CheckCircle2 className="h-3 w-3" />} Event
              <span className="ml-1 text-muted-foreground">{approvedCounts.event}</span>
            </Badge>
            <Badge variant="outline" className="gap-1">Timeline<span className="ml-1 text-muted-foreground">{approvedCounts.timeline}</span></Badge>
            <Badge variant="outline" className="gap-1">Budget<span className="ml-1 text-muted-foreground">{approvedCounts.budget}</span></Badge>
            <Badge variant="outline" className="gap-1">Checklist<span className="ml-1 text-muted-foreground">{approvedCounts.task}</span></Badge>
            {bootstrapping && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> scaffolding workspace…
              </span>
            )}
            {eventDraftApproved && createdEventId && (
              <Button
                type="button"
                size="sm"
                variant="hero"
                className="ml-auto h-7 gap-1 px-2 text-xs"
                onClick={() => navigate({ to: "/events/$eventId", params: { eventId: createdEventId } })}
              >
                Open event workspace
              </Button>
            )}
          </div>
          {totalApproved > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {totalApproved} item{totalApproved === 1 ? "" : "s"} saved. Keep chatting to add more, or open your event workspace to continue planning.
            </p>
          )}
        </Card>

        {/* Chat surface */}
        <Card ref={scrollerRef as never} className="min-h-[320px] max-h-[62vh] overflow-y-auto border-border/60 p-3 shadow-soft">
          {messages.length === 0 ? (
            <div className="space-y-4 p-2">
              <div>
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Sparkles className="h-3 w-3" /> MelaAssist
                </div>
                <p className="text-sm">
                  Tell me about your event. I'll extract the details, ask about anything missing, and draft a full plan for you to approve.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-xl border border-border/60 bg-card p-3 text-left text-xs leading-snug transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <MelaAssistConversation messages={messages} />
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
                          recordHistory({ kind: a.kind, title: getActionMeta(a.kind).label, status: "cancelled" });
                        }}
                      />
                    ))}
                  </div>
                ))}
              {nextSteps.length > 0 && <NextSteps steps={nextSteps} onPick={(s) => void send(s)} />}
            </div>
          )}
        </Card>

        {/* Composer */}
        <form onSubmit={onSubmit} className="sticky bottom-0 -mx-2 border-t border-border/60 bg-background/95 px-2 pb-3 pt-2 backdrop-blur">
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
              placeholder="Describe your event, or answer MelaAssist's question…"
              className="min-h-[68px] resize-none pr-12"
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
          <p className="mt-1.5 px-1 text-[10.5px] leading-tight text-muted-foreground">
            <Sparkles className="mr-1 inline h-3 w-3" />
            Nothing is saved until you approve each card. Prefer a form? <Link to="/events/new" className="underline underline-offset-2">Use the classic flow</Link>.
          </p>
        </form>
      </div>
    </AppShell>
  );
}
