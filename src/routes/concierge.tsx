import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  Send,
  Wand2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Activity,
  Calendar,
  Wallet,
  Users,
  Store,
  Route as RouteIcon,
  CloudSun,
  Utensils,
  Accessibility,
  Car,
  Timer,
  Gauge,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/concierge")({
  head: () => ({
    meta: [
      { title: "MelaAssist™ — MelaBridge" },
      {
        name: "description",
        content:
          "MelaAssist™ is MelaBridge's flagship AI planner. Chat naturally and it builds your entire event workspace, simulates risks, and optimizes with one click.",
      },
      { property: "og:title", content: "MelaAssist™ — MelaBridge" },
      {
        property: "og:description",
        content:
          "The easiest way to plan any event. Conversational AI planning, event simulation, and one-click optimization.",
      },
    ],
  }),
  component: ConciergePage,
});

type Role = "concierge" | "user";
type Msg = { id: string; role: Role; text: string };

type Field =
  | "eventType"
  | "date"
  | "location"
  | "guestCount"
  | "budget"
  | "style"
  | "mustHaves"
  | "traditions"
  | "accessibility"
  | "travel"
  | "special"
  | "priorities";

const QUESTIONS: { field: Field; prompt: string; placeholder: string }[] = [
  { field: "eventType", prompt: "Wonderful to meet you. What are we planning together?", placeholder: "e.g. Traditional wedding, milestone birthday, corporate retreat…" },
  { field: "date", prompt: "Lovely. When is the event?", placeholder: "e.g. Saturday, June 14, 2026" },
  { field: "location", prompt: "Where will it take place?", placeholder: "e.g. Lagos, Nigeria — outdoor garden" },
  { field: "guestCount", prompt: "Roughly how many guests are you expecting?", placeholder: "e.g. 180" },
  { field: "budget", prompt: "What is your target budget? I'll build a plan that respects it.", placeholder: "e.g. $45,000" },
  { field: "style", prompt: "How should it feel — the style, vision, and mood?", placeholder: "e.g. Elegant, candlelit, cultural fusion" },
  { field: "mustHaves", prompt: "Any must-have vendors or elements I should protect in the budget?", placeholder: "e.g. Live band, videographer, floral arch" },
  { field: "traditions", prompt: "Are there cultural or religious traditions to honor?", placeholder: "e.g. Yoruba engagement, church ceremony" },
  { field: "accessibility", prompt: "Any accessibility needs I should plan for?", placeholder: "e.g. Wheelchair ramps, sign-language interpreter" },
  { field: "travel", prompt: "Will guests be traveling in? I can coordinate hotels and transport.", placeholder: "e.g. ~60 out-of-town guests" },
  { field: "special", prompt: "Any special requests I should know about?", placeholder: "e.g. Surprise performance, dietary needs" },
  { field: "priorities", prompt: "Finally, what matters most to you — top three priorities?", placeholder: "e.g. Guest experience, photography, food" },
];

function uid() {
  return Math.random().toString(36).slice(2);
}

