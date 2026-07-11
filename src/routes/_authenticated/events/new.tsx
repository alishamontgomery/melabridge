import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
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

export const Route = createFileRoute("/_authenticated/events/new")({
  head: () => ({ meta: [{ title: "New event — MelaBridge" }] }),
  component: NewEventPage,
});

const EVENT_TYPES = [
  "Wedding", "Birthday", "Reunion", "Baby Shower", "Corporate",
  "Conference", "Fundraiser", "Vacation", "Funeral", "Other",
];

function NewEventPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "",
    type: "Wedding",
    date: "",
    time: "",
    location: "",
    guests: "",
    budget: "",
    description: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const name = z.string().trim().min(1, "Name is required").max(120).parse(f.name);
      const { data, error } = await supabase.from("events").insert({
        owner_id: user.id,
        name,
        event_type: f.type,
        event_date: f.date || null,
        event_time: f.time || null,
        location: f.location || null,
        guest_target: f.guests ? parseInt(f.guests, 10) : null,
        budget_target: f.budget ? Number(f.budget) : null,
        description: f.description || null,
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
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to events
        </Link>
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> New event
          </div>
          <h1 className="font-display text-3xl font-semibold">Let's set the foundation</h1>
          <p className="mt-1 text-sm text-muted-foreground">You can edit any of this later.</p>
        </div>
        <Card className="border-border/60 p-6 shadow-soft">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Event name</Label>
              <Input id="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="time">Time</Label>
                <Input id="time" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guests">Guest target</Label>
                <Input id="guests" type="number" min="0" value={f.guests} onChange={(e) => setF({ ...f, guests: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget">Budget ($)</Label>
                <Input id="budget" type="number" min="0" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Vision</Label>
              <Textarea id="desc" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/events" })}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create event"}</Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
