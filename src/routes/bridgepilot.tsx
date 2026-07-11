import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Briefcase,
  Sparkles,
  Inbox,
  FileText,
  Calculator,
  Bot,
  Settings2,
  TrendingUp,
  Trophy,
  CalendarClock,
  DollarSign,
  ClipboardCheck,
  MailCheck,
  AlertCircle,
  Check,
  Clock,
  ArrowRight,
  Wand2,
  Send,
  PenLine,
  Star,
} from "lucide-react";

export const Route = createFileRoute("/bridgepilot")({
  head: () => ({
    meta: [
      { title: "BridgePilot™ — MelaBridge for Vendors" },
      {
        name: "description",
        content:
          "BridgePilot™ is the AI business operating system for MelaBridge vendors — inbox triage, instant quotes, proposals, follow-ups, and a live BridgeScore™.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BridgePilotPage,
});

// ---------------- Mock data ----------------

const TODAY_SCHEDULE = [
  { time: "9:30 AM", title: "Consult · Amara & Julien (Wedding)", tag: "Call" },
  { time: "11:00 AM", title: "Venue walk-through · Lake Como", tag: "On-site" },
  { time: "2:00 PM", title: "Tasting · Onyema Catering", tag: "Meeting" },
  { time: "5:30 PM", title: "Send proposal · Idris 40th", tag: "Deadline" },
];

const TODAY_METRICS = [
  { label: "New inquiries", value: 4, icon: Inbox, tone: "text-primary" },
  { label: "Pending quotes", value: 3, icon: Calculator, tone: "text-amber-600" },
  { label: "Contracts awaiting signature", value: 2, icon: ClipboardCheck, tone: "text-blue-600" },
  { label: "Deposits due", value: "$3,200", icon: DollarSign, tone: "text-emerald-600" },
  { label: "Outstanding balances", value: "$8,450", icon: AlertCircle, tone: "text-rose-600" },
  { label: "Upcoming events (30d)", value: 6, icon: CalendarClock, tone: "text-violet-600" },
];

const OVERNIGHT_SUMMARY = [
  "3 new inquiries captured by Smart Inquiry Assistant™ — all fully qualified.",
  "Idris 40th proposal was opened twice at 10:42 PM — high intent signal.",
  "1 contract signed overnight (Ade & Kemi engagement). Deposit of $1,200 cleared.",
  "AI drafted 5 replies for your approval and rescheduled 2 follow-ups to 10:15 AM.",
];

type LeadStage =
  | "New Leads"
  | "Waiting on Customer"
  | "Waiting on Vendor"
  | "Booked"
  | "Follow-Up Needed"
  | "Closed";

type Lead = {
  id: string;
  name: string;
  event: string;
  date: string;
  guests: number;
  budget: string;
  location: string;
  stage: LeadStage;
  lastActivity: string;
  score: number;
  draft: string;
};

const INITIAL_LEADS: Lead[] = [
  {
    id: "l1",
    name: "Zara Okonkwo",
    event: "Wedding",
    date: "Aug 14, 2026",
    guests: 180,
    budget: "$25–35k",
    location: "Brooklyn, NY",
    stage: "New Leads",
    lastActivity: "12 min ago",
    score: 94,
    draft:
      "Hi Zara — congratulations! Based on your date and 180-guest plan I have full availability and two packages that fit your budget. I've drafted an Instant Quote™ with three options and can hold your date for 48h. Want me to send it over?",
  },
  {
    id: "l2",
    name: "Idris Balogun",
    event: "40th Birthday",
    date: "Jan 24, 2026",
    guests: 90,
    budget: "$10–15k",
    location: "Atlanta, GA",
    stage: "Waiting on Customer",
    lastActivity: "opened proposal 2x last night",
    score: 88,
    draft:
      "Hi Idris — just checking you were able to open the proposal. Happy to walk you through the Gold vs Platinum package on a quick 15-min call this week. Would Wed 4pm or Thu 11am work?",
  },
  {
    id: "l3",
    name: "The Adekunle Family",
    event: "Family Reunion",
    date: "Jul 04, 2026",
    guests: 220,
    budget: "$18k",
    location: "Houston, TX",
    stage: "Follow-Up Needed",
    lastActivity: "no reply in 5 days",
    score: 72,
    draft:
      "Hi Chinwe — I know reunions take a village to plan. I've saved your date for another 72 hours. Want me to trim the package to hit $18k exactly, or share a smaller option?",
  },
  {
    id: "l4",
    name: "Amara & Julien",
    event: "Wedding",
    date: "Oct 17, 2026",
    guests: 142,
    budget: "$65–75k",
    location: "Lake Como, Italy",
    stage: "Booked",
    lastActivity: "contract signed",
    score: 99,
    draft: "",
  },
  {
    id: "l5",
    name: "Nova Studios",
    event: "Corporate Launch",
    date: "Mar 08, 2026",
    guests: 300,
    budget: "$40k",
    location: "Los Angeles, CA",
    stage: "Waiting on Vendor",
    lastActivity: "you owe: revised quote",
    score: 81,
    draft:
      "Hi Priya — thanks for the notes. Sending a revised quote with the extended bar package and earlier load-in today. You'll have it within the hour.",
  },
];

const STAGES: LeadStage[] = [
  "New Leads",
  "Waiting on Customer",
  "Waiting on Vendor",
  "Booked",
  "Follow-Up Needed",
  "Closed",
];

const STAGE_TONE: Record<LeadStage, string> = {
  "New Leads": "bg-primary/10 text-primary",
  "Waiting on Customer": "bg-amber-500/10 text-amber-700",
  "Waiting on Vendor": "bg-rose-500/10 text-rose-700",
  Booked: "bg-emerald-500/10 text-emerald-700",
  "Follow-Up Needed": "bg-violet-500/10 text-violet-700",
  Closed: "bg-muted text-muted-foreground",
};

// ---------------- Page ----------------

function BridgePilotPage() {
  return (
    <AppShell active="/bridgepilot">
      <PageHeader
        eyebrow="BridgePilot™ · AI business OS for vendors"
        icon={Briefcase}
        title={
          <>
            What do you need to do <span className="text-gradient">today</span>?
          </>
        }
        description="One calm home base for your event business. BridgePilot triages inquiries, drafts replies, sends quotes, and closes the loop — so you can keep the personal touch that wins bookings."
        actions={
          <>
            <Button variant="outline">
              <Wand2 className="mr-2 h-4 w-4" /> Draft with AI
            </Button>
            <Button variant="hero">
              <Send className="mr-2 h-4 w-4" /> Send today's replies
            </Button>
          </>
        }
      />

      <Tabs defaultValue="today" className="mt-8">
        <TabsList className="flex-wrap">
          <TabsTrigger value="today"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Today</TabsTrigger>
          <TabsTrigger value="inbox"><Inbox className="mr-1.5 h-3.5 w-3.5" />AI Inbox</TabsTrigger>
          <TabsTrigger value="quote"><Calculator className="mr-1.5 h-3.5 w-3.5" />Instant Quote™</TabsTrigger>
          <TabsTrigger value="proposal"><FileText className="mr-1.5 h-3.5 w-3.5" />Proposals</TabsTrigger>
          <TabsTrigger value="coach"><Bot className="mr-1.5 h-3.5 w-3.5" />Business Coach</TabsTrigger>
          <TabsTrigger value="rules"><Settings2 className="mr-1.5 h-3.5 w-3.5" />Rules</TabsTrigger>
          <TabsTrigger value="score"><Trophy className="mr-1.5 h-3.5 w-3.5" />BridgeScore™</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-6"><TodayView /></TabsContent>
        <TabsContent value="inbox" className="mt-6"><InboxView /></TabsContent>
        <TabsContent value="quote" className="mt-6"><InstantQuoteView /></TabsContent>
        <TabsContent value="proposal" className="mt-6"><ProposalView /></TabsContent>
        <TabsContent value="coach" className="mt-6"><CoachView /></TabsContent>
        <TabsContent value="rules" className="mt-6"><RulesView /></TabsContent>
        <TabsContent value="score" className="mt-6"><ScoreView /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

// ---------------- Today ----------------

function TodayView() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-background to-accent/20 p-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Overnight summary from BridgePilot™
          </div>
          <ul className="space-y-2 text-sm">
            {OVERNIGHT_SUMMARY.map((line) => (
              <li key={line} className="flex gap-2">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TODAY_METRICS.map((m) => (
            <div key={m.label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <m.icon className={`h-4 w-4 ${m.tone}`} />
              </div>
              <p className="mt-2 font-display text-2xl font-semibold">{m.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h3 className="font-display text-lg font-semibold">Today's schedule</h3>
            <Badge variant="secondary">Thu · 4 events</Badge>
          </div>
          <ul className="divide-y divide-border">
            {TODAY_SCHEDULE.map((s) => (
              <li key={s.time} className="flex items-center gap-4 px-5 py-3">
                <span className="w-24 text-sm font-medium text-muted-foreground">{s.time}</span>
                <span className="flex-1 text-sm">{s.title}</span>
                <Badge className="bg-accent text-accent-foreground">{s.tag}</Badge>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold">Monthly revenue</h3>
              <p className="text-xs text-muted-foreground">November · booked + projected</p>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-700 gap-1">
              <TrendingUp className="h-3 w-3" /> +18% vs last month
            </Badge>
          </div>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="font-display text-3xl font-semibold">$42,900</p>
              <p className="text-xs text-muted-foreground">of $58,000 goal</p>
            </div>
            <div className="flex-1">
              <Progress value={74} />
              <p className="mt-1 text-right text-xs text-muted-foreground">74%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-semibold">Needs your attention</h3>
          </div>
          <ul className="space-y-3 text-sm">
            <AttentionRow tone="warn" title="Approve 5 AI-drafted replies" hint="1 is high-intent (Idris)." />
            <AttentionRow tone="info" title="Confirm Sat tasting time" hint="Onyema replied at 7:12 AM." />
            <AttentionRow tone="good" title="Send deposit reminder · Nova Studios" hint="Due Friday · $4,000." />
            <AttentionRow tone="warn" title="Adekunle Reunion has gone quiet" hint="Follow-up drafted." />
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-hero-radial p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> BridgePilot™ tip of the day
          </div>
          <p className="text-sm">
            Your fastest replies (under 12 min) convert 3.2× more than replies over an hour. Approve the 5 drafts now and lock in your streak.
          </p>
          <Button size="sm" className="mt-4" variant="hero">
            Approve & send <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function AttentionRow({ tone, title, hint }: { tone: "warn" | "info" | "good"; title: string; hint: string }) {
  const dot =
    tone === "warn" ? "bg-amber-500" : tone === "good" ? "bg-emerald-500" : "bg-primary";
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-1.5 h-2 w-2 rounded-full ${dot}`} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Button size="sm" variant="ghost" className="h-7">Open</Button>
    </li>
  );
}

// ---------------- Inbox ----------------

function InboxView() {
  const [leads, setLeads] = useState(INITIAL_LEADS);
  const [activeId, setActiveId] = useState<string>(INITIAL_LEADS[0].id);
  const [stageFilter, setStageFilter] = useState<LeadStage | "All">("All");

  const filtered = useMemo(
    () => (stageFilter === "All" ? leads : leads.filter((l) => l.stage === stageFilter)),
    [leads, stageFilter]
  );
  const active = leads.find((l) => l.id === activeId) ?? leads[0];

  const counts = useMemo(() => {
    const m = new Map<LeadStage, number>();
    STAGES.forEach((s) => m.set(s, 0));
    for (const l of leads) m.set(l.stage, (m.get(l.stage) ?? 0) + 1);
    return m;
  }, [leads]);

  const moveStage = (id: string, stage: LeadStage) =>
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <FilterChip label={`All · ${leads.length}`} active={stageFilter === "All"} onClick={() => setStageFilter("All")} />
        {STAGES.map((s) => (
          <FilterChip
            key={s}
            label={`${s} · ${counts.get(s) ?? 0}`}
            active={stageFilter === s}
            onClick={() => setStageFilter(s)}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-3xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {filtered.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => setActiveId(l.id)}
                  className={`w-full px-4 py-3 text-left transition hover:bg-accent/50 ${
                    active.id === l.id ? "bg-accent/60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{l.name}</p>
                    <Badge className="bg-primary/10 text-primary gap-1">
                      <Sparkles className="h-3 w-3" /> {l.score}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {l.event} · {l.date} · {l.guests} guests
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STAGE_TONE[l.stage]}`}>
                      {l.stage}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{l.lastActivity}</span>
                  </div>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">Nothing here — inbox zero ✨</li>
            )}
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Smart Inquiry Assistant™</p>
              <h3 className="font-display text-xl font-semibold">{active.name}</h3>
              <p className="text-sm text-muted-foreground">
                {active.event} · {active.date} · {active.location}
              </p>
            </div>
            <Badge className={STAGE_TONE[active.stage]}>{active.stage}</Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Guests" value={String(active.guests)} />
            <MiniStat label="Budget" value={active.budget} />
            <MiniStat label="Fit score" value={`${active.score}/100`} />
            <MiniStat label="Last activity" value={active.lastActivity} />
          </div>

          <Separator className="my-5" />

          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
              <Wand2 className="h-3.5 w-3.5" /> AI-drafted reply · trained on your voice
            </div>
            <Textarea defaultValue={active.draft} className="min-h-[140px]" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="hero" size="sm">
                <Send className="mr-2 h-4 w-4" /> Approve & send
              </Button>
              <Button variant="outline" size="sm">
                <PenLine className="mr-2 h-4 w-4" /> Edit tone
              </Button>
              <Button variant="ghost" size="sm">Snooze 24h</Button>
              <div className="ml-auto flex gap-2">
                {STAGES.filter((s) => s !== active.stage).slice(0, 3).map((s) => (
                  <Button key={s} size="sm" variant="outline" onClick={() => moveStage(active.id, s)}>
                    Move to {s}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

// ---------------- Instant Quote ----------------

function InstantQuoteView() {
  const [guests, setGuests] = useState(120);
  const [hours, setHours] = useState(6);
  const [tier, setTier] = useState<"Essentials" | "Signature" | "Luxe">("Signature");
  const [addons, setAddons] = useState({ bar: true, photo: false, decor: true });

  const base = tier === "Essentials" ? 95 : tier === "Signature" ? 155 : 245;
  const perHour = tier === "Essentials" ? 180 : tier === "Signature" ? 260 : 420;
  const addonTotal = (addons.bar ? 1400 : 0) + (addons.photo ? 2800 : 0) + (addons.decor ? 1900 : 0);
  const subtotal = guests * base + hours * perHour + addonTotal;
  const deposit = Math.round(subtotal * 0.3);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-5 rounded-3xl border border-border bg-card p-6">
        <div>
          <h3 className="font-display text-lg font-semibold">Customer questionnaire</h3>
          <p className="text-sm text-muted-foreground">
            Customers answer 6 quick questions and receive an instant, on-brand quote based on your Business Rules.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Guest count · {guests}</Label>
            <Slider value={[guests]} min={20} max={400} step={10} onValueChange={(v) => setGuests(v[0])} className="mt-3" />
          </div>
          <div>
            <Label>Event hours · {hours}</Label>
            <Slider value={[hours]} min={2} max={12} step={1} onValueChange={(v) => setHours(v[0])} className="mt-3" />
          </div>
        </div>
        <div>
          <Label>Package</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["Essentials", "Signature", "Luxe"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`rounded-xl border p-3 text-left transition ${
                  tier === t ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"
                }`}
              >
                <p className="text-sm font-semibold">{t}</p>
                <p className="text-xs text-muted-foreground">
                  {t === "Essentials" ? "Great core service" : t === "Signature" ? "Most popular" : "Premium end-to-end"}
                </p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Optional add-ons</Label>
          <div className="mt-2 space-y-2">
            <AddonRow label="Premium bar package" price={1400} checked={addons.bar} onChange={(v) => setAddons({ ...addons, bar: v })} />
            <AddonRow label="Photography team" price={2800} checked={addons.photo} onChange={(v) => setAddons({ ...addons, photo: v })} />
            <AddonRow label="Signature decor & florals" price={1900} checked={addons.decor} onChange={(v) => setAddons({ ...addons, decor: v })} />
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-background to-accent/20 p-6">
        <Badge className="bg-emerald-500/10 text-emerald-700 gap-1">
          <Check className="h-3 w-3" /> Available for the requested date
        </Badge>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Instant Quote™</p>
          <p className="font-display text-4xl font-semibold">${subtotal.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Estimate · you approve before it's sent</p>
        </div>
        <Separator />
        <ul className="space-y-1.5 text-sm">
          <QuoteLine label={`${tier} · ${guests} guests`} value={`$${(guests * base).toLocaleString()}`} />
          <QuoteLine label={`${hours} event hours`} value={`$${(hours * perHour).toLocaleString()}`} />
          <QuoteLine label="Add-ons" value={`$${addonTotal.toLocaleString()}`} />
          <QuoteLine label="Suggested deposit (30%)" value={`$${deposit.toLocaleString()}`} strong />
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button variant="hero"><Send className="mr-2 h-4 w-4" /> Send to customer</Button>
          <Button variant="outline"><CalendarClock className="mr-2 h-4 w-4" /> Offer consultation</Button>
        </div>
      </div>
    </div>
  );
}

function AddonRow({ label, price, checked, onChange }: { label: string; price: number; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
      <div className="flex items-center gap-3">
        <Switch checked={checked} onCheckedChange={onChange} />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium">+${price.toLocaleString()}</span>
    </label>
  );
}

function QuoteLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <li className={`flex justify-between ${strong ? "border-t border-border pt-2 font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </li>
  );
}

// ---------------- Proposals ----------------

function ProposalView() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <div className="rounded-3xl border border-border bg-card p-5">
        <h3 className="font-display text-lg font-semibold">Proposal builder</h3>
        <p className="text-sm text-muted-foreground">Generated from the accepted quote. Edit anything, then send for signature.</p>
        <div className="mt-4 space-y-3">
          <div>
            <Label>Brand headline</Label>
            <Input defaultValue="Onyema Catering · A Menu Worth Remembering" />
          </div>
          <div>
            <Label>Client</Label>
            <Input defaultValue="Zara Okonkwo — Wedding · Aug 14, 2026" />
          </div>
          <div>
            <Label>Package summary</Label>
            <Textarea defaultValue="Signature package for 180 guests · 6 event hours · premium bar · signature florals. Includes tasting, load-in/out, and event captain." className="min-h-[110px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Total</Label>
              <Input defaultValue="$32,400" />
            </div>
            <div>
              <Label>Deposit</Label>
              <Input defaultValue="$9,720 (30%)" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="hero"><Send className="mr-2 h-4 w-4" /> Send for signature</Button>
            <Button variant="outline"><FileText className="mr-2 h-4 w-4" /> Preview PDF</Button>
            <Button variant="ghost">Save draft</Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Contracts awaiting signature</h3>
            <Badge variant="secondary">2</Badge>
          </div>
          <ul className="mt-3 divide-y divide-border">
            <ContractRow name="Idris Balogun · 40th" amount="$14,200" status="Viewed 2×" tone="text-amber-600" />
            <ContractRow name="Nova Studios · Launch" amount="$38,900" status="Sent · 1d ago" tone="text-primary" />
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <h3 className="font-display text-lg font-semibold">AI follow-up</h3>
          <p className="text-sm text-muted-foreground">Personalized nudges based on customer engagement.</p>
          <ul className="mt-3 space-y-3 text-sm">
            <FollowupRow name="Adekunle Family" when="Best time to reach: Sat 10 AM" auto />
            <FollowupRow name="Idris Balogun" when="Send gentle nudge tomorrow at 4 PM" auto />
            <FollowupRow name="Zara Okonkwo" when="Waiting on signed contract — check-in Fri" />
          </ul>
        </div>
      </div>
    </div>
  );
}

function ContractRow({ name, amount, status, tone }: { name: string; amount: string; status: string; tone: string }) {
  return (
    <li className="flex items-center justify-between py-3">
      <div>
        <p className="font-medium">{name}</p>
        <p className={`text-xs ${tone}`}>{status}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{amount}</span>
        <Button size="sm" variant="outline"><MailCheck className="mr-2 h-4 w-4" /> Nudge</Button>
      </div>
    </li>
  );
}

function FollowupRow({ name, when, auto }: { name: string; when: string; auto?: boolean }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
      <Clock className="mt-0.5 h-4 w-4 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{when}</p>
      </div>
      {auto ? (
        <Badge className="bg-emerald-500/10 text-emerald-700">Auto</Badge>
      ) : (
        <Badge variant="secondary">Manual</Badge>
      )}
    </li>
  );
}

// ---------------- Coach ----------------

function CoachView() {
  const insights = [
    { label: "Response time", value: "14 min", trend: "▲ 3× faster than last week", tone: "text-emerald-600" },
    { label: "Quote → booking", value: "38%", trend: "▲ +6% MoM", tone: "text-emerald-600" },
    { label: "Revenue (30d)", value: "$42.9k", trend: "▲ +18%", tone: "text-emerald-600" },
    { label: "Repeat customers", value: "22%", trend: "▲ +4%", tone: "text-emerald-600" },
  ];
  const recs = [
    "Your Luxe package converts 41% when guests > 150. Feature it first in weddings ≥ 150.",
    "You raise prices 6% below market for Saturdays in October. Consider a $180 uplift.",
    "Adding one more portfolio photo of dessert tables lifts inquiries by ~12% (community benchmark).",
    "You have 3 open Fridays in March — enable Instant Quote™ auto-hold to fill them.",
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {insights.map((i) => (
            <div key={i.label} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{i.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{i.value}</p>
              <p className={`text-xs ${i.tone}`}>{i.trend}</p>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
            <Bot className="h-3.5 w-3.5" /> This week's coaching
          </div>
          <ul className="space-y-3 text-sm">
            {recs.map((r) => (
              <li key={r} className="flex gap-2 rounded-xl border border-border bg-background p-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="rounded-3xl border border-border bg-hero-radial p-5">
        <h3 className="font-display text-lg font-semibold">Ask your coach</h3>
        <p className="text-sm text-muted-foreground">Get plain-language advice on pricing, marketing, or a specific lead.</p>
        <Textarea placeholder="e.g. Should I raise my Saturday minimum for December?" className="mt-3 min-h-[120px]" />
        <Button variant="hero" className="mt-3"><Sparkles className="mr-2 h-4 w-4" /> Ask BridgePilot™</Button>
      </div>
    </div>
  );
}

// ---------------- Rules ----------------

function RulesView() {
  const [rules, setRules] = useState({
    minPackage: 4500,
    radius: 60,
    depositPct: 30,
    travelFee: 1.5,
    discountMax: 10,
    autoSend: false,
    autoFollowup: true,
    weekendsOnly: false,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border border-border bg-card p-5 space-y-5">
        <h3 className="font-display text-lg font-semibold">Pricing & availability</h3>
        <RuleSlider label="Minimum package" value={rules.minPackage} min={1000} max={20000} step={250} format={(v) => `$${v.toLocaleString()}`} onChange={(v) => setRules({ ...rules, minPackage: v })} />
        <RuleSlider label="Service radius" value={rules.radius} min={5} max={300} step={5} format={(v) => `${v} mi`} onChange={(v) => setRules({ ...rules, radius: v })} />
        <RuleSlider label="Deposit required" value={rules.depositPct} min={0} max={50} step={5} format={(v) => `${v}%`} onChange={(v) => setRules({ ...rules, depositPct: v })} />
        <RuleSlider label="Travel fee per mile" value={rules.travelFee} min={0} max={5} step={0.25} format={(v) => `$${v.toFixed(2)}`} onChange={(v) => setRules({ ...rules, travelFee: v })} />
        <RuleSlider label="Max discount AI can offer" value={rules.discountMax} min={0} max={30} step={1} format={(v) => `${v}%`} onChange={(v) => setRules({ ...rules, discountMax: v })} />
      </div>
      <div className="rounded-3xl border border-border bg-card p-5 space-y-5">
        <h3 className="font-display text-lg font-semibold">Automation</h3>
        <RuleToggle label="Auto-send AI replies without approval" hint="We recommend leaving this off until you trust the tone." checked={rules.autoSend} onChange={(v) => setRules({ ...rules, autoSend: v })} />
        <RuleToggle label="Automatic AI follow-ups" hint="Nudge quiet leads at the best time to reach them." checked={rules.autoFollowup} onChange={(v) => setRules({ ...rules, autoFollowup: v })} />
        <RuleToggle label="Only accept weekend events" hint="AI will politely decline weekday inquiries." checked={rules.weekendsOnly} onChange={(v) => setRules({ ...rules, weekendsOnly: v })} />
        <Separator />
        <div>
          <Label>Business hours</Label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Input defaultValue="9:00 AM" />
            <Input defaultValue="6:30 PM" />
          </div>
        </div>
        <Button variant="hero"><Check className="mr-2 h-4 w-4" /> Save business rules</Button>
      </div>
    </div>
  );
}

function RuleSlider({ label, value, min, max, step, format, onChange }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-sm font-semibold">{format(value)}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function RuleToggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ---------------- BridgeScore ----------------

function ScoreView() {
  const components = [
    { label: "Response speed", value: 96 },
    { label: "Booking conversion", value: 82 },
    { label: "Customer satisfaction", value: 94 },
    { label: "Profile completeness", value: 88 },
    { label: "Reliability", value: 97 },
    { label: "Repeat bookings", value: 71 },
    { label: "AI optimization usage", value: 84 },
  ];
  const total = Math.round(components.reduce((s, c) => s + c.value, 0) / components.length);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-background to-gold/10 p-6 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">BridgeScore™</p>
        <p className="mt-2 font-display text-6xl font-semibold text-gradient">{total}</p>
        <p className="text-sm text-muted-foreground">Top 8% of vendors in your category</p>
        <div className="mt-4 flex items-center justify-center gap-1 text-gold">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className="h-5 w-5 fill-current" />
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Higher scores earn priority placement in the MelaBridge marketplace and unlock BridgePilot Pro features.
        </p>
      </div>
      <div className="space-y-3">
        {components.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{c.label}</p>
              <span className="text-sm font-semibold">{c.value}</span>
            </div>
            <Progress value={c.value} className="mt-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {c.value >= 90
                ? "Excellent — keep it up."
                : c.value >= 75
                ? "Solid. Small tweaks will push this higher."
                : "Growth opportunity — see coaching tab for next steps."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