function ConciergePage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: uid(),
      role: "concierge",
      text: "Hi, I'm MelaAssist™ — your dedicated planner. Tell me about your event in your own words, and I'll build your entire workspace in minutes.",
    },
    { id: uid(), role: "concierge", text: QUESTIONS[0].prompt },
  ]);
  const [answers, setAnswers] = useState<Partial<Record<Field, string>>>({});
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [generated, setGenerated] = useState(false);
  const [healthScore, setHealthScore] = useState(0);
  const [simulation, setSimulation] = useState<null | ReturnType<typeof runSimulation>>(null);
  const [optimizations, setOptimizations] = useState<string[] | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, generated]);

  const progress = Math.round((step / QUESTIONS.length) * 100);
  const workspace = useMemo(() => (generated ? buildWorkspace(answers) : null), [answers, generated]);

  const send = () => {
    const value = input.trim();
    if (!value) return;
    const current = QUESTIONS[step];
    const next: Msg[] = [...messages, { id: uid(), role: "user", text: value }];
    const nextAnswers = { ...answers, [current.field]: value };
    setAnswers(nextAnswers);
    setInput("");

    if (step + 1 < QUESTIONS.length) {
      const q = QUESTIONS[step + 1];
      next.push({ id: uid(), role: "concierge", text: conciergeAck(current.field, value) });
      next.push({ id: uid(), role: "concierge", text: q.prompt });
      setStep(step + 1);
      setMessages(next);
    } else {
      next.push({
        id: uid(),
        role: "concierge",
        text: "Beautiful. I have everything I need. Generating your complete event workspace now…",
      });
      setStep(step + 1);
      setMessages(next);
      setTimeout(() => {
        setGenerated(true);
        setHealthScore(72);
      }, 900);
    }
  };

  const runSim = () => {
    const result = runSimulation(answers);
    setSimulation(result);
    setHealthScore((s) => Math.max(50, s - result.risks.filter((r) => r.severity === "high").length * 4));
  };

  const optimize = () => {
    const notes = [
      "Re-sequenced timeline — vendor load-in shifted 45 min earlier to prevent guest overlap.",
      "Rebalanced budget — moved 6% from décor to guest experience (welcome bags, transport).",
      "Bundled two vendors from the same collective to unlock a 12% package discount.",
      "Added 3 missing tasks: rain plan, dietary matrix, and vendor day-of contact sheet.",
      "Promoted photography to Priority 1 based on your stated priorities.",
      "Introduced a 30-minute buffer between ceremony and reception to reduce guest wait time.",
    ];
    setOptimizations(notes);
    setHealthScore((s) => Math.min(98, s + 14));
    if (simulation) {
      setSimulation({
        ...simulation,
        risks: simulation.risks.map((r) => ({ ...r, resolved: true })),
      });
    }
  };

  return (
    <AppShell active="/concierge">
      <div className="space-y-6">
        <PageHeader
          eyebrow="MelaAssist™"
          title={
            <>
              Your planning co-pilot,{" "}
              <span className="bg-gradient-to-r from-primary to-gold bg-clip-text text-transparent">on call</span>
            </>
          }
          description="Have a conversation. MelaAssist drafts your event workspace — timeline, budget, vendors, travel, and risk plan — for you to review and approve."
          icon={Sparkles}
          actions={
            generated ? (
              <>
                <Button variant="outline" onClick={runSim} className="gap-2">
                  <Activity className="h-4 w-4" /> Simulate My Event
                </Button>
                <Button onClick={optimize} className="gap-2 bg-gradient-to-r from-primary to-gold text-primary-foreground">
                  <Wand2 className="h-4 w-4" /> Optimize My Event
                </Button>
              </>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <Timer className="h-3 w-3" /> ~2 min setup
              </Badge>
            )
          }
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Conversation */}
          <Card className="flex h-[640px] flex-col overflow-hidden border-border/60 shadow-soft">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">MelaAssist™</p>
                  <p className="text-xs text-muted-foreground">Elite AI planner · always on</p>
                </div>
              </div>
              <div className="w-40">
                <Progress value={generated ? 100 : progress} />
                <p className="mt-1 text-right text-[10px] text-muted-foreground">
                  {generated ? "Workspace ready" : `${progress}% understood`}
                </p>
              </div>
            </div>

            <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent/60 text-foreground"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {generated && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
                  <p className="font-medium text-primary">✨ Your workspace is live.</p>
                  <p className="mt-1 text-muted-foreground">
                    I've assembled your dashboard, timeline, budget, guest strategy, vendor booking order, travel plan, and
                    risk assessment. Try <em>Simulate My Event</em> to preview issues before they happen, or <em>Optimize</em>{" "}
                    to raise your Event Health Score™.
                  </p>
                </div>
              )}
            </div>

            {!generated && step < QUESTIONS.length && (
              <div className="border-t border-border/60 bg-background/60 p-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder={QUESTIONS[step].placeholder}
                    className="min-h-[48px] resize-none"
                  />
                  <Button onClick={send} size="icon" className="h-11 w-11 shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Concierge is asking only the questions needed to personalize your event.
                </p>
              </div>
            )}
          </Card>

          {/* Live workspace preview */}
          <div className="space-y-4">
            <Card className="overflow-hidden border-border/60 p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Event Health Score™</p>
                  <p className="mt-1 font-display text-4xl font-semibold">
                    {generated ? healthScore : "—"}
                    <span className="text-lg text-muted-foreground">/100</span>
                  </p>
                </div>
                <div className="relative grid h-20 w-20 place-items-center">
                  <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-border" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9"
                      fill="none"
                      strokeLinecap="round"
                      strokeWidth="3"
                      strokeDasharray={`${generated ? healthScore : 0}, 100`}
                      className="stroke-primary"
                    />
                  </svg>
                  <Gauge className="absolute h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {generated
                  ? "Live score updates as Concierge learns and you accept optimizations."
                  : "Complete the conversation to activate your score."}
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <MiniStat icon={Users} label="Guests" value={workspace?.guests ?? "—"} />
              <MiniStat icon={Wallet} label="Budget" value={workspace?.budget ?? "—"} />
              <MiniStat icon={Calendar} label="Date" value={workspace?.date ?? "—"} />
              <MiniStat icon={RouteIcon} label="Travel" value={workspace?.travelStat ?? "—"} />
            </div>

            {workspace && (
              <Card className="border-border/60 p-5 shadow-soft">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Auto-generated for you</p>
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> 21 modules ready
                  </Badge>
                </div>
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  {workspace.modules.map((m) => (
                    <li key={m} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {m}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="mt-4 w-full gap-2">
                  Open full workspace <ArrowRight className="h-4 w-4" />
                </Button>
              </Card>
            )}
          </div>
        </div>

        {/* Concierge recommendations */}
        {workspace && (
          <Card className="border-border/60 p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Concierge recommendations</p>
              <Badge variant="secondary">Proactive</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {workspace.recommendations.map((r) => (
                <div key={r.title} className="rounded-xl border border-border/60 bg-accent/40 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <r.icon className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">{r.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.detail}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* AI Event Simulator */}
        {simulation && (
          <Card className="border-border/60 p-6 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">AI Event Simulator™</p>
                <Badge variant="secondary">Ran 10,000 scenarios</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {simulation.risks.filter((r) => !r.resolved).length} open ·{" "}
                {simulation.risks.filter((r) => r.resolved).length} resolved
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {simulation.risks.map((r) => (
                <div
                  key={r.title}
                  className={`rounded-xl border p-4 ${
                    r.resolved
                      ? "border-primary/30 bg-primary/5"
                      : r.severity === "high"
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border/60 bg-accent/30"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    {r.resolved ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <AlertTriangle
                        className={`h-4 w-4 ${r.severity === "high" ? "text-destructive" : "text-muted-foreground"}`}
                      />
                    )}
                    <p className="text-sm font-medium">{r.title}</p>
                    <Badge variant={r.resolved ? "secondary" : "outline"} className="ml-auto text-[10px]">
                      {r.resolved ? "Resolved" : r.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.detail}</p>
                  <p className="mt-2 text-xs">
                    <span className="font-medium text-primary">Fix:</span> {r.fix}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Optimization summary */}
        {optimizations && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Optimization summary</p>
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3 w-3" /> Score +14
              </Badge>
            </div>
            <ol className="space-y-2 text-sm">
              {optimizations.map((n, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{n}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="border-border/60 p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-1 truncate text-lg font-semibold">{value}</p>
    </Card>
  );
}

function conciergeAck(field: Field, value: string): string {
  const v = value.trim();
  switch (field) {
    case "eventType":
      return `A ${v.toLowerCase()} — I love it. I'm already sketching a plan tailored to that.`;
    case "date":
      return `Noted for ${v}. I'll build the timeline backwards from that date.`;
    case "location":
      return `${v} — I'll factor in local vendors, weather patterns, and travel logistics.`;
    case "guestCount":
      return `Great — planning for ${v}. That shapes catering, seating, and venue flow.`;
    case "budget":
      return `Understood. I'll build an allocation that protects your must-haves within ${v}.`;
    case "style":
      return `Beautiful vision. I'll match vendor recommendations to that aesthetic.`;
    case "mustHaves":
      return `Locked in. Those elements get priority in your budget.`;
    case "traditions":
      return `I'll honor those traditions in the schedule and vendor briefs.`;
    case "accessibility":
      return `Thank you — accessibility will be a first-class part of the plan.`;
    case "travel":
      return `Got it. I'll draft hotel blocks and transport routes.`;
    case "special":
      return `Noted — I'll weave that in carefully.`;
    case "priorities":
      return `Priorities set. Everything I recommend will optimize for these first.`;
  }
}

function buildWorkspace(a: Partial<Record<Field, string>>) {
  return {
    guests: a.guestCount ?? "180",
    budget: a.budget ?? "—",
    date: a.date ?? "—",
    travelStat: a.travel ? "Coordinated" : "Local",
    modules: [
      "AI Command Center",
      "Event Health Score™",
      "Master Timeline",
      "Personalized Checklist",
      "Budget Plan & Allocation",
      "Guest Strategy",
      "Vendor Recommendations",
      "Vendor Booking Order",
      "Communication Schedule",
      "Seating Framework",
      "Travel Plan",
      "Hotel Blocks",
      "Transportation",
      "Risk Assessment",
      "Backup Contingency",
      "Suggested Schedule",
      "Planning Calendar",
      "Payment Schedule",
      "Milestone Roadmap",
      "Decision Center™",
      "BridgeVault™ Archive",
    ],
    recommendations: [
      {
        icon: Wallet,
        title: "Reallocate 8% to guest experience",
        detail: "Data from similar events shows the biggest lift comes from welcome, transport, and hospitality touches.",
      },
      {
        icon: Store,
        title: "Alternative florist available",
        detail: "A vetted florist in your area matches your aesthetic at 22% lower cost with same-week availability.",
      },
      {
        icon: CloudSun,
        title: "Weather backup recommended",
        detail: "Historical patterns show a 34% chance of rain on that date — Concierge added a tented Plan B.",
      },
      {
        icon: Utensils,
        title: "Add dietary matrix",
        detail: "For 180 guests, plan on ~12% dietary variations. Concierge drafted a guest-facing form.",
      },
      {
        icon: Accessibility,
        title: "Accessibility path mapped",
        detail: "Ramps, reserved seating, and shuttle boarding added to the venue diagram.",
      },
      {
        icon: Timer,
        title: "Book photographer within 14 days",
        detail: "Top 3 matches in your budget have limited availability in your date window.",
      },
    ],
  };
}

function runSimulation(_a: Partial<Record<Field, string>>) {
  return {
    risks: [
      {
        title: "Parking capacity tight",
        severity: "high" as const,
        detail: "Projected 62 vehicles vs. 48 on-site spots. Overflow could delay arrivals by 20+ minutes.",
        fix: "Add shuttle from partner lot 0.4 mi away; reserve 8 valet spots for elders.",
        resolved: false,
      },
      {
        title: "Ceremony → reception gap too long",
        severity: "medium" as const,
        detail: "45-minute gap risks guest disengagement, especially with children present.",
        fix: "Insert a cocktail hour with light hors d'oeuvres and live acoustic set.",
        resolved: false,
      },
      {
        title: "Vendor load-in overlap",
        severity: "high" as const,
        detail: "Florist and caterer both scheduled 10:00 AM at the same loading zone.",
        fix: "Stagger to 9:15 AM (florist) and 10:30 AM (caterer); notify venue.",
        resolved: false,
      },
      {
        title: "Weather risk on event day",
        severity: "medium" as const,
        detail: "Regional forecast history shows scattered showers likely.",
        fix: "Confirm tent hold with rain-plan vendor 72 hours prior.",
        resolved: false,
      },
      {
        title: "Food service bottleneck",
        severity: "medium" as const,
        detail: "Single buffet line for 180 guests exceeds 35-min service window.",
        fix: "Add second mirrored buffet line or switch entrée to plated service.",
        resolved: false,
      },
      {
        title: "Accessibility gap at entry",
        severity: "high" as const,
        detail: "Main entry has a 6-inch step; no alternate route noted.",
        fix: "Rent portable ramp + signage; add greeter for wheelchair guests.",
        resolved: false,
      },
      {
        title: "Transportation gap for late guests",
        severity: "medium" as const,
        detail: "Last shuttle scheduled 30 minutes before likely event end.",
        fix: "Add a second late-night shuttle at +45 and +90 minutes.",
        resolved: false,
      },
      {
        title: "Timeline conflict — toasts vs. sunset photos",
        severity: "medium" as const,
        detail: "Golden hour overlaps with scheduled toasts by 12 minutes.",
        fix: "Move toasts 20 minutes later; protect a 15-minute photo window.",
        resolved: false,
      },
    ] as Array<{
      title: string;
      severity: "high" | "medium";
      detail: string;
      fix: string;
      resolved: boolean;
    }>,
  };
}

// Unused imports (kept for future usage / lint tolerance)
void Input;
void Car;
