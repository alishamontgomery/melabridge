import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { format } from "date-fns";
import {
  Sparkles, ArrowRight, ArrowLeft, CalendarIcon, PartyPopper, Store,
  Check, Upload, Building2, Loader2, X, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapEventPlan } from "@/lib/event-bootstrap.functions";
import { seedSampleWorkspace } from "@/lib/sample-workspace.functions";
import { generateVendorProfileDraft } from "@/lib/vendor-ai.functions";
import { recheckVendorDemandForCurrentVendor } from "@/lib/vendor-sourcing.functions";
import { upsertVendorPackage } from "@/lib/vendor-packages.functions";
import { ProfileTypeChoices } from "@/components/profile-type-choices";
import {
  legacyToPublicProfileType,
  publicToLegacyProfileType,
  type PublicProfileType,
} from "@/lib/profile-types";
import { VENDOR_OFFER_CATEGORIES } from "@/lib/vendor-categories";

type AccountType = PublicProfileType;

const searchSchema = z.object({
  type: z.enum(["host", "planner", "vendor", "personal", "organization"]).optional(),
});

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome to MelaBridge" }] }),
  validateSearch: (search) => searchSchema.parse(search),
  component: OnboardingPage,
});

const EVENT_TYPES = [
  "Wedding", "Birthday", "Anniversary", "Graduation", "Baby Shower", "Bridal Shower",
  "Gender Reveal", "Reunion", "Holiday Party", "Corporate Event", "Conference", "Gala",
  "Fundraiser", "Festival", "Community Event", "School Event", "Vacation",
  "Sports Event", "Concert", "Other",
];

function OnboardingPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/onboarding" });
  const { user } = useAuth();
  const [accountType, setAccountType] = useState<AccountType | null>(
    search.type ? legacyToPublicProfileType(search.type) : null,
  );
  const [checked, setChecked] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    setLoadError(null);
    Promise.all([
      supabase.from("profiles").select("account_type, onboarding_completed").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]).then(([profileResult, rolesResult]) => {
      if (profileResult.error || rolesResult.error) {
        throw new Error("We couldn't load your account setup.");
      }
      const data = profileResult.data;
      const roles = rolesResult.data;
      if (data?.onboarding_completed) {
        const userRoles = (roles ?? []).map((r) => r.role as string);
        if (userRoles.includes("admin")) navigate({ to: "/admin" });
        else if (data.account_type === "vendor") navigate({ to: "/vendor" });
        else navigate({ to: "/dashboard" });
        return;
      }
      if (!accountType && data?.account_type) {
        setAccountType(legacyToPublicProfileType(data.account_type));
      }
      setChecked(true);
    }).catch((error) => {
      setLoadError(error instanceof Error ? error.message : "We couldn't load your account setup.");
      setChecked(true);
    });
  }, [user, navigate, accountType, loadAttempt]);

  if (!checked) {
    return (
      <div className="grid min-h-screen place-items-center bg-hero-radial">
        <Sparkles className="h-6 w-6 animate-pulse text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="grid min-h-screen place-items-center bg-hero-radial px-4">
        <Card className="w-full max-w-md space-y-4 p-6 text-center shadow-soft">
          <h1 className="font-display text-xl font-semibold">Account setup couldn&apos;t load</h1>
          <p className="text-sm text-muted-foreground">{loadError} Check your connection and try again.</p>
          <Button onClick={() => { setChecked(false); setLoadAttempt((value) => value + 1); }}>
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hero-radial px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <WelcomeHeader />
        {!accountType ? (
          <AccountTypePicker onSelect={setAccountType} />
        ) : accountType === "vendor" ? (
          <VendorFlow onBack={() => setAccountType(null)} />
        ) : (
          <PlannerFlow accountType={accountType} onBack={() => setAccountType(null)} />
        )}
      </div>
    </div>
  );
}

