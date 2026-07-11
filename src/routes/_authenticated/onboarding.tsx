import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome to MelaBridge" }] }),
  component: OnboardingPage,
});

const ROLES = [
  { value: "host", label: "Host" },
  { value: "planner", label: "Planner" },
  { value: "vendor", label: "Vendor" },
  { value: "team", label: "Team member" },
];

const EVENT_TYPES = [
  "Wedding", "Birthday", "Reunion", "Baby Shower", "Corporate",
  "Conference", "Fundraiser", "Vacation", "Funeral", "Other",
];

const PRIORITY_OPTIONS = [
  "Guest experience", "Stay on budget", "Simplify vendor management",
  "Timeline clarity", "Beautiful invitations", "Photos and memories",
];

function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Step 1 — you
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("host");

  // Step 2 — event
  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState("Wedding");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [guestTarget, setGuestTarget] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");

  // Step 3 — priorities
  const [priorities, setPriorities] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, primary_role, onboarding_completed").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.display_name) setDisplayName(data.display_name);
      if (data?.primary_role) setRole(data.primary_role);
      if (data?.onboarding_completed) navigate({ to: "/events" });
    });
  }, [user, navigate]);

  const pct = Math.round(((step + 1) / 3) * 100);

  function togglePriority(p: string) {
    setPriorities((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleFinish(skipEvent = false) {
    if (!user) return;
    setBusy(true);
    try {
      const name = z.string().trim().min(1, "Enter your name").max(80).parse(displayName);

      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          display_name: name,
          primary_role: role,
          planning_priorities: priorities,
          onboarding_completed: true,
        })
        .eq("id", user.id);
      if (profErr) throw profErr;

      if (skipEvent || !eventName.trim()) {
        toast.success("Profile saved");
        navigate({ to: "/events" });
        return;
      }

      const evName = z.string().trim().min(1, "Enter an event name").max(120).parse(eventName);
      const evDate = eventDate ? eventDate : null;
      const evBudget = budget ? Number(budget) : null;
      const evGuests = guestTarget ? parseInt(guestTarget, 10) : null;

      const { data: created, error: evErr } = await supabase
        .from("events")
        .insert({
          owner_id: user.id,
          name: evName,
          event_type: eventType,
          description: description || null,
          event_date: evDate,
          location: location || null,
          budget_target: evBudget,
          guest_target: evGuests,
        })
        .select("id")
        .single();
      if (evErr) throw evErr;

      toast.success("Your first event is ready");
      navigate({ to: "/events/$eventId", params: { eventId: created.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-hero-radial px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="font-display text-2xl font-semibold">Welcome to MelaBridge</h1>
          <p className="mt-1 text-sm text-muted-foreground">A calm setup in three quick steps.</p>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Step {step + 1} of 3</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} />
        </div>

        <Card className="border-border/60 p-6 shadow-soft">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Tell us about you</h2>
                <p className="text-sm text-muted-foreground">We'll personalize your workspace.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="space-y-1.5">
                <Label>Your role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button onClick={() => setStep(1)} disabled={!displayName.trim()}>
                  Continue <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Your first event</h2>
                <p className="text-sm text-muted-foreground">Just the basics — you can edit everything later. Skip if you're just exploring.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-name">Event name</Label>
                <Input id="ev-name" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Johnson Family Reunion" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-date">Date</Label>
                  <Input id="ev-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-loc">Location</Label>
                <Input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Birmingham, AL" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ev-guests">Est. guests</Label>
                  <Input id="ev-guests" type="number" min="0" value={guestTarget} onChange={(e) => setGuestTarget(e.target.value)} placeholder="150" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-budget">Est. budget ($)</Label>
                  <Input id="ev-budget" type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="12000" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-desc">Vision (optional)</Label>
                <Textarea id="ev-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A weekend reunion celebrating 20 years..." />
              </div>
              <div className="flex justify-between gap-2 pt-2">
                <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleFinish(true)} disabled={busy}>Skip</Button>
                  <Button onClick={() => setStep(2)} disabled={!eventName.trim()}>Continue <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">What matters most?</h2>
                <p className="text-sm text-muted-foreground">Pick any that apply — we'll shape suggestions around them.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => togglePriority(p)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      priorities.includes(p)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-accent"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {priorities.length > 0 && (
                <Badge variant="secondary">{priorities.length} selected</Badge>
              )}
              <div className="flex justify-between gap-2 pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => handleFinish(false)} disabled={busy}>
                  {busy ? "Setting up…" : "Finish setup"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
