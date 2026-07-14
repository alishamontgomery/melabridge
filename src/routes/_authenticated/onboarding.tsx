import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { format } from "date-fns";
import {
  Sparkles, ArrowRight, ArrowLeft, CalendarIcon, PartyPopper, Store,
  Check, Upload, Building2,
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

type AccountType = "personal" | "organization" | "vendor";

const searchSchema = z.object({
  type: z.enum(["personal", "organization", "vendor"]).optional(),
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

const VENDOR_CATEGORIES = [
  "Venue", "Photographer", "Photo Booth", "DJ", "Caterer", "Florist", "Baker",
  "Event Planner", "Decor", "Rentals", "Bartender", "Hair Stylist", "Makeup Artist",
  "Transportation", "Videographer", "Officiant", "Entertainment", "Travel",
  "Security", "Cleaning", "Other",
];

function OnboardingPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/onboarding" });
  const { user } = useAuth();
  const [accountType, setAccountType] = useState<AccountType | null>(search.type ?? null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("account_type, onboarding_completed")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.onboarding_completed) {
          if (data.account_type === "vendor") navigate({ to: "/vendor" });
          else navigate({ to: "/events" });
          return;
        }
        if (!accountType && data?.account_type) {
          setAccountType(data.account_type as AccountType);
        }
        setChecked(true);
      });
  }, [user, navigate, accountType]);

  if (!checked) {
    return (
      <div className="grid min-h-screen place-items-center bg-hero-radial">
        <Sparkles className="h-6 w-6 animate-pulse text-primary" />
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
  const options: Array<{ type: AccountType; icon: typeof PartyPopper; title: string; sub: string }> = [
    { type: "personal", icon: PartyPopper, title: "Plan a Personal Event", sub: "Weddings, birthdays, celebrations — just me and my collaborators." },
    { type: "organization", icon: Building2, title: "Plan for an Organization", sub: "Company events, conferences, fundraisers — with a team." },
    { type: "vendor", icon: Store, title: "Join as a Vendor", sub: "I provide products or services for events." },
  ];
  return (
    <div className="space-y-4">
      <MelaAssistCard />
      <Card className="border-border/60 p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold">How will you use MelaBridge?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pick one — you can always add another role later.</p>
        <div className="mt-5 grid gap-3">
          {options.map(({ type, icon: Icon, title, sub }) => (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className="group flex items-center gap-4 rounded-xl border border-border p-4 text-left transition hover:border-primary hover:bg-primary/5"
            >
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </button>
          ))}
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

/* ============== PLANNER FLOW (Personal + Organization) ============== */
function PlannerFlow({ accountType, onBack }: { accountType: "personal" | "organization"; onBack: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const bootstrap = useServerFn(bootstrapEventPlan);
  const [busy, setBusy] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState("Wedding");
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
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ account_type: accountType, onboarding_completed: true })
        .eq("id", user.id);
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

      toast.success("Your event is ready — MelaAssist™ is drafting your plan");
      void bootstrap({ data: { event_id: created.id, only_if_empty: true } } as never).catch(() => {
        /* Silent on failure; user can regenerate from the workspace. */
      });
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
              placeholder="Johnson Family Reunion"
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
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  // step 1
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [website, setWebsite] = useState("");

  // step 2
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [travelRadius, setTravelRadius] = useState("");
  const [address, setAddress] = useState("");
  const [mobileService, setMobileService] = useState(false);
  const [virtualServices, setVirtualServices] = useState("");

  // step 3
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const canNext1 = businessName.trim().length > 0 && category.length > 0;

  async function finish() {
    if (!user) return;
    if (!acceptTerms) {
      toast.error("Please accept the terms to continue");
      return;
    }
    setBusy(true);
    try {
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ account_type: "vendor", onboarding_completed: true, display_name: businessName })
        .eq("id", user.id);
      if (profErr) throw profErr;

      const { error: vpErr } = await supabase.from("vendor_profiles").upsert(
        {
          user_id: user.id,
          business_name: businessName.trim(),
          business_category: category,
          business_description: description || null,
          phone: phone || null,
          email: email || null,
          website: website || null,
          city: city || null,
          state: stateVal || null,
          travel_radius: travelRadius ? Number(travelRadius) : null,
          business_address: address || null,
          mobile_service: mobileService,
          virtual_services: virtualServices || null,
          years_in_business: yearsInBusiness ? Number(yearsInBusiness) : null,
          starting_price: startingPrice ? Number(startingPrice) : null,
          business_hours: businessHours ? { note: businessHours } : null,
          social_links: socialLinks ? { note: socialLinks } : null,
          accepted_terms: true,
          onboarding_completed: true,
        },
        { onConflict: "user_id" },
      );
      if (vpErr) throw vpErr;

      toast.success("Your vendor workspace is ready");
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
            <Store className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <p className="font-medium">Let's build your professional business presence.</p>
            <p className="mt-1 text-muted-foreground">
              MelaAssist™ will help optimize your profile, respond to inquiries, and grow your bookings.
            </p>
          </div>
        </div>
      </Card>

      <Card className="border-border/60 p-6 shadow-soft">
        <StepIndicator step={step} total={3} />

        {step === 1 && (
          <div className="mt-4 space-y-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Business basics</h2>
              <p className="text-sm text-muted-foreground">Who you are and how to reach you.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-name">Business name</Label>
              <Input id="biz-name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Your business name" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Business category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {VENDOR_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-desc"><OptionalLabel>Business description</OptionalLabel></Label>
              <Textarea id="biz-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What you're known for..." />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="biz-phone">Phone number</Label>
                <Input id="biz-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-1234" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-email">Email</Label>
                <Input id="biz-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-web"><OptionalLabel>Website</OptionalLabel></Label>
              <Input id="biz-web" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
            </div>
            <div className="space-y-1.5">
              <Label><OptionalLabel>Upload logo</OptionalLabel></Label>
              <Button type="button" variant="outline" className="w-full" disabled>
                <Upload className="mr-2 h-4 w-4" /> Add after onboarding
              </Button>
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(2)} disabled={!canNext1}>
                Next <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Service area</h2>
              <p className="text-sm text-muted-foreground">Where you serve clients.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="biz-city">City</Label>
                <Input id="biz-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Birmingham" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-state">State</Label>
                <Input id="biz-state" value={stateVal} onChange={(e) => setStateVal(e.target.value)} placeholder="AL" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-radius">Travel radius (miles)</Label>
              <Input id="biz-radius" type="number" min="0" value={travelRadius} onChange={(e) => setTravelRadius(e.target.value)} placeholder="50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-addr"><OptionalLabel>Business address</OptionalLabel></Label>
              <Input id="biz-addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
            </div>
            <div className="space-y-2">
              <Label>Mobile service</Label>
              <RadioGroup value={mobileService ? "yes" : "no"} onValueChange={(v) => setMobileService(v === "yes")} className="flex gap-4">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="yes" /> Yes</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="no" /> No</label>
              </RadioGroup>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-virtual"><OptionalLabel>Virtual services</OptionalLabel></Label>
              <Input id="biz-virtual" value={virtualServices} onChange={(e) => setVirtualServices(e.target.value)} placeholder="Virtual consultations, remote planning..." />
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)}>Skip for now</Button>
                <Button onClick={() => setStep(3)}>Next <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-4 space-y-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Business profile</h2>
              <p className="text-sm text-muted-foreground">You can fill in more later — nothing here is required except accepting the terms.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="biz-years"><OptionalLabel>Years in business</OptionalLabel></Label>
                <Input id="biz-years" type="number" min="0" value={yearsInBusiness} onChange={(e) => setYearsInBusiness(e.target.value)} placeholder="5" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-price"><OptionalLabel>Starting price ($)</OptionalLabel></Label>
                <Input id="biz-price" type="number" min="0" value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} placeholder="500" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-hours"><OptionalLabel>Business hours</OptionalLabel></Label>
              <Input id="biz-hours" value={businessHours} onChange={(e) => setBusinessHours(e.target.value)} placeholder="Mon–Fri, 9am–6pm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-social"><OptionalLabel>Social media links</OptionalLabel></Label>
              <Input id="biz-social" value={socialLinks} onChange={(e) => setSocialLinks(e.target.value)} placeholder="instagram.com/yourbrand" />
            </div>
            <div className="space-y-1.5">
              <Label><OptionalLabel>Upload portfolio photos</OptionalLabel></Label>
              <Button type="button" variant="outline" className="w-full" disabled>
                <Upload className="mr-2 h-4 w-4" /> Add after onboarding
              </Button>
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
              <Checkbox checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(Boolean(v))} />
              <span>I accept MelaBridge's vendor terms of service and marketplace guidelines.</span>
            </label>
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep(2)} disabled={busy}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
              <Button onClick={finish} disabled={busy || !acceptTerms}>
                {busy ? "Setting up…" : "Finish setup"} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* Guest flow removed — guests only join via invitation links, not through onboarding. */

// Silence unused import lint when useMemo is not used later.
void useMemo;