function WelcomeHeader() {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
        <Sparkles className="h-5 w-5" />
      </div>
      <h1 className="font-display text-3xl font-semibold">Welcome to MelaBridge</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Let's build your planning workspace in less than a minute.
      </p>
    </div>
  );
}

function MelaAssistCard() {
  return (
    <Card className="border-primary/30 bg-primary/5 p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="text-sm">
          <p className="font-medium">👋 Hi! I'm MelaAssist™.</p>
          <p className="mt-1 text-muted-foreground">
            I'll help organize every detail of your event—from the first idea to the final memory.
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            {[
              "Build planning timelines",
              "Recommend trusted vendors",
              "Create budgets",
              "Track RSVPs",
              "Coordinate guests",
              "Suggest themes and ideas",
              "Keep your event on schedule",
              "Remember everything so you don't have to",
            ].map((f) => (
              <li key={f} className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3 w-3 text-primary" /> {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function AccountTypePicker({ onSelect }: { onSelect: (t: AccountType) => void }) {
  return (
    <div className="space-y-4">
      <MelaAssistCard />
      <Card className="border-border/60 p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold">What brings you to MelaBridge?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose the experience that best matches how you plan to use MelaBridge.</p>
        <div className="mt-5">
          <ProfileTypeChoices value={null} onChange={onSelect} />
        </div>
      </Card>
    </div>
  );
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>Step {step} of {total}</span>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn("h-1.5 w-6 rounded-full", i < step ? "bg-primary" : "bg-muted")}
          />
        ))}
      </div>
    </div>
  );
}

function OptionalLabel({ children }: { children: React.ReactNode }) {
  return (
    <span>
      {children} <span className="text-muted-foreground">(optional)</span>
    </span>
  );
}

/* ============== PLANNER FLOW (Host + Planner) ============== */
function PlannerFlow({ accountType, onBack }: { accountType: "host" | "planner"; onBack: () => void }) {
  if (accountType === "host") {
    return <WelcomeDashboard onBack={onBack} />;
  }
  return <OrganizationFlow onBack={onBack} />;
}

