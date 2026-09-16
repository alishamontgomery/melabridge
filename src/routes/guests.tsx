import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEcosystem } from "@/lib/ecosystem-store";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Search, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ModuleError, ModuleLoading, RouteError } from "@/components/module-states";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/guests")({
  head: () => ({
    meta: [
      { title: "Guests — MelaBridge" },
      { name: "description", content: "Guest list, RSVPs, and meal preferences for your event." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuestsPage,
  errorComponent: RouteError,
});

type Rsvp = Database["public"]["Enums"]["guest_rsvp"];
type Guest = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  household: string | null;
  rsvp_status: Rsvp | null;
  plus_ones: number | null;
  meal_choice: string | null;
  notes: string | null;
};

const RSVP_LABEL: Record<Rsvp, string> = {
  pending: "Pending",
  yes: "Attending",
  no: "Declined",
  maybe: "Maybe",
};

function GuestsPage() {
  const { event, hasEvent, loading: eventLoading } = useEcosystem();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Rsvp>("all");
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [openAdd, setOpenAdd] = useState(false);

  const gq = useQuery({
    queryKey: ["guests", event.id],
    enabled: !!event.id,
    queryFn: async (): Promise<Guest[]> => {
      const { data, error } = await supabase
        .from("guests")
        .select("id, full_name, email, phone, household, rsvp_status, plus_ones, meal_choice, notes")
        .eq("event_id", event.id!)
        .is("deleted_at", null)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Guest[];
    },
  });

  const guests = useMemo(() => gq.data ?? [], [gq.data]);

  async function updateRsvp(id: string, next: Rsvp) {
    const prev = qc.getQueryData<Guest[]>(["guests", event.id]);
    qc.setQueryData<Guest[]>(["guests", event.id], (list) =>
      (list ?? []).map((g) => (g.id === id ? { ...g, rsvp_status: next } : g)),
    );
    const { error } = await supabase.from("guests").update({ rsvp_status: next }).eq("id", id).is("deleted_at", null);
    if (error) {
      qc.setQueryData(["guests", event.id], prev);
      toast.error(error.message);
      return;
    }
    toast.success("RSVP updated");
  }

  const filtered = useMemo(() => {
    return guests.filter((g) => {
      const rs: Rsvp = (g.rsvp_status ?? "pending") as Rsvp;
      const matchFilter = filter === "all" ? true : rs === filter;
      const matchQ =
        q === "" ||
        g.full_name.toLowerCase().includes(q.toLowerCase()) ||
        (g.email ?? "").toLowerCase().includes(q.toLowerCase());
      return matchFilter && matchQ;
    });
  }, [guests, q, filter]);

  const counts = useMemo(
    () => ({
      total: guests.reduce((s, g) => s + 1 + Number(g.plus_ones ?? 0), 0),
      yes: guests.filter((g) => (g.rsvp_status ?? "pending") === "yes").length,
      maybe: guests.filter((g) => (g.rsvp_status ?? "pending") === "maybe").length,
      pending: guests.filter((g) => (g.rsvp_status ?? "pending") === "pending").length,
      no: guests.filter((g) => (g.rsvp_status ?? "pending") === "no").length,
    }),
    [guests],
  );

  function handleGuestSaved(updated: Guest) {
    qc.setQueryData<Guest[]>(["guests", event.id], (list) =>
      (list ?? []).map((g) => (g.id === updated.id ? updated : g)),
    );
    setSelectedGuest(null);
  }

  function handleGuestDeleted(id: string) {
    qc.setQueryData<Guest[]>(["guests", event.id], (list) =>
      (list ?? []).filter((g) => g.id !== id),
    );
    setSelectedGuest(null);
  }

  function handleGuestAdded(newGuest: Guest) {
    qc.setQueryData<Guest[]>(["guests", event.id], (list) =>
      [...(list ?? []), newGuest].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    );
    setOpenAdd(false);
  }

  return (
    <AppShell active="/guests">
      <PageHeader
        eyebrow="Guest Management"
        icon={Users}
        title={<>Every guest, <span className="text-gradient">accounted for</span>.</>}
        description={
          hasEvent
            ? `${event.name} · ${guests.length} on the list · ${counts.total} incl. plus-ones.`
            : "Create an event to start managing your guest list."
        }
        actions={
          hasEvent ? (
            <Button variant="hero" onClick={() => setOpenAdd(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add guest
            </Button>
          ) : null
        }
      />

      {eventLoading || (hasEvent && gq.isLoading) ? (
        <ModuleLoading rows={5} />
      ) : hasEvent && gq.isError ? (
        <ModuleError error={gq.error} onRetry={() => gq.refetch()} />
      ) : !hasEvent ? (
        <EmptyState
          message="Create an event to invite guests, track RSVPs, and manage meal choices."
          cta="Create an event"
          to="/events/new"
        />
      ) : guests.length === 0 ? (
        <EmptyState
          message="No guests yet. Add your first guest to start collecting RSVPs."
          cta="Add first guest"
          onClick={() => setOpenAdd(true)}
        />
      ) : (
        <>
          {/* RSVP summary stats */}
          <section className="mt-8 grid gap-3 grid-cols-2 md:grid-cols-4">
            <Stat label="Attending" value={String(counts.yes)} sub="Confirmed yes" tone="emerald" active={filter === "yes"} onClick={() => setFilter(filter === "yes" ? "all" : "yes")} />
            <Stat label="Maybe" value={String(counts.maybe)} sub="Tentative" tone="sky" active={filter === "maybe"} onClick={() => setFilter(filter === "maybe" ? "all" : "maybe")} />
            <Stat label="Pending" value={String(counts.pending)} sub="Awaiting reply" tone="amber" active={filter === "pending"} onClick={() => setFilter(filter === "pending" ? "all" : "pending")} />
            <Stat label="Declined" value={String(counts.no)} sub="Not attending" tone="rose" active={filter === "no"} onClick={() => setFilter(filter === "no" ? "all" : "no")} />
          </section>

          {filter !== "all" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing <strong>{RSVP_LABEL[filter as Rsvp]}</strong> guests.{" "}
              <button onClick={() => setFilter("all")} className="underline hover:text-foreground">
                Clear filter
              </button>
            </p>
          )}

          <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guests…" className="pl-9" />
            </div>
            {(["all", "yes", "maybe", "pending", "no"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition min-h-[36px] ${
                  filter === f
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "All" : RSVP_LABEL[f]}
              </button>
            ))}
          </div>

          {/* ── Mobile card list (hidden on sm+) ── */}
          <div className="sm:hidden rounded-3xl border border-border bg-card overflow-hidden">
            <ul className="divide-y divide-border">
              {filtered.map((g) => {
                const rs: Rsvp = (g.rsvp_status ?? "pending") as Rsvp;
                return (
                  <li key={g.id} className="flex items-center gap-3 px-4 py-3 min-h-[60px]">
                    {/* Tappable name/email area */}
                    <button
                      type="button"
                      onClick={() => setSelectedGuest(g)}
                      className="min-w-0 flex-1 text-left"
                      aria-label={`Edit guest: ${g.full_name}`}
                    >
                      <p className="truncate text-sm font-medium">{g.full_name}</p>
                      {g.email && <p className="truncate text-xs text-muted-foreground">{g.email}</p>}
                    </button>
                    {/* RSVP select — 44px tap target on mobile */}
                    <Select value={rs} onValueChange={(v) => updateRsvp(g.id, v as Rsvp)}>
                      <SelectTrigger className="h-10 w-[106px] shrink-0 text-xs" aria-label="RSVP status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="yes">Attending</SelectItem>
                        <SelectItem value="maybe">Maybe</SelectItem>
                        <SelectItem value="no">Declined</SelectItem>
                      </SelectContent>
                    </Select>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No guests match your filters.
                </li>
              )}
            </ul>
          </div>

          {/* ── Desktop table (hidden below sm) ── */}
          <div className="hidden sm:block rounded-3xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Guest</th>
                  <th className="px-4 py-2 text-left">Phone</th>
                  <th className="px-4 py-2 text-left">+1s</th>
                  <th className="px-4 py-2 text-left">RSVP</th>
                  <th className="hidden px-4 py-2 text-left md:table-cell">Meal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => {
                  const rs: Rsvp = (g.rsvp_status ?? "pending") as Rsvp;
                  return (
                    <tr key={g.id} className="border-t border-border hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-2.5 max-w-[220px]">
                        <button
                          type="button"
                          onClick={() => setSelectedGuest(g)}
                          className="text-left group w-full"
                          aria-label={`Edit guest: ${g.full_name}`}
                        >
                          <p className="truncate font-medium group-hover:text-primary group-hover:underline transition-colors">
                            {g.full_name}
                          </p>
                          {g.email && <p className="truncate text-xs text-muted-foreground">{g.email}</p>}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{g.phone ?? "—"}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{g.plus_ones ?? 0}</td>
                      <td className="px-4 py-2.5">
                        <Select value={rs} onValueChange={(v) => updateRsvp(g.id, v as Rsvp)}>
                          <SelectTrigger className="h-7 w-[110px] text-xs" aria-label="RSVP status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="yes">Attending</SelectItem>
                            <SelectItem value="maybe">Maybe</SelectItem>
                            <SelectItem value="no">Declined</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="hidden px-4 py-2.5 md:table-cell text-muted-foreground">{g.meal_choice ?? "—"}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No guests match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add guest dialog */}
      {openAdd && event.id && (
        <AddGuestDialog
          eventId={event.id}
          onClose={() => setOpenAdd(false)}
          onAdded={handleGuestAdded}
        />
      )}

      {/* Edit guest dialog */}
      {selectedGuest && (
        <GuestDetailDialog
          guest={selectedGuest}
          eventId={event.id!}
          onClose={() => setSelectedGuest(null)}
          onSaved={handleGuestSaved}
          onDeleted={handleGuestDeleted}
        />
      )}
    </AppShell>
  );
}

function Stat({ label, value, sub, tone, active, onClick }: {
  label: string; value: string; sub: string;
  tone?: "emerald" | "sky" | "amber" | "rose"; active?: boolean; onClick?: () => void;
}) {
  const toneClass = {
    emerald: "hover:border-emerald-400/60",
    sky: "hover:border-sky-400/60",
    amber: "hover:border-amber-400/60",
    rose: "hover:border-rose-400/60",
  }[tone ?? "emerald"] ?? "";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border bg-card p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px] ${
        active ? "border-primary bg-primary/5" : `border-border ${toneClass}`
      }`}
      aria-pressed={active}
      title={`Filter by ${label}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </button>
  );
}

function AddGuestDialog({ eventId, onClose, onAdded }: {
  eventId: string;
  onClose: () => void;
  onAdded: (g: Guest) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [household, setHousehold] = useState("");
  const [rsvp, setRsvp] = useState<Rsvp>("pending");
  const [plusOnes, setPlusOnes] = useState("0");
  const [mealChoice, setMealChoice] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!fullName.trim()) { toast.error("Guest name is required"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("guests")
      .insert({
        event_id: eventId,
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        household: household.trim() || null,
        rsvp_status: rsvp,
        plus_ones: parseInt(plusOnes, 10) || 0,
        meal_choice: mealChoice.trim() || null,
      })
      .select("id, full_name, email, phone, household, rsvp_status, plus_ones, meal_choice, notes")
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Guest added");
    onAdded(data as Guest);
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add guest</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ag-name">Full name <span className="text-destructive">*</span></Label>
            <Input id="ag-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Guest name" autoFocus />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ag-email">Email</Label>
              <Input id="ag-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-phone">Phone</Label>
              <Input id="ag-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ag-household">Household / Group</Label>
              <Input id="ag-household" value={household} onChange={(e) => setHousehold(e.target.value)} placeholder="e.g. Smith Family" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-plusones">Plus-ones</Label>
              <Input id="ag-plusones" type="number" min="0" max="10" value={plusOnes} onChange={(e) => setPlusOnes(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ag-rsvp">RSVP status</Label>
              <Select value={rsvp} onValueChange={(v) => setRsvp(v as Rsvp)}>
                <SelectTrigger id="ag-rsvp"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="yes">Attending</SelectItem>
                  <SelectItem value="maybe">Maybe</SelectItem>
                  <SelectItem value="no">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-meal">Meal choice</Label>
              <Input id="ag-meal" value={mealChoice} onChange={(e) => setMealChoice(e.target.value)} placeholder="e.g. Vegetarian" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !fullName.trim()} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}Add guest
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GuestDetailDialog({ guest, eventId, onClose, onSaved, onDeleted }: {
  guest: Guest; eventId: string;
  onClose: () => void; onSaved: (updated: Guest) => void; onDeleted: (id: string) => void;
}) {
  const [fullName, setFullName] = useState(guest.full_name);
  const [email, setEmail] = useState(guest.email ?? "");
  const [phone, setPhone] = useState(guest.phone ?? "");
  const [household, setHousehold] = useState(guest.household ?? "");
  const [rsvp, setRsvp] = useState<Rsvp>(guest.rsvp_status ?? "pending");
  const [plusOnes, setPlusOnes] = useState(String(guest.plus_ones ?? 0));
  const [mealChoice, setMealChoice] = useState(guest.meal_choice ?? "");
  const [notes, setNotes] = useState(guest.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    if (!fullName.trim()) { toast.error("Guest name is required"); return; }
    setSaving(true);
    const patch = {
      full_name: fullName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      household: household.trim() || null,
      rsvp_status: rsvp,
      plus_ones: parseInt(plusOnes, 10) || 0,
      meal_choice: mealChoice.trim() || null,
      notes: notes.trim() || null,
    };
    const { data, error } = await supabase
      .from("guests")
      .update(patch)
      .eq("id", guest.id)
      .eq("event_id", eventId)
      .select("id, full_name, email, phone, household, rsvp_status, plus_ones, meal_choice, notes")
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Guest saved");
    onSaved(data as Guest);
  }

  async function deleteGuest() {
    setDeleting(true);
    const { error } = await supabase.from("guests").update({ deleted_at: new Date().toISOString() }).eq("id", guest.id);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Guest removed");
    onDeleted(guest.id);
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Guest details</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Full name</Label>
            <Input id="g-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Guest name" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="g-email">Email</Label>
              <Input id="g-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-phone">Phone</Label>
              <Input id="g-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="g-household">Household / Group</Label>
              <Input id="g-household" value={household} onChange={(e) => setHousehold(e.target.value)} placeholder="e.g. Smith Family" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-plusones">Plus-ones</Label>
              <Input id="g-plusones" type="number" min="0" max="10" value={plusOnes} onChange={(e) => setPlusOnes(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="g-rsvp">RSVP status</Label>
              <Select value={rsvp} onValueChange={(v) => setRsvp(v as Rsvp)}>
                <SelectTrigger id="g-rsvp"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="yes">Attending</SelectItem>
                  <SelectItem value="maybe">Maybe</SelectItem>
                  <SelectItem value="no">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-meal">Meal choice</Label>
              <Input id="g-meal" value={mealChoice} onChange={(e) => setMealChoice(e.target.value)} placeholder="e.g. Vegetarian" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-notes">Notes</Label>
            <Textarea id="g-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dietary restrictions, seating preferences…" />
          </div>
        </div>
        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 sm:justify-between">
          <div className="flex gap-2">
            {!confirmDelete ? (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={deleting}>
                <Trash2 className="mr-1.5 h-4 w-4" />Remove
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Remove this guest?</span>
                <Button variant="destructive" size="sm" onClick={deleteGuest} disabled={deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, remove"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving || !fullName.trim()} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ message, cta, onClick, to }: {
  message: string; cta: string; onClick?: () => void; to?: string;
}) {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Users className="h-5 w-5" />
      </span>
      <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{message}</p>
      {to ? (
        <Button asChild className="mt-5" variant="hero">
          <Link to={to as never}>
            <UserPlus className="mr-2 h-4 w-4" />{cta}
          </Link>
        </Button>
      ) : (
        <Button className="mt-5" variant="hero" onClick={onClick}>
          <UserPlus className="mr-2 h-4 w-4" />{cta}
        </Button>
      )}
    </div>
  );
}
