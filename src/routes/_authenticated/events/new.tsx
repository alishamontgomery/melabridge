import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AddressAutocomplete } from "@/components/address-autocomplete";

export const Route = createFileRoute("/_authenticated/events/new")({
  head: () => ({ meta: [{ title: "New event — MelaBridge" }] }),
  component: NewEventPage,
});

const EVENT_TYPES = [
  "Wedding", "Birthday", "Baby Shower", "Graduation", "Corporate Event",
  "Gala", "Festival", "Reunion", "Church Event", "School Event",
  "Fundraiser", "Celebration of Life", "Other",
];

const STATUSES = [
  { value: "inquiry", label: "Inquiry" },
  { value: "consultation_scheduled", label: "Consultation Scheduled" },
  { value: "quote_sent", label: "Quote Sent" },
  { value: "tentative", label: "Tentative" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const CONTACT_METHODS = ["Phone", "Email", "Text", "In-app"] as const;
const LEAD_SOURCES = ["Referral", "Instagram", "Google", "Website", "Repeat client", "Marketplace", "Other"] as const;
const PAYMENT_STATUSES = [
  { value: "unpaid", label: "Unpaid" },
  { value: "deposit_paid", label: "Deposit paid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid in full" },
] as const;

type Form = {
  name: string; type: string; customType: string;
  clientName: string; clientPhone: string; clientEmail: string; preferredContact: string; leadSource: string;
  addressText: string; street: string; city: string; state: string; zip: string;
  lat: number | null; lng: number | null; placeId: string;
  date: string; startTime: string; endTime: string; durationHours: string;
  expectedGuests: string;
  notes: string;
  status: (typeof STATUSES)[number]["value"];
  depositRequired: string; depositPaid: string; balanceDueDate: string; paymentStatus: string;
};

function NewEventPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Form>({
    name: "", type: "Wedding", customType: "",
    clientName: "", clientPhone: "", clientEmail: "", preferredContact: "Email", leadSource: "",
    addressText: "", street: "", city: "", state: "", zip: "", lat: null, lng: null, placeId: "",
    date: "", startTime: "", endTime: "", durationHours: "",
    expectedGuests: "",
    notes: "",
    status: "inquiry",
    depositRequired: "", depositPaid: "", balanceDueDate: "", paymentStatus: "unpaid",
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));

  // Auto-calc duration or end time
  const computed = useMemo(() => {
    if (!f.startTime) return { duration: "", endTime: f.endTime };
    if (f.endTime) {
      const [sh, sm] = f.startTime.split(":").map(Number);
      const [eh, em] = f.endTime.split(":").map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return { duration: `${h}h${m ? ` ${m}m` : ""}`, endTime: f.endTime };
    }
    if (f.durationHours) {
      const dur = parseFloat(f.durationHours);
      if (Number.isFinite(dur) && dur > 0) {
        const [sh, sm] = f.startTime.split(":").map(Number);
        const total = sh * 60 + sm + Math.round(dur * 60);
        const eh = Math.floor((total % (24 * 60)) / 60);
        const em = total % 60;
        const pad = (n: number) => String(n).padStart(2, "0");
        return { duration: `${dur}h`, endTime: `${pad(eh)}:${pad(em)}` };
      }
    }
    return { duration: "", endTime: "" };
  }, [f.startTime, f.endTime, f.durationHours]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    try {
      const name = z.string().trim().min(1, "Event name is required").max(120).parse(f.name);
      const eventType = f.type === "Other" ? (f.customType.trim() || "Other") : f.type;
      const endTime = f.endTime || computed.endTime || null;

      const { data, error } = await supabase.from("events").insert({
        owner_id: user.id,
        name,
        event_type: eventType,
        custom_event_type: f.type === "Other" ? f.customType.trim() || null : null,
        event_date: f.date || null,
        event_time: f.startTime || null,
        start_time: f.startTime || null,
        end_time: endTime,
        location: f.addressText || [f.street, f.city, f.state].filter(Boolean).join(", ") || null,
        venue_street: f.street || null,
        venue_city: f.city || null,
        venue_state: f.state || null,
        venue_zip: f.zip || null,
        venue_lat: f.lat,
        venue_lng: f.lng,
        venue_place_id: f.placeId || null,
        guest_target: f.expectedGuests ? parseInt(f.expectedGuests, 10) : null,
        event_notes: f.notes || null,
        description: f.notes || null,
        status: f.status,
        client_name: f.clientName || null,
        client_phone: f.clientPhone || null,
        client_email: f.clientEmail || null,
        preferred_contact: f.preferredContact || null,
        lead_source: f.leadSource || null,
        deposit_required: f.depositRequired ? Number(f.depositRequired) : null,
        deposit_paid: f.depositPaid ? Number(f.depositPaid) : 0,
        balance_due_date: f.balanceDueDate || null,
        payment_status: f.paymentStatus || "unpaid",
      }).select("id").single();
      if (error) throw error;
      toast.success("Event created");
      navigate({ to: "/events/$eventId", params: { eventId: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create event");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell active="/events">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to events
        </Link>
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> New event
          </div>
          <h1 className="font-display text-3xl font-semibold">Create an event</h1>
          <p className="mt-1 text-sm text-muted-foreground">You can edit anything later. Only the event name is required.</p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {/* 1. Event Information */}
          <Card className="border-border/60 p-6 shadow-soft space-y-4">
            <h2 className="font-display text-lg font-semibold">Event information</h2>
            <div className="space-y-1.5">
              <Label htmlFor="name">Event name *</Label>
              <Input id="name" value={f.name} onChange={(e) => set("name", e.target.value)} required placeholder="e.g. Priya & Arjun Wedding" />
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
              {f.type === "Other" && (
                <div className="space-y-1.5">
                  <Label htmlFor="customType">Custom event type</Label>
                  <Input id="customType" value={f.customType} onChange={(e) => set("customType", e.target.value)} placeholder="e.g. Product launch" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={f.status} onValueChange={(v) => set("status", v as Form["status"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* 2. Client info */}
          <Card className="border-border/60 p-6 shadow-soft space-y-4">
            <h2 className="font-display text-lg font-semibold">Client information</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="clientName">Client name</Label>
                <Input id="clientName" value={f.clientName} onChange={(e) => set("clientName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientPhone">Phone number</Label>
                <Input id="clientPhone" type="tel" value={f.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientEmail">Email</Label>
                <Input id="clientEmail" type="email" value={f.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Preferred contact</Label>
                <Select value={f.preferredContact} onValueChange={(v) => set("preferredContact", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTACT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Lead source</Label>
                <Select value={f.leadSource} onValueChange={(v) => set("leadSource", v)}>
                  <SelectTrigger><SelectValue placeholder="Where did they find you?" /></SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* 3. Venue */}
          <Card className="border-border/60 p-6 shadow-soft space-y-4">
            <h2 className="font-display text-lg font-semibold">Venue</h2>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
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
                placeholder="Start typing an address…"
              />
              <p className="text-xs text-muted-foreground">Suggestions from Google. You can also enter details manually.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="street">Street</Label>
                <Input id="street" value={f.street} onChange={(e) => set("street", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={f.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">State</Label>
                <Input id="state" value={f.state} onChange={(e) => set("state", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zip">ZIP</Label>
                <Input id="zip" value={f.zip} onChange={(e) => set("zip", e.target.value)} />
              </div>
            </div>
          </Card>

          {/* 4. Date & Time */}
          <Card className="border-border/60 p-6 shadow-soft space-y-4">
            <h2 className="font-display text-lg font-semibold">Date & time</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="startTime">Start time</Label>
                <Input id="startTime" type="time" value={f.startTime} onChange={(e) => set("startTime", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endTime">End time</Label>
                <Input id="endTime" type="time" value={f.endTime} onChange={(e) => set("endTime", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dur">Or duration (hours)</Label>
                <Input id="dur" type="number" min="0" step="0.5" value={f.durationHours} onChange={(e) => set("durationHours", e.target.value)} disabled={!!f.endTime} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Calculated</Label>
                <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  {computed.duration ? `Duration: ${computed.duration}` : "Enter start + end (or duration)"}
                  {!f.endTime && computed.endTime && ` · End: ${computed.endTime}`}
                </div>
              </div>
            </div>
          </Card>

          {/* 5. Guests */}
          <Card className="border-border/60 p-6 shadow-soft space-y-4">
            <h2 className="font-display text-lg font-semibold">Guests</h2>
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="guests">Expected guests</Label>
              <Input id="guests" type="number" min="0" value={f.expectedGuests} onChange={(e) => set("expectedGuests", e.target.value)} />
            </div>
          </Card>

          {/* 6. Notes */}
          <Card className="border-border/60 p-6 shadow-soft space-y-4">
            <h2 className="font-display text-lg font-semibold">Event notes</h2>
            <Textarea rows={4} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Client prefers black & gold · Setup through side entrance · Outdoor ceremony · Wheelchair access…" />
          </Card>

          {/* 7. Payment */}
          <Card className="border-border/60 p-6 shadow-soft space-y-4">
            <h2 className="font-display text-lg font-semibold">Payment</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="depReq">Deposit required ($)</Label>
                <Input id="depReq" type="number" min="0" step="0.01" value={f.depositRequired} onChange={(e) => set("depositRequired", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="depPaid">Deposit paid ($)</Label>
                <Input id="depPaid" type="number" min="0" step="0.01" value={f.depositPaid} onChange={(e) => set("depositPaid", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="due">Balance due date</Label>
                <Input id="due" type="date" value={f.balanceDueDate} onChange={(e) => set("balanceDueDate", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment status</Label>
                <Select value={f.paymentStatus} onValueChange={(v) => set("paymentStatus", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 text-sm text-muted-foreground">
                {(() => {
                  const req = Number(f.depositRequired) || 0;
                  const paid = Number(f.depositPaid) || 0;
                  const rem = Math.max(0, req - paid);
                  return req > 0 ? `Remaining balance: $${rem.toLocaleString()}` : "Enter deposit required to see remaining balance.";
                })()}
              </div>
            </div>
          </Card>

          <div className="sticky bottom-4 z-10 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/events" })}>Cancel</Button>
            <Button type="submit" disabled={busy} size="lg">{busy ? "Creating…" : "Create event"}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
