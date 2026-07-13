import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useEcosystem } from "@/lib/ecosystem-store";
import {
  Users, Search, QrCode, Mail, MessageSquare, Gift, AlertTriangle,
  Utensils, Check, Clock, Plus, Sparkles, UserPlus, Armchair, ScanLine,
} from "lucide-react";

export const Route = createFileRoute("/guests")({
  head: () => ({
    meta: [
      { title: "Guest Management — MelaBridge" },
      { name: "description", content: "Guest database, RSVPs, seating, QR check-in, and communications in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuestsPage,
});

type Rsvp = "Yes" | "No" | "Pending" | "Maybe";
type Guest = {
  id: string; name: string; family: string; plusOne: boolean; rsvp: Rsvp;
  meal: "Standard" | "Vegetarian" | "Vegan" | "Gluten-free" | "Kids";
  dietary?: string; table?: number; email?: string; phone?: string;
  gift?: string; notes?: string; checkedIn?: boolean;
};

const GUESTS: Guest[] = [
  { id: "g1", name: "Chinwe Adekunle", family: "Adekunle", plusOne: true, rsvp: "Yes", meal: "Vegetarian", dietary: "No nuts", table: 3, email: "chinwe@ex.com", phone: "+1 646 555 0122", gift: "Kitchen mixer", notes: "Bridal party" },
  { id: "g2", name: "Marcus Bell", family: "Bell", plusOne: false, rsvp: "Yes", meal: "Standard", table: 5, gift: "Cash gift $250", checkedIn: true },
  { id: "g3", name: "Priya Rao", family: "Rao", plusOne: true, rsvp: "Pending", meal: "Vegan", dietary: "Vegan strict", email: "priya@ex.com" },
  { id: "g4", name: "David & Amina Osei", family: "Osei", plusOne: false, rsvp: "Yes", meal: "Gluten-free", table: 2, email: "d.osei@ex.com" },
  { id: "g5", name: "Kai Nakamura", family: "Nakamura", plusOne: false, rsvp: "Maybe", meal: "Standard", notes: "Traveling from Tokyo" },
  { id: "g6", name: "Elena Vasquez", family: "Vasquez", plusOne: true, rsvp: "No", meal: "Standard", notes: "Sent regrets · sending gift" },
  { id: "g7", name: "Julien Marchetti", family: "Marchetti", plusOne: false, rsvp: "Yes", meal: "Standard", table: 1, checkedIn: true },
  { id: "g8", name: "Ade Balogun", family: "Balogun", plusOne: true, rsvp: "Pending", meal: "Standard" },
];

function GuestsPage() {
  const { event } = useEcosystem();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Rsvp | "All">("All");
  const [guests, setGuests] = useState(GUESTS);

  const filtered = useMemo(() => guests.filter(g =>
    (filter === "All" || g.rsvp === filter) &&
    (q === "" || g.name.toLowerCase().includes(q.toLowerCase()) || g.family.toLowerCase().includes(q.toLowerCase()))
  ), [guests, q, filter]);

  const counts = useMemo(() => ({
    total: guests.reduce((s, g) => s + (g.plusOne ? 2 : 1), 0),
    yes: guests.filter(g => g.rsvp === "Yes").length,
    pending: guests.filter(g => g.rsvp === "Pending").length,
    no: guests.filter(g => g.rsvp === "No").length,
    checkedIn: guests.filter(g => g.checkedIn).length,
  }), [guests]);

  const rsvpPct = Math.round(((counts.yes + counts.no) / Math.max(1, guests.length)) * 100);

  return (
    <AppShell active="/guests">
      <PageHeader
        eyebrow="Guest Management"
        icon={Users}
        title={<>Every guest, <span className="text-gradient">accounted for</span>.</>}
        description={`Managing ${event.guests} expected guests · ${counts.yes} confirmed · MelaAssist is watching for RSVP gaps, dietary conflicts, and seating issues.`}
        actions={<>
          <Button variant="outline"><QrCode className="mr-2 h-4 w-4"/>Send QR invites</Button>
          <Button variant="hero"><UserPlus className="mr-2 h-4 w-4"/>Add guest</Button>
        </>}
      />

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <StatCard label="Total on list" value={String(guests.length)} sub={`${counts.total} incl. +1s`} />
        <StatCard label="Confirmed" value={String(counts.yes)} sub={`${rsvpPct}% response rate`} />
        <StatCard label="Pending RSVPs" value={String(counts.pending)} sub="AI drafted 3 nudges" tone="warn" />
        <StatCard label="Checked in" value={String(counts.checkedIn)} sub="Live at door" tone="good" />
      </section>

      <section className="mt-6 rounded-3xl border border-primary/20 bg-primary/5 p-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary"><Sparkles className="h-3.5 w-3.5"/>MelaAssist™ insights</div>
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          <AiRow icon={AlertTriangle} tone="warn" text="3 guests haven't RSVP'd 6 weeks out — drafts ready to send." />
          <AiRow icon={Utensils} tone="info" text="1 vegan + 1 gluten-free confirmed — catering has been notified." />
          <AiRow icon={Armchair} tone="warn" text="Table 3 has a seating conflict (Priya seated next to Elena)." />
          <AiRow icon={Gift} tone="good" text="Registry views up 22% this week — send thank-you drafts?" />
        </ul>
      </section>

      <Tabs defaultValue="list" className="mt-8">
        <TabsList className="flex-wrap">
          <TabsTrigger value="list"><Users className="mr-1.5 h-3.5 w-3.5"/>List</TabsTrigger>
          <TabsTrigger value="families">Family groups</TabsTrigger>
          <TabsTrigger value="seating"><Armchair className="mr-1.5 h-3.5 w-3.5"/>Seating</TabsTrigger>
          <TabsTrigger value="checkin"><ScanLine className="mr-1.5 h-3.5 w-3.5"/>Check-in</TabsTrigger>
          <TabsTrigger value="comms"><MessageSquare className="mr-1.5 h-3.5 w-3.5"/>Communications</TabsTrigger>
          <TabsTrigger value="gifts"><Gift className="mr-1.5 h-3.5 w-3.5"/>Gifts</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/>
              <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search guests or families…" className="pl-9"/>
            </div>
            {(["All","Yes","Pending","Maybe","No"] as const).map(f => (
              <button key={f} onClick={()=>setFilter(f)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${filter===f?"border-primary bg-primary text-primary-foreground":"border-border bg-card text-muted-foreground hover:text-foreground"}`}>
                {f}
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Guest</th>
                  <th className="px-4 py-2 text-left">Family</th>
                  <th className="px-4 py-2 text-left">+1</th>
                  <th className="px-4 py-2 text-left">RSVP</th>
                  <th className="px-4 py-2 text-left">Meal</th>
                  <th className="px-4 py-2 text-left">Table</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{g.name}</p>
                      {g.dietary && <p className="text-xs text-amber-600">⚠ {g.dietary}</p>}
                      {g.notes && <p className="text-xs text-muted-foreground">{g.notes}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{g.family}</td>
                    <td className="px-4 py-2.5">{g.plusOne ? <Check className="h-4 w-4 text-emerald-600"/> : "—"}</td>
                    <td className="px-4 py-2.5"><RsvpBadge r={g.rsvp}/></td>
                    <td className="px-4 py-2.5">{g.meal}</td>
                    <td className="px-4 py-2.5">{g.table ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="ghost" onClick={()=>setGuests(prev=>prev.map(x=>x.id===g.id?{...x, rsvp:"Yes"}:x))}>Mark yes</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="families" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from(new Set(guests.map(g=>g.family))).map(fam => {
              const group = guests.filter(g=>g.family===fam);
              const confirmed = group.filter(g=>g.rsvp==="Yes").length;
              return (
                <div key={fam} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{fam} family</p>
                    <Badge variant="secondary">{group.length}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{confirmed} confirmed · {group.filter(g=>g.plusOne).length} plus-ones</p>
                  <div className="mt-3 flex -space-x-2">
                    {group.slice(0,5).map((g,i)=>(
                      <span key={g.id} className="grid h-7 w-7 place-items-center rounded-full border-2 border-card bg-gradient-to-br from-primary to-gold text-[10px] font-semibold text-primary-foreground" style={{zIndex:5-i}}>
                        {g.name.split(" ").map(n=>n[0]).slice(0,2).join("")}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="seating" className="mt-4">
          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Seating chart · Grand Hall</h3>
              <Button size="sm" variant="outline"><Sparkles className="mr-2 h-4 w-4"/>Auto-seat with AI</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {[1,2,3,4,5,6,7,8,9,10].map(t=>{
                const seated = guests.filter(g=>g.table===t);
                const conflict = t===3;
                return (
                  <div key={t} className={`rounded-2xl border p-4 text-center ${conflict?"border-amber-400 bg-amber-50/50":"border-border bg-background"}`}>
                    <div className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-full border-2 border-primary/40 bg-primary/5 text-sm font-semibold">T{t}</div>
                    <p className="text-xs text-muted-foreground">{seated.length}/10 seated</p>
                    {conflict && <p className="mt-1 text-[10px] font-medium text-amber-700">⚠ Conflict flagged</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="checkin" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/5 to-accent/20 p-6 text-center">
              <div className="mx-auto grid h-48 w-48 place-items-center rounded-2xl border-2 border-dashed border-primary/40 bg-background">
                <QrCode className="h-24 w-24 text-primary"/>
              </div>
              <p className="mt-4 font-display text-lg font-semibold">Event QR code</p>
              <p className="text-xs text-muted-foreground">Guests scan on arrival · check-in is instant</p>
              <Button className="mt-3" variant="hero"><ScanLine className="mr-2 h-4 w-4"/>Open scanner</Button>
            </div>
            <div className="rounded-3xl border border-border bg-card p-5">
              <h3 className="font-display text-lg font-semibold">Live check-in feed</h3>
              <ul className="mt-3 divide-y divide-border text-sm">
                {guests.filter(g=>g.checkedIn).map(g=>(
                  <li key={g.id} className="flex items-center justify-between py-2.5">
                    <span className="font-medium">{g.name}</span>
                    <Badge className="bg-emerald-500/10 text-emerald-700 gap-1"><Check className="h-3 w-3"/>Checked in</Badge>
                  </li>
                ))}
                {guests.filter(g=>!g.checkedIn).slice(0,4).map(g=>(
                  <li key={g.id} className="flex items-center justify-between py-2.5 text-muted-foreground">
                    <span>{g.name}</span>
                    <Badge variant="secondary">Awaiting</Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="comms" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <CommsCard icon={Mail} title="Save the Date" sent={142} opened={128} />
            <CommsCard icon={Mail} title="Formal invitation" sent={142} opened={102} />
            <CommsCard icon={MessageSquare} title="RSVP reminder (SMS)" sent={38} opened={31} />
          </div>
          <div className="mt-4 rounded-3xl border border-border bg-card p-5">
            <h3 className="font-display text-lg font-semibold">Scheduled announcements</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <ScheduledRow when="Tomorrow · 10 AM" what="RSVP nudge to 3 pending guests" channel="Email + SMS"/>
              <ScheduledRow when="Fri · 9 AM" what="Travel details + hotel block reminder" channel="Email"/>
              <ScheduledRow when="Event week" what="Weather + arrival timing" channel="SMS"/>
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="gifts" className="mt-4">
          <div className="rounded-3xl border border-border bg-card">
            <ul className="divide-y divide-border">
              {guests.filter(g=>g.gift).map(g=>(
                <li key={g.id} className="flex items-center justify-between px-5 py-3">
                  <div><p className="font-medium">{g.name}</p><p className="text-xs text-muted-foreground">{g.gift}</p></div>
                  <Button size="sm" variant="ghost">Draft thank-you</Button>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "warn"|"good" }) {
  const t = tone==="warn"?"text-amber-600":tone==="good"?"text-emerald-600":"text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      <p className={`text-xs ${t}`}>{sub}</p>
    </div>
  );
}
function RsvpBadge({ r }: { r: Rsvp }) {
  const map: Record<Rsvp,string> = {
    Yes:"bg-emerald-500/10 text-emerald-700",
    No:"bg-rose-500/10 text-rose-700",
    Pending:"bg-amber-500/10 text-amber-700",
    Maybe:"bg-primary/10 text-primary",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${map[r]}`}>{r}</span>;
}
function AiRow({ icon: Icon, tone, text }: { icon: React.ComponentType<{className?:string}>; tone:"warn"|"info"|"good"; text:string }) {
  const t = tone==="warn"?"text-amber-600":tone==="good"?"text-emerald-600":"text-primary";
  return <li className="flex items-start gap-2"><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${t}`}/><span>{text}</span></li>;
}
function CommsCard({ icon: Icon, title, sent, opened }: { icon: React.ComponentType<{className?:string}>; title:string; sent:number; opened:number }) {
  const pct = Math.round((opened/sent)*100);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary"/><p className="text-sm font-medium">{title}</p></div>
      <p className="mt-2 font-display text-2xl font-semibold">{opened}<span className="text-sm text-muted-foreground">/{sent} opened</span></p>
      <Progress value={pct} className="mt-2"/>
    </div>
  );
}
function ScheduledRow({ when, what, channel }: { when:string; what:string; channel:string }) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
      <div><p className="font-medium">{what}</p><p className="text-xs text-muted-foreground">{when} · {channel}</p></div>
      <Button size="sm" variant="ghost"><Clock className="mr-1 h-3.5 w-3.5"/>Edit</Button>
    </li>
  );
}
