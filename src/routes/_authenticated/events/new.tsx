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
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapEventPlan } from "@/lib/event-bootstrap.functions";

export const Route = createFileRoute("/_authenticated/events/new")({
  head: () => ({ meta: [{ title: "New event — MelaBridge" }] }),
  component: NewEventPage,
});

const EVENT_TYPES = [
  "Wedding", "Birthday", "Baby Shower", "Graduation", "Corporate Event",
  "Gala", "Festival", "Reunion", "Community Event", "School Event",
  "Fundraiser", "Private Celebration", "Other",
];

type Form = {
  name: string;
  type: string;
  customType: string;
  date: string;
  startTime: string;
  addressText: string; street: string; city: string; state: string; zip: string;
  lat: number | null; lng: number | null; placeId: string;
  guests: string;
  budget: string;
};

type Stage = "form" | "bootstrapping" | "done";

function NewEventPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const bootstrap = useServerFn(bootstrapEventPlan);
  const [stage, setStage] = useState<Stage>("form");
  const [progress, setProgress] = useState<{ tasks: number; budget: number; runsheet: number; vendors: number }>({
    tasks: 0, budget: 0, runsheet: 0, vendors: 0,
  });
  const [f, setF] = useState<Form>({
    name: "", type: "Wedding", customType: "", date: "", startTime: "",
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
      const eventType = f.type === "Other" ? (f.customType.trim() || "Other") : f.type;

      const { data, error } = await supabase.from("events").insert({
        owner_id: user.id,
        name,
        event_type: eventType,
        custom_event_type: f.type === "Other" ? f.customType.trim() || null : null,
        event_date: f.date || null,
        event_time: f.startTime || null,
        ceremony_start_time: f.startTime || null,
        location: f.addressText || [f.street, f.city, f.state].filter(Boolean).join(", ") || null,
        venue_street: f.street || null,
        venue_city: f.city || null,
        venue_state: f.state || null,
        venue_zip: f.zip || null,
        venue_lat: f.lat,
        venue_lng: f.lng,
        venue_place_id: f.placeId || null,
        guest_target: f.guests ? parseInt(f.guests, 10) : null,
        budget_target: f.budget ? Number(f.budget) : null,
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
          <Card className="border-border/60 p-6 shadow-soft space-y-4">
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
                  <Label htmlFor="date">Event date</Label>
                  <Input id="date" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
                </div>
              )}
              {f.type === "Other" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="date2">Event date</Label>
                  <Input id="date2" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Location</Label>
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
                placeholder="City, venue, or address…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="startTime">Ceremony / main event start time</Label>
              <Input
                id="startTime"
                type="time"
                value={f.startTime}
                onChange={(e) => set("startTime", e.target.value)}
                placeholder="18:00"
              />
              <p className="text-xs text-muted-foreground">
                MelaAssist schedules vendor arrival, setup, hair &amp; makeup, and guest arrival <em>before</em> this time.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="guests">Estimated guests</Label>
                <Input id="guests" type="number" min="0" value={f.guests} onChange={(e) => set("guests", e.target.value)} placeholder="e.g. 120" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget">Estimated budget <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input id="budget" type="number" min="0" step="100" value={f.budget} onChange={(e) => set("budget", e.target.value)} placeholder="e.g. 25000" />
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
