import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { RippleFeed } from "@/components/ripple-feed";
import { useEcosystem } from "@/lib/ecosystem-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Check, Circle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — MelaBridge" },
      { name: "description", content: "Every action item across the event, prioritized by AI." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TasksPage,
});

const INITIAL = [
  { title: "Confirm florist contract — Bloomhaus", when: "Today · 5 PM", urgent: true },
  { title: "Send save-the-dates (batch 2)", when: "Today", urgent: true },
  { title: "Approve caterer tasting menu", when: "Tomorrow", urgent: false },
  { title: "Review DJ playlist draft", when: "In 2 days", urgent: false },
  { title: "Finalize seating for VIP table", when: "This week", urgent: false },
  { title: "Confirm hotel block release date", when: "Next week", urgent: false },
];

function TasksPage() {
  const { completeTask } = useEcosystem();
  const [done, setDone] = useState<Set<string>>(new Set());

  const toggle = (t: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(t)) {
        next.delete(t);
      } else {
        next.add(t);
        completeTask();
      }
      return next;
    });
  };

  return (
    <AppShell active="/tasks">
      <PageHeader
        eyebrow="Tasks"
        icon={ClipboardList}
        title={<>The next right thing, <span className="text-gradient">every time</span>.</>}
        description="AI orders your list by impact on Event Health Score™. Completing a task advances the timeline and updates the collaboration feed."
      />
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {INITIAL.map((t) => {
              const isDone = done.has(t.title);
              return (
                <li key={t.title} className="flex items-center gap-3 p-4">
                  <button onClick={() => toggle(t.title)} className="grid h-6 w-6 place-items-center rounded-full border border-border transition hover:border-primary">
                    {isDone ? <Check className="h-4 w-4 text-primary" /> : <Circle className="h-3 w-3 text-muted-foreground" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.when}</p>
                  </div>
                  {t.urgent && !isDone && <Badge className="bg-rose-500/10 text-rose-700">Urgent</Badge>}
                  <Button size="sm" variant="ghost">Draft with AI</Button>
                </li>
              );
            })}
          </ul>
        </div>
        <RippleFeed />
      </section>
    </AppShell>
  );
}
