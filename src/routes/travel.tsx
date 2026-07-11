import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plane, Hotel, MapPin, Cloud, Car, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/travel")({
  head: () => ({ meta: [
    { title: "Travel Center — MelaBridge" },
    { name: "description", content: "Hotels, flights, transportation, weather and guest logistics." },
    { name: "robots", content: "noindex" },
  ]}),
  component: TravelPage,
});

function TravelPage() {
  return (
    <AppShell active="/travel">
      <PageHeader
        eyebrow="Travel Center"
        icon={Plane}
        title={<>Getting <span className="text-gradient">everyone there</span>.</>}
        description="Hotel blocks, flight tracking, transportation, and weather — coordinated so guests just show up."
        actions={<Button variant="hero"><Sparkles className="mr-2 h-4 w-4"/>Draft travel email</Button>}
      />

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <TStat icon={Hotel} label="Hotel rooms booked" value="42/58" tone="info"/>
        <TStat icon={Plane} label="Guest flights tracked" value="31"/>
        <TStat icon={Car} label="Airport pickups" value="18"/>
        <TStat icon={Cloud} label="Forecast · Oct 17" value="72°F · Clear"/>
      </section>

      <Tabs defaultValue="hotels" className="mt-8">
        <TabsList className="flex-wrap">
          <TabsTrigger value="hotels"><Hotel className="mr-1.5 h-3.5 w-3.5"/>Hotels</TabsTrigger>
          <TabsTrigger value="flights"><Plane className="mr-1.5 h-3.5 w-3.5"/>Flights</TabsTrigger>
          <TabsTrigger value="transport"><Car className="mr-1.5 h-3.5 w-3.5"/>Transport</TabsTrigger>
          <TabsTrigger value="maps"><MapPin className="mr-1.5 h-3.5 w-3.5"/>Maps</TabsTrigger>
          <TabsTrigger value="weather"><Cloud className="mr-1.5 h-3.5 w-3.5"/>Weather</TabsTrigger>
        </TabsList>

        <TabsContent value="hotels" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { name:"Villa Serbelloni", role:"Primary block", price:"$420/night", rooms:"30 held" },
              { name:"Hotel Metropole", role:"Overflow", price:"$280/night", rooms:"20 held" },
              { name:"Local B&Bs", role:"Budget option", price:"$120/night", rooms:"8 held" },
            ].map(h=>(
              <div key={h.name} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2"><Hotel className="h-4 w-4 text-primary"/><p className="font-medium">{h.name}</p></div>
                <p className="text-xs text-muted-foreground">{h.role} · {h.price}</p>
                <div className="mt-3 flex items-center justify-between"><Badge className="bg-primary/10 text-primary">{h.rooms}</Badge><Button size="sm" variant="ghost">Share block</Button></div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="flights" className="mt-4">
          <div className="rounded-3xl border border-border bg-card divide-y divide-border">
            {[
              { who:"Priya Rao +1", route:"JFK → MXP", arr:"Oct 15 · 9:20 AM", flight:"DL 260" },
              { who:"Kai Nakamura", route:"HND → MXP", arr:"Oct 16 · 6:45 AM", flight:"NH 203" },
              { who:"Marcus Bell", route:"ORD → MXP", arr:"Oct 15 · 11:15 AM", flight:"AA 132" },
            ].map(f=>(
              <div key={f.who} className="flex items-center justify-between px-5 py-3">
                <div><p className="font-medium">{f.who}</p><p className="text-xs text-muted-foreground">{f.route} · {f.flight}</p></div>
                <div className="text-right"><p className="text-sm">{f.arr}</p><Badge className="bg-emerald-500/10 text-emerald-700">On time</Badge></div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="transport" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {["Airport shuttle · Oct 15 · 6 pickups","Airport shuttle · Oct 16 · 12 pickups","Guest bus to venue · Oct 17 · 3 PM","Late-night return bus · 11 PM"].map(s=>(
              <div key={s} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2"><Car className="h-4 w-4 text-primary"/><p className="font-medium">{s.split(" · ")[0]}</p></div>
                <p className="text-xs text-muted-foreground">{s.split(" · ").slice(1).join(" · ")}</p>
                <Button size="sm" variant="ghost" className="mt-2"><Users className="mr-1 h-3.5 w-3.5"/>Manage riders</Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="maps" className="mt-4">
          <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/5 to-accent/20 p-6 text-center">
            <MapPin className="mx-auto h-10 w-10 text-primary"/>
            <p className="mt-2 font-display text-lg font-semibold">Lake Como, Italy</p>
            <p className="text-sm text-muted-foreground">Venue · Villa del Balbianello · 12 min from primary hotel block</p>
            <div className="mx-auto mt-4 h-56 max-w-2xl rounded-2xl border border-border bg-[repeating-linear-gradient(45deg,theme(colors.muted.DEFAULT)_0_10px,transparent_10px_20px)]"/>
          </div>
        </TabsContent>

        <TabsContent value="weather" className="mt-4">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { d:"Oct 15", t:"70° · Sun" },
              { d:"Oct 16", t:"68° · Partly" },
              { d:"Oct 17", t:"72° · Clear", hi:true },
              { d:"Oct 18", t:"66° · Rain" },
            ].map(w=>(
              <div key={w.d} className={`rounded-2xl border p-4 text-center ${w.hi?"border-primary bg-primary/5":"border-border bg-card"}`}>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{w.d}</p>
                <p className="mt-2 font-display text-2xl font-semibold">{w.t.split(" · ")[0]}</p>
                <p className="text-sm text-muted-foreground">{w.t.split(" · ")[1]}</p>
                {w.hi && <Badge className="mt-2 bg-primary text-primary-foreground">Event day</Badge>}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
function TStat({ icon: Icon, label, value, tone }: { icon:React.ComponentType<{className?:string}>; label:string; value:string; tone?:"info" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between"><Icon className={`h-4 w-4 ${tone==="info"?"text-primary":"text-muted-foreground"}`}/><span className="text-xs text-muted-foreground">{label}</span></div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
