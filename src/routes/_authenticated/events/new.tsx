import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ArrowLeft, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { parseCurrency } from "@/lib/parse-currency";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapEventPlan } from "@/lib/event-bootstrap.functions";
import { isValidTimeInput, normalizeDateInput, normalizeTimeInput, trimOrNull } from "@/lib/event-input-normalization";

export const Route = createFileRoute("/_authenticated/events/new")({
  head: () => ({ meta: [{ title: "New event — MelaBridge" }] }),
  component: NewEventPage,
});

const EVENT_TYPES = [
  "Wedding", "Birthday", "Baby Shower", "Graduation", "Corporate Event",
  "Gala", "Festival", "Reunion", "Community Event", "School Event",
  "Fundraiser", "Private Celebration", "Bridal Shower", "Engagement Party",
  "Anniversary Celebration", "Retirement Party", "Holiday Party",
  "Fundraiser or Gala", "Conference or Networking Event", "School Event or Prom",
  "Quinceañera", "Dinner Party", "Other",
];

type Form = {
  name: string;
  type: string;
  customType: string;
  date: string;
  startTime: string;
  endTime: string;
  addressText: string; street: string; city: string; state: string; zip: string;
  lat: number | null; lng: number | null; placeId: string;
  guests: string;
  budget: string;
};

type Stage = "template" | "form" | "bootstrapping" | "done";
type TemplateGroup = "All" | "Celebrations" | "Milestones" | "Community & work";

const TEMPLATES: {
  key: string;
  eventType: string;
  label: string;
  tagline: string;
  tasks: string;
  budget: string;
  vendors: string;
  group: Exclude<TemplateGroup, "All">;
}[] = [
  {
    key: "wedding", eventType: "Wedding", label: "Wedding",
    tagline: "Full ceremony & reception plan",
    tasks: "40+ tasks", budget: "12 categories", vendors: "Venue, Catering, Photographer…",
    group: "Celebrations",
  },
  {
    key: "birthday", eventType: "Birthday", label: "Birthday Party",
    tagline: "Intimate or big-bash celebration",
    tasks: "20 tasks", budget: "8 categories", vendors: "Venue, Catering, Entertainment…",
    group: "Celebrations",
  },
  {
    key: "baby_shower", eventType: "Baby Shower", label: "Baby Shower",
    tagline: "Welcome-baby gathering",
    tasks: "16 tasks", budget: "6 categories", vendors: "Venue, Catering, Florist…",
    group: "Celebrations",
  },
  {
    key: "graduation", eventType: "Graduation", label: "Graduation Party",
    tagline: "Celebrate the milestone",
    tasks: "18 tasks", budget: "7 categories", vendors: "Venue, Catering, DJ…",
    group: "Milestones",
  },
  {
    key: "reunion", eventType: "Reunion", label: "Family Reunion",
    tagline: "Multi-family gathering plan",
    tasks: "18 tasks", budget: "7 categories", vendors: "Venue, Catering, Activities…",
    group: "Community & work",
  },
  {
    key: "corporate", eventType: "Corporate Event", label: "Corporate / Social",
    tagline: "Professional event template",
    tasks: "20 tasks", budget: "8 categories", vendors: "Venue, AV, Catering, Branding…",
    group: "Community & work",
  },
  {
    key: "bridal_shower", eventType: "Bridal Shower", label: "Bridal Shower",
    tagline: "Registry, brunch, games, and gifts",
    tasks: "16 tasks", budget: "9 categories", vendors: "Catering, Bakery, Decor…",
    group: "Celebrations",
  },
  {
    key: "engagement_party", eventType: "Engagement Party", label: "Engagement Party",
    tagline: "Toasts, portraits, and a joyful welcome",
    tasks: "14 tasks", budget: "9 categories", vendors: "Catering, Bartending, Photography…",
    group: "Celebrations",
  },
  {
    key: "anniversary", eventType: "Anniversary Celebration", label: "Anniversary Celebration",
    tagline: "Milestone memories, dinner, and tributes",
    tasks: "14 tasks", budget: "9 categories", vendors: "Venue, Catering, Photography…",
    group: "Milestones",
  },
  {
    key: "retirement_party", eventType: "Retirement Party", label: "Retirement Party",
    tagline: "Honor a career with stories and toasts",
    tasks: "14 tasks", budget: "9 categories", vendors: "Catering, AV, Photography…",
    group: "Milestones",
  },
  {
    key: "holiday_party", eventType: "Holiday Party", label: "Holiday Party",
    tagline: "Seasonal gathering with food, music, and gifts",
    tasks: "14 tasks", budget: "10 categories", vendors: "Catering, Decor, DJ…",
    group: "Celebrations",
  },
  {
    key: "fundraiser_gala", eventType: "Fundraiser or Gala", label: "Fundraiser or Gala",
    tagline: "Mission, sponsors, registration, and giving",
    tasks: "16 tasks", budget: "10 categories", vendors: "Venue, AV, Catering, Planner…",
    group: "Community & work",
  },
  {
    key: "conference", eventType: "Conference or Networking Event", label: "Conference or Networking Event",
    tagline: "Agenda, speakers, registration, and production",
    tasks: "15 tasks", budget: "10 categories", vendors: "Venue, AV, Catering, Planner…",
    group: "Community & work",
  },
  {
    key: "school_prom", eventType: "School Event or Prom", label: "School Event or Prom",
    tagline: "Tickets, chaperones, safety, and celebration",
    tasks: "14 tasks", budget: "10 categories", vendors: "DJ, Security, Photo Booth…",
    group: "Community & work",
  },
  {
    key: "quinceanera", eventType: "Quinceañera", label: "Quinceañera",
    tagline: "Ceremony, court, dance, and family traditions",
    tasks: "17 tasks", budget: "11 categories", vendors: "Venue, DJ, Choreographer, Decor…",
    group: "Milestones",
  },
  {
    key: "dinner_party", eventType: "Dinner Party", label: "Dinner Party",
    tagline: "Menu, table setting, and a relaxed evening",
    tasks: "13 tasks", budget: "9 categories", vendors: "Catering, Rentals, Florist…",
    group: "Celebrations",
  },
  {
    key: "scratch", eventType: "", label: "Start from scratch",
    tagline: "Blank canvas — MelaAssist still fills in basics",
    tasks: "~10 tasks", budget: "4 categories", vendors: "Customized to your type",
    group: "Community & work",
  },
];

function NewEventPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const bootstrap = useServerFn(bootstrapEventPlan);
  const [stage, setStage] = useState<Stage>("template");
  const [templateGroup, setTemplateGroup] = useState<TemplateGroup>("All");
  const [progress, setProgress] = useState<{ tasks: number; budget: number; runsheet: number; vendors: number }>({
    tasks: 0, budget: 0, runsheet: 0, vendors: 0,
  });
  const [f, setF] = useState<Form>({
    name: "", type: "Wedding", customType: "", date: "", startTime: "", endTime: "",
    addressText: "", street: "", city: "", state: "", zip: "", lat: null, lng: null, placeId: "",
    guests: "", budget: "",
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || stage !== "form") return;
    let eventId: string | null = null;
    try {
      const name = z.string().trim().min(1, "Event name is required").max(120).parse(f.name);
      const date = normalizeDateInput(f.date);
      const startTime = normalizeTimeInput(f.startTime);
      const endTime = normalizeTimeInput(f.endTime);
      const addressText = trimOrNull(f.addressText);
      if (!date) throw new Error("Choose an event date");
      z.string().date().parse(date);
      if (!startTime) throw new Error("Choose an event start time");
      if (!isValidTimeInput(startTime)) throw new Error("Enter a valid event start time");
      if (endTime && !isValidTimeInput(endTime)) throw new Error("Enter a valid event end time");
      if (!addressText) throw new Error("Add an event location");
      const eventType = f.type === "Other" ? (f.customType.trim() || "Other") : f.type.trim();
      if (startTime && endTime && endTime <= startTime) {
        throw new Error("Event end time must be after the start time");
      }
      const locationParts = [f.street, f.city, f.state].map((value) => trimOrNull(value)).filter(Boolean);
      const guestTarget = trimOrNull(f.guests);
      const budgetTarget = trimOrNull(f.budget);

      const { data, error } = await supabase.from("events").insert({
        owner_id: user.id,
        name,
        event_type: eventType,
        custom_event_type: f.type === "Other" ? f.customType.trim() || null : null,
        event_date: date,
        event_time: startTime,
        end_time: endTime,
        ceremony_start_time: startTime,
        location: addressText || locationParts.join(", ") || null,
        venue_street: trimOrNull(f.street),
        venue_city: trimOrNull(f.city),
        venue_state: trimOrNull(f.state),
        venue_zip: trimOrNull(f.zip),
        venue_lat: f.lat,
        venue_lng: f.lng,
        venue_place_id: trimOrNull(f.placeId),
        guest_target: guestTarget ? parseInt(guestTarget, 10) : null,
        budget_target: parseCurrency(budgetTarget ?? "") ?? null,
        status: "confirmed",
      }).select("id").single();
      if (error) throw error;
      eventId = data.id;
      setStage("bootstrapping");

      // Await bootstrap so the workspace is already populated on arrival.
      const r = (await bootstrap({ data: { event_id: eventId, only_if_empty: true } } as never)) as {
        tasksInserted?: number; budgetInserted?: number; runsheetInserted?: number; vendorNeedsInserted?: number;
      } | undefined;
      setProgress({
        tasks: r?.tasksInserted ?? 0,
        budget: r?.budgetInserted ?? 0,
        runsheet: r?.runsheetInserted ?? 0,
        vendors: r?.vendorNeedsInserted ?? 0,
      });
      setStage("done");
      toast.success("Your event workspace is ready");
      setTimeout(() => {
        navigate({ to: "/events/$eventId", params: { eventId: eventId! } });
      }, 900);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create event");
      if (eventId) {
        // Event exists but bootstrap failed — still route there so the user isn't stuck.
        navigate({ to: "/events/$eventId", params: { eventId } });
      } else {
        setStage("form");
      }
    }
  }

  if (stage === "template") {
    const visibleTemplates = templateGroup === "All"
      ? TEMPLATES
      : TEMPLATES.filter((template) => template.group === templateGroup);
    return (
      <AppShell active="/events">
        <div className="mx-auto max-w-3xl space-y-6 py-2">
          <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to events
          </Link>
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> New event
            </div>
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">Choose a starting template</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Templates seed your tasks, budget, vendors, and timeline — MelaAssist customizes everything to your event.
            </p>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Filter event templates">
            {(["All", "Celebrations", "Milestones", "Community & work"] as const).map((group) => (
              <Button
                key={group}
                type="button"
                size="sm"
                variant={templateGroup === group ? "default" : "outline"}
                onClick={() => setTemplateGroup(group)}
                aria-pressed={templateGroup === group}
              >
                {group}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleTemplates.map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                onClick={() => {
                  set("type", tpl.eventType || "Other");
                  if (!tpl.eventType) set("customType", "");
                  setStage("form");
                }}
                className="group rounded-2xl border border-border/60 bg-card p-5 text-left shadow-soft outline-none transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div className="mb-3 flex items-center gap-3">
                   <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 font-display text-lg text-primary">{String(tpl.label.charAt(0))}</span>
                  <div>
                    <p className="font-display font-semibold">{tpl.label}</p>
                    <p className="text-xs text-muted-foreground">{tpl.tagline}</p>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />{tpl.tasks}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />{tpl.budget}
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />{tpl.vendors}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (stage !== "form") {
    return (
      <AppShell active="/events">
        <div className="mx-auto max-w-xl space-y-6 py-10">
          <Card className="border-border/60 p-8 shadow-soft">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              MelaAssist is planning your event
            </div>
            <h1 className="font-display text-2xl font-semibold">
              {stage === "bootstrapping" ? "Building your workspace…" : "Workspace ready"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Generating tasks, budget, runsheet, and vendor recommendations tailored to your event.
            </p>
            <div className="mt-6 space-y-2.5">
              <ProgressLine label="Planning tasks" count={progress.tasks} done={stage === "done"} />
              <ProgressLine label="Budget categories" count={progress.budget} done={stage === "done"} />
              <ProgressLine label="Day-of runsheet" count={progress.runsheet} done={stage === "done"} />
              <ProgressLine label="Vendor recommendations" count={progress.vendors} done={stage === "done"} />
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="/events">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to events
        </Link>
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> New event
          </div>
          <h1 className="font-display text-3xl font-semibold">Tell MelaAssist about your event</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Answer a few questions. MelaAssist will build your tasks, budget, runsheet, and vendor plan automatically.
          </p>
        </div>

        <Link
          to="/events/ai-new"
          className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/8 via-primary/5 to-transparent p-3 text-sm shadow-soft transition-colors hover:border-primary/40"
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span><strong className="font-medium">Prefer to chat?</strong> Describe your event in plain language and MelaAssist drafts everything.</span>
          </span>
          <span className="text-xs font-medium text-primary">Try AI Builder →</span>
        </Link>

        <form onSubmit={submit} className="space-y-4">
          <Card className="border-primary/25 bg-card p-6 shadow-elegant space-y-4">
            <div className="border-b border-primary/15 pb-3">
              <p className="text-xs font-bold uppercase tracking-[.22em] text-primary">The essentials</p>
              <h2 className="mt-1 font-display text-2xl">When and where is it happening?</h2>
              <p className="mt-1 text-sm text-muted-foreground">These details shape your guest invitation, ticket page, and event-day plan.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Event name *</Label>
              <Input id="name" value={f.name} onChange={(e) => set("name", e.target.value)} required placeholder="e.g. Priya & Arjun Wedding" autoFocus />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Event type *</Label>
                <Select value={f.type} onValueChange={(v) => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {f.type === "Other" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="customType">Describe it</Label>
                  <Input id="customType" value={f.customType} onChange={(e) => set("customType", e.target.value)} placeholder="e.g. Product launch" />
                </div>
              ) : (
                <div className="space-y-1.5">
                   <Label htmlFor="date">Event date <span className="text-destructive">*</span></Label>
                   <Input id="date" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} required />
                </div>
              )}
              {f.type === "Other" && (
                <div className="space-y-1.5 sm:col-span-2">
                   <Label htmlFor="date2">Event date <span className="text-destructive">*</span></Label>
                   <Input id="date2" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} required />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
               <Label htmlFor="address">Event location <span className="text-destructive">*</span></Label>
              <AddressAutocomplete
                id="address"
                value={f.addressText}
                onChange={(v) => set("addressText", v)}
                onSelect={(d) => {
                  setF((prev) => ({
                    ...prev,
                    addressText: d.formatted || prev.addressText,
                    street: d.street, city: d.city, state: d.state, zip: d.zip,
                    lat: d.lat, lng: d.lng, placeId: d.placeId,
                  }));
                }}
                 placeholder="Venue, street, city, or address…"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                 <Label htmlFor="startTime">Event start time <span className="text-destructive">*</span></Label>
                <Input
                  id="startTime"
                  type="time"
                  value={f.startTime}
                  onChange={(e) => set("startTime", e.target.value)}
                   required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endTime">Event end time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={f.endTime}
                  onChange={(e) => set("endTime", e.target.value)}
                  min={f.startTime || undefined}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                MelaAssist uses these times to build your setup, vendor arrival, guest arrival, and event-day schedule.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="guests">Estimated guests</Label>
                <Input id="guests" type="number" min="0" value={f.guests} onChange={(e) => set("guests", e.target.value)} placeholder="e.g. 120" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget">Estimated budget <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input id="budget" type="text" inputMode="decimal" value={f.budget} onChange={(e) => set("budget", e.target.value)} placeholder="e.g. 25000" />
              </div>
            </div>
          </Card>

          <div className="sticky bottom-0 -mx-2 border-t border-border/60 bg-background/95 px-2 py-3 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                <Sparkles className="mr-1 inline h-3 w-3" />
                MelaAssist will draft everything you need — you can edit anything after.
              </p>
              <Button type="submit" size="lg" className="gap-2">
                <Sparkles className="h-4 w-4" /> Create with MelaAssist
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function ProgressLine({ label, count, done }: { label: string; count: number; done: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-3 py-2">
      <span className="text-sm">{label}</span>
      <span className="inline-flex items-center gap-2 text-sm">
        {done ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="font-medium">{count}</span>
          </>
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </span>
    </div>
  );
}
