import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Calendar,
  MapPin,
  Users,
  Palette,
  Wallet,
  Brain,
  ClipboardList,
  Heart,
  Upload,
  ShieldCheck,
  ChevronRight,
  PartyPopper,
  Loader2,
  FileText,
  Download,
  Edit3,
} from "lucide-react";

export const Route = createFileRoute("/new-event")({
  head: () => ({
    meta: [
      { title: "Create your event — MelaBridge Smart Wizard" },
      { name: "description", content: "AI-guided event creation. Build your entire plan in minutes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WizardPage,
});

// ---------------- Types & constants ----------------

type EventType =
  | "Wedding"
  | "Birthday"
  | "Baby Shower"
  | "Bridal Shower"
  | "Family Reunion"
  | "Funeral"
  | "Corporate Event"
  | "Conference"
  | "Graduation"
  | "Anniversary"
  | "Vacation"
  | "School Event"
  | "Sports Event"
  | "Festival"
  | "Fundraiser"
  | "Community Event"
  | "Holiday Party"
  | "Custom";

const EVENT_TYPES: EventType[] = [
  "Wedding", "Birthday", "Baby Shower", "Bridal Shower", "Family Reunion",
  "Funeral", "Corporate Event", "Conference", "Graduation", "Anniversary",
  "Vacation", "School Event", "Sports Event", "Festival", "Fundraiser",
  "Community Event", "Holiday Party", "Custom",
];

const STYLES = [
  "Elegant", "Modern", "Rustic", "Luxury", "Casual",
  "Minimalist", "Glamorous", "Cultural", "Bohemian", "Playful",
];

const PALETTES = [
  { name: "Amethyst & Gold", colors: ["#5B2A86", "#8B5FBF", "#E8C56B", "#FBF7EE"] },
  { name: "Blush & Ivory", colors: ["#F5C6C6", "#E8A5A5", "#F5EDE3", "#8A6E5E"] },
  { name: "Forest & Cream", colors: ["#2F4A3A", "#6B8E6B", "#EDE6D3", "#B8934A"] },
  { name: "Midnight & Copper", colors: ["#1B2340", "#3A4A7A", "#C97B3B", "#F1E7D3"] },
  { name: "Coastal Sand", colors: ["#0E4A5C", "#5FA8B8", "#EFE1C4", "#D18E52"] },
  { name: "Bold & Modern", colors: ["#111111", "#F5F5F5", "#E63946", "#F1C40F"] },
];

const PRIORITIES = [
  "Venue", "Food & drink", "Photography", "Music & entertainment",
  "Décor & florals", "Guest experience", "Fashion & attire", "Travel",
];

const MUST_HAVES = [
  "Live music", "Photo booth", "Open bar", "Kids area", "Livestream",
  "Cultural rituals", "Signature cocktail", "Late-night snacks", "Fireworks",
  "Photographer", "Videographer", "DJ",
];

type WizardData = {
  step: number;
  // step 1
  name: string;
  type: EventType | "";
  date: string;
  time: string;
  timezone: string;
  locationMode: "physical" | "virtual" | "hybrid" | "";
  location: string;
  guestCount: number;
  // step 2
  purpose: string;
  feeling: string;
  style: string;
  palette: string;
  theme: string;
  inspiration: string[]; // filenames
  mustHaves: string[];
  niceToHaves: string;
  // step 3
  budget: number;
  flexibility: number; // 0..100 (rigid → flexible)
  topPriorities: string[];
  saveOn: string[];
  // conversational
  firstTime: "" | "yes" | "no";
  wantVendorSuggestions: "" | "yes" | "no";
  havePhotographer: "" | "yes" | "no";
  planStyle: "" | "luxury" | "balanced" | "budget";
};

const EMPTY: WizardData = {
  step: 0,
  name: "",
  type: "",
  date: "",
  time: "18:00",
  timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
  locationMode: "",
  location: "",
  guestCount: 80,
  purpose: "",
  feeling: "",
  style: "",
  palette: PALETTES[0].name,
  theme: "",
  inspiration: [],
  mustHaves: [],
  niceToHaves: "",
  budget: 15000,
  flexibility: 40,
  topPriorities: [],
  saveOn: [],
  firstTime: "",
  wantVendorSuggestions: "",
  havePhotographer: "",
  planStyle: "",
};

const STORAGE_KEY = "melabridge:new-event:v1";

const STEPS = [
  { key: "basics", label: "Event basics", icon: Calendar },
  { key: "vision", label: "Vision", icon: Palette },
  { key: "budget", label: "Budget", icon: Wallet },
  { key: "planning", label: "AI planning", icon: Brain },
  { key: "blueprint", label: "Blueprint", icon: FileText },
];

// ---------------- Component ----------------

function WizardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<WizardData>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setData({ ...EMPTY, ...JSON.parse(raw) });
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // Autosave
  useEffect(() => {
    if (!hydrated) return;
    setSaved("saving");
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
      setSaved("saved");
    }, 400);
    return () => clearTimeout(t);
  }, [data, hydrated]);

  const update = <K extends keyof WizardData>(key: K, value: WizardData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const toggle = (key: "mustHaves" | "topPriorities" | "saveOn", value: string) =>
    setData((d) => {
      const set = new Set(d[key]);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...d, [key]: Array.from(set) };
    });

  const step = data.step;
  const canNext = useMemo(() => {
    if (step === 0) return !!(data.name && data.type && data.date && data.locationMode);
    if (step === 1) return !!(data.purpose && data.style);
    if (step === 2) return data.budget > 0;
    return true;
  }, [step, data]);

  const goTo = (n: number) => setData((d) => ({ ...d, step: Math.max(0, Math.min(STEPS.length - 1, n)) }));

  const runAiPlanning = async () => {
    setGenerating(true);
    setGenerated(false);
    await new Promise((r) => setTimeout(r, 1400));
    setGenerating(false);
    setGenerated(true);
    goTo(4);
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-hero-radial">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold">MelaBridge</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {saved === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Autosaving…</>}
            {saved === "saved" && <><Check className="h-3 w-3 text-emerald-600" /> Saved</>}
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">Skip for now</Link>
            </Button>
          </div>
        </div>
        {/* Stepper */}
        <div className="mx-auto max-w-6xl px-6 pb-3">
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((s, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <button
                  key={s.key}
                  onClick={() => i <= step && goTo(i)}
                  disabled={i > step}
                  className={`flex flex-1 items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : done
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-background/70">
                    {done ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{i + 1}. {s.label}</span>
                </button>
              );
            })}
          </div>
          <Progress value={progress} className="mt-3 h-1" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* AI greeting */}
        <div className="mb-6 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-gold text-primary-foreground shadow-soft">
            <Brain className="h-5 w-5" />
          </span>
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-sm text-muted-foreground">MelaBridge Intelligence™</p>
            <p className="text-sm">{aiPromptForStep(step, data)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
          {step === 0 && <BasicsStep data={data} update={update} />}
          {step === 1 && <VisionStep data={data} update={update} toggle={toggle} />}
          {step === 2 && <BudgetStep data={data} update={update} toggle={toggle} />}
          {step === 3 && (
            <PlanningStep
              data={data}
              generating={generating}
              generated={generated}
              onGenerate={runAiPlanning}
              update={update}
            />
          )}
          {step === 4 && <BlueprintStep data={data} onOpenDashboard={() => navigate({ to: "/dashboard" })} />}
        </div>

        {/* Nav */}
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>

          {step < 3 && (
            <Button variant="hero" onClick={() => goTo(step + 1)} disabled={!canNext} className="gap-2">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {step === 3 && !generated && (
            <Button variant="hero" onClick={runAiPlanning} disabled={generating} className="gap-2">
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating plan…</> : <>Generate my plan <Sparkles className="h-4 w-4" /></>}
            </Button>
          )}
          {step === 3 && generated && (
            <Button variant="hero" onClick={() => goTo(4)} className="gap-2">
              View Blueprint <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {step === 4 && (
            <Button variant="hero" onClick={() => navigate({ to: "/dashboard" })} className="gap-2">
              Open workspace <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

// ---------------- Step components ----------------

function BasicsStep({ data, update }: { data: WizardData; update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void }) {
  return (
    <div className="space-y-6">
      <StepHeader icon={Calendar} title="Event basics" subtitle="Let's start with the essentials. You can change anything later." />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event name">
          <Input value={data.name} onChange={(e) => update("name", e.target.value)} placeholder="Amara & Julien's Wedding" />
        </Field>
        <Field label="Estimated guest count">
          <div className="flex items-center gap-3">
            <Slider value={[data.guestCount]} min={2} max={1000} step={2} onValueChange={([v]) => update("guestCount", v)} />
            <span className="w-16 text-right font-display text-lg">{data.guestCount}</span>
          </div>
        </Field>
      </div>

      <Field label="Event type">
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => update("type", t)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                data.type === t
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date">
          <Input type="date" value={data.date} onChange={(e) => update("date", e.target.value)} />
        </Field>
        <Field label="Time">
          <Input type="time" value={data.time} onChange={(e) => update("time", e.target.value)} />
        </Field>
        <Field label="Time zone">
          <Input value={data.timezone} onChange={(e) => update("timezone", e.target.value)} />
        </Field>
      </div>

      <Field label="Where is it?">
        <div className="mb-3 flex gap-2">
          {(["physical", "virtual", "hybrid"] as const).map((m) => (
            <button
              key={m}
              onClick={() => update("locationMode", m)}
              className={`rounded-full border px-3 py-1.5 text-sm capitalize transition ${
                data.locationMode === m
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={data.locationMode === "virtual" ? "Zoom / Meet / Teams link" : "City, venue or address"}
            value={data.location}
            onChange={(e) => update("location", e.target.value)}
          />
        </div>
      </Field>
    </div>
  );
}

function VisionStep({
  data, update, toggle,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
  toggle: (k: "mustHaves" | "topPriorities" | "saveOn", v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <StepHeader icon={Palette} title="Event vision" subtitle="The AI uses this to shape every recommendation — mood, vendors, invitations, and more." />

      <Field label="What's the purpose of this event?">
        <Textarea rows={3} value={data.purpose} onChange={(e) => update("purpose", e.target.value)} placeholder="A joyful celebration of our love, with our closest family from three continents." />
      </Field>

      <Field label="What feeling do you want guests to have?">
        <Textarea rows={2} value={data.feeling} onChange={(e) => update("feeling", e.target.value)} placeholder="Warm, unhurried, cinematic — like a long dinner with the people they love." />
      </Field>

      <Field label="Preferred style">
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <Chip key={s} active={data.style === s} onClick={() => update("style", s)}>{s}</Chip>
          ))}
        </div>
      </Field>

      <Field label="Color palette">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PALETTES.map((p) => {
            const active = data.palette === p.name;
            return (
              <button
                key={p.name}
                onClick={() => update("palette", p.name)}
                className={`rounded-2xl border p-3 text-left transition ${
                  active ? "border-primary/40 shadow-soft" : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex h-10 overflow-hidden rounded-lg">
                  {p.colors.map((c) => (
                    <span key={c} className="flex-1" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <p className="mt-2 text-sm font-medium">{p.name}</p>
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Theme (optional)">
          <Input value={data.theme} onChange={(e) => update("theme", e.target.value)} placeholder="Tuscan garden, art deco, coastal…" />
        </Field>
        <Field label="Inspiration photos">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-accent/40 px-4 py-6 text-sm text-muted-foreground hover:bg-accent">
            <Upload className="h-4 w-4" />
            {data.inspiration.length ? `${data.inspiration.length} file${data.inspiration.length > 1 ? "s" : ""} added` : "Upload inspiration (placeholder)"}
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => update("inspiration", Array.from(e.target.files ?? []).map((f) => f.name))}
            />
          </label>
        </Field>
      </div>

      <Field label="Must-have features">
        <div className="flex flex-wrap gap-2">
          {MUST_HAVES.map((m) => (
            <Chip key={m} active={data.mustHaves.includes(m)} onClick={() => toggle("mustHaves", m)}>{m}</Chip>
          ))}
        </div>
      </Field>

      <Field label="Nice-to-haves">
        <Textarea rows={2} value={data.niceToHaves} onChange={(e) => update("niceToHaves", e.target.value)} placeholder="A fireworks send-off, late-night espresso cart…" />
      </Field>
    </div>
  );
}

function BudgetStep({
  data, update, toggle,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
  toggle: (k: "mustHaves" | "topPriorities" | "saveOn", v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <StepHeader icon={Wallet} title="Budget" subtitle="Honest numbers make for a better plan. Nothing is shared outside your workspace." />

      <Field label="Total budget">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-2.5 text-muted-foreground">$</span>
            <Input
              type="number"
              min={0}
              className="pl-7 text-lg font-semibold"
              value={data.budget}
              onChange={(e) => update("budget", Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          <Badge className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
            ~${Math.round(data.budget / Math.max(1, data.guestCount)).toLocaleString()} / guest
          </Badge>
        </div>
      </Field>

      <Field label="How flexible is this budget?">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Firm</span>
          <Slider value={[data.flexibility]} min={0} max={100} step={5} onValueChange={([v]) => update("flexibility", v)} />
          <span className="text-xs text-muted-foreground">Flexible</span>
        </div>
      </Field>

      <Field label="Where do you want to invest the most?">
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <Chip key={p} active={data.topPriorities.includes(p)} onClick={() => toggle("topPriorities", p)}>{p}</Chip>
          ))}
        </div>
      </Field>

      <Field label="Where would you like to save?">
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <Chip key={p} active={data.saveOn.includes(p)} onClick={() => toggle("saveOn", p)}>{p}</Chip>
          ))}
        </div>
      </Field>

      <div className="rounded-2xl border border-border bg-accent/40 p-4">
        <p className="mb-3 text-sm font-medium">A few quick questions to tailor your plan:</p>
        <div className="space-y-3">
          <Radio
            label="Should I build a luxury plan or a budget-conscious plan?"
            value={data.planStyle}
            onChange={(v) => update("planStyle", v as WizardData["planStyle"])}
            options={[
              { v: "luxury", l: "Go all out" },
              { v: "balanced", l: "Balanced" },
              { v: "budget", l: "Budget-conscious" },
            ]}
          />
          <Radio
            label={`Is this your first time planning ${data.type ? `a ${data.type.toLowerCase()}` : "an event"}?`}
            value={data.firstTime}
            onChange={(v) => update("firstTime", v as WizardData["firstTime"])}
            options={[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }]}
          />
          <Radio
            label="Would you like me to suggest vendors based on your budget?"
            value={data.wantVendorSuggestions}
            onChange={(v) => update("wantVendorSuggestions", v as WizardData["wantVendorSuggestions"])}
            options={[{ v: "yes", l: "Yes please" }, { v: "no", l: "I've got vendors" }]}
          />
          <Radio
            label="Do you already have a photographer?"
            value={data.havePhotographer}
            onChange={(v) => update("havePhotographer", v as WizardData["havePhotographer"])}
            options={[{ v: "yes", l: "Yes" }, { v: "no", l: "Not yet" }]}
          />
        </div>
      </div>
    </div>
  );
}

function PlanningStep({
  data, generating, generated, onGenerate, update,
}: {
  data: WizardData;
  generating: boolean;
  generated: boolean;
  onGenerate: () => void;
  update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
}) {
  void update;
  const plan = derivePlan(data);
  return (
    <div className="space-y-6">
      <StepHeader icon={Brain} title="AI planning" subtitle="I'll turn everything you shared into a complete plan you can start using today." />

      {!generated && (
        <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
            {generating ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
          </div>
          <p className="mt-3 font-display text-xl">
            {generating ? "Building your plan…" : "Ready when you are."}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {generating
              ? "Drafting timeline, checklist, budget categories, vendor shortlist, and communication schedule."
              : "I'll generate your timeline, checklist, budget breakdown, milestones, vendor plan and more."}
          </p>
          {!generating && (
            <Button variant="hero" className="mt-5 gap-2" onClick={onGenerate}>
              <Sparkles className="h-4 w-4" /> Generate my plan
            </Button>
          )}
        </div>
      )}

      {generated && (
        <div className="grid gap-4 sm:grid-cols-2">
          <MiniCard icon={ClipboardList} title="Personalized timeline" body={`${plan.timeline.length} milestones from today to event day.`} />
          <MiniCard icon={Check} title="Smart checklist" body={`${plan.checklist.length} tasks, prioritized by impact.`} />
          <MiniCard icon={Wallet} title="Budget categories" body={`${plan.budgetCats.length} categories allocated within $${data.budget.toLocaleString()}.`} />
          <MiniCard icon={Users} title="Vendor plan" body={`${plan.vendors.length} vendor categories with suggested booking order.`} />
          <MiniCard icon={Heart} title="Guest comms" body={`${plan.communications.length}-touchpoint communication schedule.`} />
          <MiniCard icon={ShieldCheck} title="Risk assessment" body={`${plan.risks.length} risks tracked with mitigations.`} />
          <MiniCard icon={Sparkles} title="Event Health Score™" body={`Initial score: ${plan.healthScore} / 100.`} highlight />
          <MiniCard icon={PartyPopper} title="Payment schedule" body={`${plan.payments.length} payments across the runway.`} />
        </div>
      )}
    </div>
  );
}

function BlueprintStep({ data, onOpenDashboard }: { data: WizardData; onOpenDashboard: () => void }) {
  const plan = derivePlan(data);
  return (
    <div className="space-y-6">
      <StepHeader
        icon={FileText}
        title="AI Event Blueprint™"
        subtitle="Your master plan. Editable, and continuously updated as your event evolves."
        aside={
          <div className="flex gap-2">
            <Button variant="soft" size="sm" className="gap-2"><Edit3 className="h-3.5 w-3.5" /> Edit</Button>
            <Button variant="soft" size="sm" className="gap-2"><Download className="h-3.5 w-3.5" /> Export PDF</Button>
          </div>
        }
      />

      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.05] via-background to-gold/[0.05] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Blueprint</p>
            <h2 className="font-display text-2xl font-semibold">{data.name || "Your event"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.type || "Custom"} · {data.date || "TBD"} · {data.location || "Location TBD"} · {data.guestCount} guests
            </p>
          </div>
          <Badge className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">Health {plan.healthScore}/100</Badge>
        </div>
      </div>

      <Blueprint section="Executive summary">
        <p>
          A <strong>{(data.style || "beautifully considered").toLowerCase()}</strong> {data.type?.toLowerCase() || "event"} for{" "}
          <strong>{data.guestCount}</strong> guests on <strong>{data.date || "a date TBD"}</strong> in{" "}
          <strong>{data.location || "a location TBD"}</strong>. Budget of <strong>${data.budget.toLocaleString()}</strong>{" "}
          (~${Math.round(data.budget / Math.max(1, data.guestCount))} per guest), planned around a{" "}
          <strong>{data.palette}</strong> palette{data.theme ? ` and a ${data.theme.toLowerCase()} theme` : ""}.
        </p>
      </Blueprint>

      <Blueprint section="Event goals">
        <ul className="list-disc pl-5">
          <li>{data.purpose || "Create an unforgettable, personal celebration."}</li>
          <li>Leave guests feeling: {data.feeling || "cared for and delighted."}</li>
          {data.mustHaves.length > 0 && <li>Deliver on must-haves: {data.mustHaves.join(", ")}.</li>}
        </ul>
      </Blueprint>

      <Blueprint section="Timeline">
        <ol className="space-y-2">
          {plan.timeline.map((t) => (
            <li key={t.title} className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div>
                <p className="text-sm font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">{t.when}</p>
              </div>
            </li>
          ))}
        </ol>
      </Blueprint>

      <Blueprint section="Budget breakdown">
        <div className="grid gap-2 sm:grid-cols-2">
          {plan.budgetCats.map((c) => (
            <div key={c.name} className="flex items-center justify-between rounded-lg bg-accent/40 px-3 py-2 text-sm">
              <span>{c.name}</span>
              <span className="font-semibold">${c.amount.toLocaleString()} <span className="text-xs text-muted-foreground">({c.pct}%)</span></span>
            </div>
          ))}
        </div>
      </Blueprint>

      <Blueprint section="Guest strategy">
        <ul className="list-disc pl-5">
          <li>Target list: {data.guestCount} invitees with a 15% buffer for declines.</li>
          <li>Save-the-date {plan.communications[0]?.when.toLowerCase()}, formal invitation {plan.communications[1]?.when.toLowerCase()}.</li>
          <li>RSVP cutoff 3 weeks before the event with two automatic reminders.</li>
        </ul>
      </Blueprint>

      <Blueprint section="Vendor strategy">
        <div className="flex flex-wrap gap-2">
          {plan.vendors.map((v) => (
            <span key={v} className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs">{v}</span>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Suggested booking order prioritizes long-lead vendors first (venue, photographer, catering).
        </p>
      </Blueprint>

      <Blueprint section="Logistics plan">
        <ul className="list-disc pl-5">
          <li>Location mode: {data.locationMode || "TBD"}. {data.locationMode === "hybrid" ? "Virtual streaming station required." : ""}</li>
          <li>Time zone: {data.timezone}. Guest communications will localize automatically.</li>
          <li>On-day runsheet auto-generated 2 weeks out.</li>
        </ul>
      </Blueprint>

      <Blueprint section="Communication plan">
        <ol className="space-y-2">
          {plan.communications.map((c) => (
            <li key={c.title} className="flex items-start justify-between gap-3 text-sm">
              <span>{c.title}</span>
              <span className="text-muted-foreground">{c.when}</span>
            </li>
          ))}
        </ol>
      </Blueprint>

      <Blueprint section="Contingency plan">
        <ul className="list-disc pl-5">
          {plan.risks.map((r) => (
            <li key={r.risk}><strong>{r.risk}:</strong> {r.mitigation}</li>
          ))}
        </ul>
      </Blueprint>

      <Blueprint section="Success checklist">
        <ul className="space-y-2">
          {plan.checklist.slice(0, 6).map((c) => (
            <li key={c} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 text-primary" /> {c}
            </li>
          ))}
        </ul>
      </Blueprint>

      <Blueprint section="AI recommendations">
        <ul className="space-y-2 text-sm">
          {plan.recommendations.map((r) => (
            <li key={r} className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 text-primary" /> {r}
            </li>
          ))}
        </ul>
      </Blueprint>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Your workspace is ready with everything populated.</p>
        <Button variant="hero" className="gap-2" onClick={onOpenDashboard}>
          Open workspace <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------- Shared UI ----------------

function StepHeader({
  icon: Icon, title, subtitle, aside,
}: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {aside}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-2 block text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Radio({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              value === o.v ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniCard({
  icon: Icon, title, body, highlight,
}: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-primary/30 bg-gradient-to-br from-primary/[0.06] to-gold/[0.05]" : "border-border bg-card"}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Blueprint({ section, children }: { section: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">{section}</h3>
        <button className="inline-flex items-center gap-1 text-xs text-primary">
          <Edit3 className="h-3 w-3" /> Edit
        </button>
      </div>
      <div className="text-sm text-foreground/90 [&_strong]:text-foreground">{children}</div>
    </section>
  );
}

// ---------------- AI-ish helpers ----------------

function aiPromptForStep(step: number, d: WizardData) {
  if (step === 0) return "Hi, I'm your MelaBridge planner. Let's start with the basics — I'll ask like an experienced planner, not fill out a form.";
  if (step === 1) return `Beautiful. Now tell me the feeling you want for ${d.name || "your event"}. I'll shape every recommendation around it.`;
  if (step === 2) return "Money's the trickiest conversation. Be honest — I'll build a plan that respects it, and flag risks early.";
  if (step === 3) return `Perfect. I've got enough to build your full plan for ${d.name || "your event"} — timeline, checklist, vendors, budget, and comms.`;
  return "Here's your Event Blueprint™. Everything is editable, and I'll keep it updated as your event evolves.";
}

function derivePlan(d: WizardData) {
  const budget = Math.max(500, d.budget);
  // Weights, biased by priorities/save-on
  const base: Record<string, number> = {
    Venue: 30, Catering: 22, Photography: 10, "Music & entertainment": 8,
    "Décor & florals": 10, Attire: 6, Invitations: 3, Transport: 4, Contingency: 7,
  };
  const boosted = { ...base };
  d.topPriorities.forEach((p) => (boosted[p === "Food & drink" ? "Catering" : p === "Fashion & attire" ? "Attire" : p === "Travel" ? "Transport" : p] = (boosted[p] || 5) + 4));
  d.saveOn.forEach((p) => {
    const key = p === "Food & drink" ? "Catering" : p === "Fashion & attire" ? "Attire" : p === "Travel" ? "Transport" : p;
    boosted[key] = Math.max(2, (boosted[key] || 5) - 3);
  });
  const total = Object.values(boosted).reduce((a, b) => a + b, 0);
  const budgetCats = Object.entries(boosted).map(([name, w]) => ({
    name, pct: Math.round((w / total) * 100), amount: Math.round((w / total) * budget),
  }));

  const timeline = [
    { title: "Confirm date, budget, and guest list", when: "This week" },
    { title: "Book venue and long-lead vendors", when: "In 2 weeks" },
    { title: "Send save-the-dates", when: "10 weeks out" },
    { title: "Finalize menu, décor, and playlist", when: "8 weeks out" },
    { title: "Send formal invitations", when: "6 weeks out" },
    { title: "Collect RSVPs and finalize seating", when: "3 weeks out" },
    { title: "Confirm vendors and payments", when: "1 week out" },
    { title: "Event day runsheet & rehearsal", when: "Event week" },
  ];

  const checklist = [
    "Sign venue contract", "Book photographer", "Book caterer", "Order invitations",
    "Design ceremony/program", "Confirm music/entertainment", "Arrange transport & lodging",
    "Prepare guest welcome materials", "Finalize dietary & accessibility needs", "Rehearsal & runsheet",
  ];

  const vendors = ["Venue", "Catering", "Photography", "Videography", "Florals", "Music/DJ", "Officiant/Host", "Transport", "Rentals"];

  const communications = [
    { title: "Save the date", when: "10 weeks before" },
    { title: "Formal invitation", when: "6 weeks before" },
    { title: "RSVP reminder", when: "4 weeks before" },
    { title: "Logistics & directions", when: "1 week before" },
    { title: "Day-of welcome", when: "Event day" },
    { title: "Thank-you note", when: "1 week after" },
  ];

  const risks = [
    { risk: "Weather", mitigation: "Backup indoor plan and tent quote on file." },
    { risk: "Budget overrun on catering", mitigation: "Cap per-guest cost and pre-approve upgrades." },
    { risk: "Low RSVP rate", mitigation: "Two automated reminders and a personal nudge." },
    { risk: "Vendor no-show", mitigation: "Second-choice vendor per category shortlisted." },
  ];

  const payments = [
    { name: "Venue deposit", pct: 25 }, { name: "Catering deposit", pct: 20 },
    { name: "Photographer deposit", pct: 10 }, { name: "Florist deposit", pct: 10 },
    { name: "Final balance", pct: 35 },
  ];

  const recommendations = [
    d.planStyle === "luxury"
      ? "Given your luxury direction, prioritize a signature guest experience — welcome gifts, live music, and a private tasting."
      : d.planStyle === "budget"
      ? "Reallocate 4% from florals to guest experience — cocktail hour upgrades feel richer than extra centerpieces."
      : "You're on a balanced path. Front-load bookings for venue and photographer to lock the best rates.",
    d.havePhotographer === "no" ? "Shortlist 3 photographers this week — top talent books 9–12 months ahead." : "Share your photographer with MelaBridge to auto-sync the shot list.",
    d.wantVendorSuggestions === "yes" ? "I'll surface vendor matches within your budget in your workspace." : "I'll respect your vendor picks and coordinate around them.",
  ];

  // Simple initial health score
  let health = 70;
  if (d.date) health += 5;
  if (d.location) health += 5;
  if (d.budget > 0) health += 5;
  if (d.topPriorities.length) health += 3;
  if (d.mustHaves.length) health += 2;
  if (d.planStyle) health += 3;
  if (d.havePhotographer === "yes") health += 4;
  health = Math.min(97, health);

  return { budgetCats, timeline, checklist, vendors, communications, risks, payments, recommendations, healthScore: health };
}