function WelcomeDashboard({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const seedSample = useServerFn(seedSampleWorkspace);
  const [busy, setBusy] = useState<"create" | "sample" | "tour" | null>(null);

  async function markOnboarded() {
    if (!user) return;
    const { error } = await supabase.from("profiles").upsert(
        { id: user.id, email: user.email ?? "", account_type: publicToLegacyProfileType("host"), onboarding_completed: true },
      { onConflict: "id" },
    );
    if (error) throw error;
  }

  async function handleCreate() {
    setBusy("create");
    try {
      await markOnboarded();
      navigate({ to: "/events/new" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not finish account setup");
      setBusy(null);
    }
  }

  async function handleExploreSample(tour: boolean) {
    setBusy(tour ? "tour" : "sample");
    try {
      await markOnboarded();
      const res = (await seedSample()) as { ok: boolean; event_id?: string; error?: string };
      if (!res.ok) throw new Error(res.error);
      toast.success(tour ? "Starting your guided tour" : "Sample workspace ready to explore");
      if (res.event_id) {
        navigate({ to: "/events/$eventId", params: { eventId: res.event_id } });
      } else {
        navigate({ to: "/events" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load sample workspace");
      setBusy(null);
    }
  }

  const cards = [
    {
      key: "create" as const,
      icon: PartyPopper,
      title: "Create My First Event",
      description: "Start fresh — MelaAssist™ will help build your timeline, budget, and guest list.",
      cta: "Create event",
      variant: "hero" as const,
      onClick: handleCreate,
      badge: "Recommended",
    },
    {
      key: "sample" as const,
      icon: Sparkles,
      title: "Explore Sample Event",
      description: "Preview a fully-planned wedding workspace with realistic guests, budget, and tasks.",
      cta: "Explore sample",
      variant: "outline" as const,
      onClick: () => handleExploreSample(false),
      badge: "See it in action",
    },
    {
      key: "tour" as const,
      icon: ArrowRight,
      title: "Take a 2-Minute Tour",
      description: "Get a guided walkthrough of every planning tool, powered by MelaAssist™.",
      cta: "Start tour",
      variant: "ghost" as const,
      onClick: () => handleExploreSample(true),
    },
  ];

  return (
    <div className="space-y-5">
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-gold/5 p-6 shadow-soft">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">MelaAssist™</p>
            <p className="mt-1 text-sm">
              Welcome{user?.email ? `, ${user.email.split("@")[0]}` : ""}! I'll help you plan every detail — from
              the first idea to the last dance. Pick how you'd like to start below.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={c.onClick}
            disabled={busy !== null}
            className={cn(
              "group relative flex items-center gap-4 rounded-2xl border p-5 text-left transition",
              "hover:border-primary hover:bg-primary/5 hover:shadow-soft disabled:opacity-60",
              busy === c.key ? "border-primary bg-primary/10" : "border-border/60 bg-card",
            )}
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-gold/15 text-primary transition group-hover:from-primary group-hover:to-primary-glow group-hover:text-primary-foreground">
              <c.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-base font-semibold">{c.title}</p>
                {c.badge && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                    {c.badge}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={busy !== null}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <p className="text-xs text-muted-foreground">You can switch modes anytime in Settings.</p>
      </div>
    </div>
  );
}

function OrganizationFlow({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const bootstrap = useServerFn(bootstrapEventPlan);
  const [busy, setBusy] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState("Corporate Event");
  const [eventDate, setEventDate] = useState<Date | undefined>(undefined);
  const [dateUnknown, setDateUnknown] = useState(false);

  async function finish() {
    if (!user) return;
    if (!eventName.trim()) {
      toast.error("Enter an event name");
      return;
    }
    setBusy(true);
    try {
      const { error: profErr } = await supabase.from("profiles").upsert(
        { id: user.id, email: user.email ?? "", account_type: publicToLegacyProfileType("planner"), onboarding_completed: true },
        { onConflict: "id" },
      );
      if (profErr) throw profErr;

      const { data: created, error: evErr } = await supabase
        .from("events")
        .insert({
          owner_id: user.id,
          name: eventName.trim(),
          event_type: eventType,
          event_date: dateUnknown || !eventDate ? null : format(eventDate, "yyyy-MM-dd"),
        })
        .select("id")
        .single();
      if (evErr) throw evErr;

      try {
        await bootstrap({ data: { event_id: created.id, only_if_empty: true } } as never);
        toast.success("Your event and planning workspace are ready");
      } catch {
        toast.warning("Your event was created, but the starter plan could not be generated. You can retry from the event workspace.");
      }
      navigate({ to: "/events/$eventId", params: { eventId: created.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <MelaAssistCard />
      <Card className="border-border/60 p-6 shadow-soft">
        <StepIndicator step={1} total={1} />
        <div className="mt-4 space-y-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Tell MelaAssist™ about your event</h2>
            <p className="text-sm text-muted-foreground">
              Just the essentials — we'll gather everything else in conversation.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-name">Event name</Label>
            <Input
              id="ev-name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Q4 Company Summit"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Event type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label><OptionalLabel>Event date</OptionalLabel></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={dateUnknown}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !eventDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {eventDate ? format(eventDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={eventDate}
                  onSelect={setEventDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={dateUnknown}
                onCheckedChange={(v) => {
                  setDateUnknown(Boolean(v));
                  if (v) setEventDate(undefined);
                }}
              />
              I don't know yet
            </label>
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={onBack} disabled={busy}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
            </Button>
            <Button onClick={finish} disabled={busy || !eventName.trim()}>
              {busy ? "Setting up…" : "Next"} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}


/* ============== VENDOR FLOW ============== */
function VendorFlow({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const generateDraft = useServerFn(generateVendorProfileDraft);
  const recheckDemand = useServerFn(recheckVendorDemandForCurrentVendor);
  const createPackage = useServerFn(upsertVendorPackage);

  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Step 1
  const [businessName, setBusinessName] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [primaryCategory, setPrimaryCategory] = useState("");
  const [prompt, setPrompt] = useState("");

  // Step 2 — AI-generated, editable
  const [description, setDescription] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);
  const [pkgs, setPkgs] = useState<{ name: string; description: string; price_placeholder: string; inclusions: string[]; duration: string }[]>([]);

  // Step 2 — location & terms
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const canNext = categories.length > 0;

  async function runGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const trimmed = prompt.trim();
      const mode = trimmed.startsWith("http") ? "website"
        : trimmed.length > 0 ? "description"
        : "business_name";
      const input = trimmed.length > 0 ? trimmed : businessName.trim();
      const result = await generateDraft({ data: { mode, input, category: categories[0] } });
      if (result.draft) {
        const d = result.draft;
        setDescription(d.description || d.short_bio || "");
        setServices(d.services.slice(0, 6));
        setFaqs(d.faqs.slice(0, 4));
        setPkgs(
          d.packages.slice(0, 3).map((p) => ({
            name: p.name,
            description: p.description,
            price_placeholder: p.price_placeholder,
            inclusions: p.inclusions,
            duration: p.duration,
          }))
        );
      } else {
        setGenError(result.message ?? "MelaAssist couldn't generate a draft — fill in what you'd like below.");
      }
    } catch {
      setGenError("MelaAssist hit an error — you can still launch with your basics.");
    } finally {
      setGenerating(false);
    }
  }

  function handleNext() {
    setStep(2);
    runGenerate();
  }

  async function launch() {
    if (!user) return;
    if (!acceptTerms) { toast.error("Please accept the terms to continue"); return; }
    setBusy(true);
    try {
      const profileName = businessName.trim() || user.email?.split("@")[0] || "Event services";
      const servicesJson = services.length > 0
        ? JSON.stringify({ services, highlights: [] })
        : null;

      const { error: vpErr } = await supabase.from("vendor_profiles").upsert(
        {
          user_id: user.id,
          business_name: profileName,
          business_category: primaryCategory || categories[0] || "Other",
          business_categories: categories,
          business_description: description || null,
          city: city || null,
          state: stateVal || null,
           zip_code: zipCode.trim() || null,
          virtual_services: servicesJson,
          faqs: (faqs.length > 0 ? faqs : []) as never,
          accepted_terms: true,
           // Completing signup creates the private draft. Vendors publish
           // themselves later from the profile builder once the minimum
           // listing requirements are met.
           onboarding_completed: false,
        },
        { onConflict: "user_id" },
      );
      if (vpErr) throw vpErr;
      await recheckDemand({ data: undefined } as never);

      const { error: profErr } = await supabase.from("profiles").upsert(
        { id: user.id, email: user.email ?? "", account_type: "vendor", onboarding_completed: true, display_name: profileName },
        { onConflict: "id" },
      );
      if (profErr) throw profErr;

      // Create AI-suggested packages (non-blocking — failures are logged, not fatal)
      for (let i = 0; i < pkgs.length; i++) {
        const pkg = pkgs[i];
        try {
          await createPackage({
            data: {
              name: pkg.name,
              description: pkg.description,
              price_type: "contact" as const,
              price_cents: null,
              inclusions: pkg.inclusions,
              duration: pkg.duration || "",
              add_ons: [],
              is_featured: i === 0,
              sort_order: i,
              category_fields: {},
            },
          });
        } catch (pkgErr) {
          console.warn("[onboarding] package create failed:", pkgErr);
        }
      }

      toast.success("Your vendor workspace is ready!");
      navigate({ to: "/vendor" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5 p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <p className="font-medium">MelaAssist builds your profile — you just review it.</p>
            <p className="mt-0.5 text-muted-foreground">Takes about 60 seconds.</p>
          </div>
        </div>
      </Card>

      <Card className="border-border/60 p-6 shadow-soft">
        <StepIndicator step={step} total={2} />

        {/* ── STEP 1: the basics ── */}
        {step === 1 && (
          <div className="mt-4 space-y-5">
            <div>
              <h2 className="font-display text-lg font-semibold">About your business</h2>
              <p className="text-sm text-muted-foreground">Choose your services. Add your own name or a business name if you have one.</p>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="biz-name">Your name or business name <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="biz-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g., Alisha or Moments by Alisha"
                autoFocus
              />
            </div>

             <div className="space-y-2">
                <Label>What do you offer? <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground">
                  Select all that apply. One vendor profile can showcase multiple services. Choose one primary service.
                </p>
               <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto py-0.5">
                 {VENDOR_OFFER_CATEGORIES.map((cat) => {
                  const sel = categories.includes(cat);
                  return (
                     <div key={cat} className="flex items-center gap-0.5">
                       <button
                         type="button"
                         aria-pressed={sel}
                         onClick={() => {
                           setCategories((prev) => {
                             const next = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat];
                             setPrimaryCategory((current) =>
                               current === cat ? (next[0] ?? "") : current || next[0] || "",
                             );
                             return next;
                           });
                         }}
                         className={cn(
                           "px-3 py-1.5 rounded-full text-xs border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                           sel
                             ? "bg-primary text-primary-foreground border-primary"
                             : "bg-muted/40 text-foreground border-border hover:border-primary/60"
                         )}
                       >
                         {sel && "✓ "}{cat}
                       </button>
                       {sel && (
                         <button
                           type="button"
                           aria-label={`Set ${cat} as primary service`}
                           aria-pressed={primaryCategory === cat}
                           onClick={() => setPrimaryCategory(cat)}
                           className={cn(
                             "grid h-6 w-6 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                             primaryCategory === cat ? "text-amber-500" : "text-muted-foreground hover:text-amber-500",
                           )}
                         >
                           <Star className="h-3.5 w-3.5" fill={primaryCategory === cat ? "currentColor" : "none"} />
                         </button>
                       )}
                     </div>
                  );
                })}
              </div>
              {categories.length > 0 && (
                 <p className="text-xs font-medium text-primary">
                   {categories.length} selected · Primary: {primaryCategory || categories[0]}
                 </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="biz-prompt">
                Website or description{" "}
                <span className="text-xs font-normal text-muted-foreground">(optional — helps MelaAssist do more)</span>
              </Label>
              <Textarea
                id="biz-prompt"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Paste your website URL, or describe your business in a few sentences…"
              />
            </div>

            <div className="flex justify-between gap-2 pt-1">
              <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNext} disabled={!canNext}>
                <Sparkles className="mr-1.5 h-4 w-4" /> Build my profile
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: review AI draft + location + terms ── */}
        {step === 2 && (
          <div className="mt-4 space-y-5">
            <div>
              <h2 className="font-display text-lg font-semibold">Review your profile</h2>
              <p className="text-sm text-muted-foreground">
                MelaAssist drafted everything — edit anything you'd like to change.
              </p>
            </div>

            {/* Loading state */}
            {generating && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
                <p className="text-sm font-medium">MelaAssist is building your profile…</p>
                <p className="text-xs text-muted-foreground">Writing your bio, services, FAQs, and package suggestions</p>
              </div>
            )}

            {/* Soft error banner */}
            {!generating && genError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {genError}
              </div>
            )}

            {/* Editable draft cards */}
            {!generating && (
              <>
                {/* Description */}
                <div className="space-y-1.5">
                  <Label>Business description</Label>
                  <Textarea
                    aria-label="Business description"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell planners what makes your business unique…"
                  />
                </div>

                {/* Services */}
                {services.length > 0 && (
                  <div className="space-y-2">
                    <Label>Services</Label>
                    <div className="space-y-1.5">
                      {services.map((svc, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            aria-label={`Service ${i + 1}`}
                            value={svc}
                            onChange={(e) =>
                              setServices((prev) => prev.map((s, idx) => (idx === i ? e.target.value : s)))
                            }
                            className="text-sm"
                          />
                          <button
                            type="button"
                            aria-label={`Remove service ${i + 1}`}
                            onClick={() => setServices((prev) => prev.filter((_, idx) => idx !== i))}
                            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FAQs */}
                {faqs.length > 0 && (
                  <div className="space-y-3">
                    <Label>FAQs</Label>
                    {faqs.map((faq, i) => (
                      <div key={i} className="rounded-lg border border-border/60 p-3 space-y-2">
                        <Input
                          aria-label={`FAQ question ${i + 1}`}
                          value={faq.question}
                          onChange={(e) =>
                            setFaqs((prev) => prev.map((f, idx) => (idx === i ? { ...f, question: e.target.value } : f)))
                          }
                          className="text-sm font-medium"
                          placeholder="Question"
                        />
                        <Textarea
                          aria-label={`FAQ answer ${i + 1}`}
                          rows={2}
                          value={faq.answer}
                          onChange={(e) =>
                            setFaqs((prev) => prev.map((f, idx) => (idx === i ? { ...f, answer: e.target.value } : f)))
                          }
                          className="text-sm"
                          placeholder="Answer"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Package suggestions */}
                {pkgs.length > 0 && (
                  <div className="space-y-3">
                    <div>
                      <Label>Package suggestions</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Prices are placeholders — set them after you launch.
                      </p>
                    </div>
                    {pkgs.map((pkg, i) => (
                      <div key={i} className="rounded-lg border border-border/60 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            aria-label={`Package name ${i + 1}`}
                            value={pkg.name}
                            onChange={(e) =>
                              setPkgs((prev) => prev.map((p, idx) => (idx === i ? { ...p, name: e.target.value } : p)))
                            }
                            className="text-sm font-medium"
                            placeholder="Package name"
                          />
                          <button
                            type="button"
                            aria-label={`Remove package ${i + 1}`}
                            onClick={() => setPkgs((prev) => prev.filter((_, idx) => idx !== i))}
                            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <Textarea
                          aria-label={`Package description ${i + 1}`}
                          rows={2}
                          value={pkg.description}
                          onChange={(e) =>
                            setPkgs((prev) => prev.map((p, idx) => (idx === i ? { ...p, description: e.target.value } : p)))
                          }
                          className="text-sm"
                          placeholder="What's included"
                        />
                        <p className="text-xs text-muted-foreground">
                          {pkg.price_placeholder || "Price TBD"}
                          {pkg.duration ? ` · ${pkg.duration}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Location */}
                <div className="space-y-1.5">
                  <Label>Where are you based? <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                   <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                     <Input aria-label="Business city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
                     <Input aria-label="Business state" value={stateVal} onChange={(e) => setStateVal(e.target.value)} placeholder="State" maxLength={2} />
                     <Input aria-label="Business ZIP code" value={zipCode} onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="ZIP code" inputMode="numeric" maxLength={5} />
                  </div>
                </div>

                {/* Terms */}
                <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm cursor-pointer">
                  <Checkbox checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(Boolean(v))} className="mt-0.5" />
                  <span>I accept MelaBridge's vendor terms of service and marketplace guidelines.</span>
                </label>

                <div className="flex justify-between gap-2 pt-1">
                  <Button variant="ghost" onClick={() => setStep(1)} disabled={busy}>
                    <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                  </Button>
                  <Button onClick={launch} disabled={busy || !acceptTerms}>
                    {busy ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Launching…</>
                    ) : (
                      <><Check className="mr-2 h-4 w-4" /> Launch my profile</>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

/* Guest flow removed — guests only join via invitation links, not through onboarding. */

// Silence unused import lint when useMemo is not used later.
void useMemo;
