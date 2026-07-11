import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { RippleFeed } from "@/components/ripple-feed";
import { useEcosystem } from "@/lib/ecosystem-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Minus, Mail, Check, Clock, X } from "lucide-react";

export const Route = createFileRoute("/guests")({
  head: () => ({
    meta: [
      { title: "Guests — MelaBridge" },
      { name: "description", content: "Guest list, RSVPs, dietary needs, seating — connected to budget, catering, and AI." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuestsPage,
});

const GUESTS = [
  { name: "Priya Menon", rsvp: "Yes", table: 3, plus: 1, note: "Vegetarian" },
  { name: "Tunde Bakare", rsvp: "Pending", table: null, plus: 0, note: "" },
  { name: "Lauren & Marcus Chen", rsvp: "Yes", table: 4, plus: 1, note: "Gluten-free" },
  { name: "Aisha Rahman", rsvp: "Yes", table: 3, plus: 0, note: "" },
  { name: "Kwame Mensah", rsvp: "Regrets", table: null, plus: 0, note: "" },
  { name: "Sofia Ricci", rsvp: "Yes", table: 5, plus: 1, note: "Nut allergy" },
  { name: "Julien Sr. & Marie", rsvp: "Yes", table: 1, plus: 0, note: "VIP" },
  { name: "Ade Adeyemi", rsvp: "Pending", table: null, plus: 1, note: "" },
];

function pill(rsvp: string) {
  if (rsvp === "Yes") return { icon: Check, cls: "bg-emerald-500/10 text-emerald-700" };
  if (rsvp === "Pending") return { icon: Clock, cls: "bg-amber-500/10 text-amber-700" };
  return { icon: X, cls: "bg-rose-500/10 text-rose-700" };
}

function GuestsPage() {
  const { event, setGuests, logRsvp, cateringRecommendation, seatingTables } = useEcosystem();
  return (
    <AppShell active="/guests">
      <PageHeader
        eyebrow="Guests"
        icon={Users}
        title={<>Your circle, <span className="text-gradient">seated and understood</span>.</>}
        description="Every change here recalculates the budget, catering, seating chart, and Event Health Score™."
        actions={
          <>
            <Button variant="soft" onClick={() => setGuests(event.guests + 5)} className="gap-1"><Plus className="h-4 w-4" /> 5 guests</Button>
            <Button variant="soft" onClick={() => setGuests(event.guests - 5)} className="gap-1"><Minus className="h-4 w-4" /> 5 guests</Button>
            <Button variant="hero" className="gap-1"><Mail className="h-4 w-4" /> Send RSVP nudge</Button>
          </>
        }
      />

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          { k: "Invited", v: event.guests },
          { k: "RSVP yes", v: event.rsvps },
          { k: "Catering plates", v: cateringRecommendation },
          { k: "Tables", v: seatingTables },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.k}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{s.v}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <p className="font-display text-lg font-semibold">Guest list</p>
            <div className="flex gap-2">
              <Button size="sm" variant="soft" onClick={() => logRsvp(1)}>+1 RSVP</Button>
              <Button size="sm" variant="ghost" onClick={() => logRsvp(-1)}>-1 RSVP</Button>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {GUESTS.map((g) => {
              const p = pill(g.rsvp);
              return (
                <li key={g.name} className="flex items-center gap-3 p-4">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-gold/20 text-sm font-semibold">
                    {g.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {g.plus ? "+1 · " : ""}{g.table ? `Table ${g.table}` : "Unseated"}{g.note ? ` · ${g.note}` : ""}
                    </p>
                  </div>
                  <Badge className={`gap-1 ${p.cls}`}><p.icon className="h-3 w-3" /> {g.rsvp}</Badge>
                </li>
              );
            })}
          </ul>
        </div>
        <RippleFeed />
      </section>
    </AppShell>
  );
}
