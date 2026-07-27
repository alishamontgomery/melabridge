import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEcosystem } from "@/lib/ecosystem-store";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Search } from "lucide-react";
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

const RSVP_TONE: Record<Rsvp, string> = {
  yes: "bg-emerald-500/10 text-emerald-700",
  no: "bg-rose-500/10 text-rose-700",
  maybe: "bg-sky-500/10 text-sky-700",
  pending: "bg-amber-500/10 text-amber-700",
};

function GuestsPage() {
  const { event, hasEvent, loading: eventLoading } = useEcosystem();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Rsvp>("all");

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

  const guests = gq.data ?? [];

  async function updateRsvp(id: string, next: Rsvp) {
    const prev = qc.getQueryData<Guest[]>(["guests", event.id]);
    qc.setQueryData<Guest[]>(["guests", event.id], (list) =>
      (list ?? []).map((g) => (g.id === id ? { ...g, rsvp_status: next } : g)),
    );
    const { error } = await supabase.from("guests").update({ rsvp_status: next }).eq("id", id);
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
      pending: guests.filter((g) => (g.rsvp_status ?? "pending") === "pending").length,
      no: guests.filter((g) => (g.rsvp_status ?? "pending") === "no").length,
    }),
    [guests],
  );

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
            <Button asChild variant="hero">
              <Link to="/events/$eventId" params={{ eventId: event.id! }}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add guest
              </Link>
            </Button>
          ) : null
        }
      />

      {eventLoading || (hasEvent && gq.isLoading) ? (
        <ModuleLoading rows={5} />
      ) : hasEvent && gq.isError ? (
        <ModuleError error={gq.error} onRetry={() => gq.refetch()} />
      ) : !hasEvent ? (

        <EmptyState message="Create an event to invite guests, track RSVPs, and manage meal choices." to="/events/new" cta="Create an event" />
      ) : guests.length === 0 ? (
        <EmptyState
          message="No guests yet. Add your first guest from the event detail page to start collecting RSVPs."
          to="/events/$eventId"
          params={{ eventId: event.id! }}
          cta="Open event"
        />
      ) : (
        <>
          <section className="mt-8 grid gap-3 md:grid-cols-4">
            <Stat label="On list" value={String(guests.length)} sub={`${counts.total} incl. +1s`} />
            <Stat label="Confirmed" value={String(counts.confirmed)} sub="Attending" />
            <Stat label="Pending" value={String(counts.pending)} sub="Awaiting reply" />
            <Stat label="Declined" value={String(counts.declined)} sub="Not attending" />
          </section>

          <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guests by name or email…" className="pl-9" />
            </div>
            {(["all", "confirmed", "pending", "declined"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                  filter === f
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Guest</th>
                  <th className="px-4 py-2 text-left">Phone</th>
                  <th className="px-4 py-2 text-left">+1s</th>
                  <th className="px-4 py-2 text-left">RSVP</th>
                  <th className="px-4 py-2 text-left">Meal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => {
                  const rs = (g.rsvp_status ?? "pending").toLowerCase();
                  return (
                    <tr key={g.id} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{g.full_name}</p>
                        {g.email && <p className="text-xs text-muted-foreground">{g.email}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{g.phone ?? "—"}</td>
                      <td className="px-4 py-2.5">{g.plus_ones ?? 0}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          className={
                            rs === "confirmed" || rs === "attending"
                              ? "bg-emerald-500/10 text-emerald-700"
                              : rs === "declined"
                              ? "bg-rose-500/10 text-rose-700"
                              : "bg-amber-500/10 text-amber-700"
                          }
                        >
                          {RSVP_LABEL[rs] ?? "Pending"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">{g.meal_choice ?? "—"}</td>
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
    </AppShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function EmptyState({
  message,
  to,
  params,
  cta,
}: {
  message: string;
  to: string;
  params?: Record<string, string>;
  cta: string;
}) {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Users className="h-5 w-5" />
      </span>
      <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{message}</p>
      <Button asChild className="mt-5" variant="hero">
        <Link to={to as never} params={params as never}>
          <UserPlus className="mr-2 h-4 w-4" />
          {cta}
        </Link>
      </Button>
    </div>
  );
}
