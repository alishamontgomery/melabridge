import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Store, Search, Star, MapPin, BadgeCheck, Sparkles, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MetricRow, Section } from "@/components/module-page";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — MelaBridge" },
      { name: "description", content: "Discover, compare, and book vetted vendors matched to your event." },
    ],
  }),
  component: MarketplacePage,
});

const VENDORS = [
  { n: "Aurora Blooms", cat: "Florist", loc: "Lagos, NG", rating: 4.9, jobs: 128, price: "$$", verified: true, tag: "Concierge match" },
  { n: "Studio Nine Photo", cat: "Photography", loc: "Accra, GH", rating: 4.8, jobs: 214, price: "$$$", verified: true },
  { n: "Chef Nia Kitchen", cat: "Catering", loc: "Nairobi, KE", rating: 4.9, jobs: 96, price: "$$", verified: true, tag: "Rising" },
  { n: "The Sound Room", cat: "DJ & Live", loc: "Lagos, NG", rating: 4.7, jobs: 302, price: "$$" },
  { n: "Threaded Weddings", cat: "Planner", loc: "Cape Town, ZA", rating: 5.0, jobs: 48, price: "$$$", verified: true },
  { n: "GoldLeaf Décor", cat: "Décor", loc: "Abuja, NG", rating: 4.6, jobs: 174, price: "$" },
];

function MarketplacePage() {
  return (
    <AppShell active="/marketplace">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Marketplace"
          title="Vetted vendors, matched to you"
          description="Search 12,000+ verified vendors across catering, florals, photography, planning, entertainment, and more."
          icon={Store}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search vendors, categories, cities…" className="pl-9" />
          </div>
          <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" /> Filters</Button>
          <Button className="gap-2 bg-gradient-to-r from-primary to-gold text-primary-foreground"><Sparkles className="h-4 w-4" /> AI match</Button>
        </div>
        <MetricRow
          metrics={[
            { label: "Vetted vendors", value: "12,480" },
            { label: "Verified", value: "9,203", hint: "BridgeCheck™" },
            { label: "Avg. response", value: "1.4h" },
            { label: "Booked via MelaBridge", value: "48k" },
          ]}
        />
        <Section title="Recommended for your event" description="Ranked by fit, availability, and past events like yours.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VENDORS.map((v) => (
              <Card key={v.n} className="overflow-hidden border-border/60 shadow-soft transition hover:shadow-elegant">
                <div className="h-24 bg-gradient-to-br from-primary/20 via-gold/20 to-transparent" />
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        {v.n}
                        {v.verified && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}
                      </p>
                      <p className="text-xs text-muted-foreground">{v.cat} · {v.price}</p>
                    </div>
                    {v.tag && <Badge variant="secondary" className="text-[10px]">{v.tag}</Badge>}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-gold text-gold" /> {v.rating} · {v.jobs} jobs</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {v.loc}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1">View</Button>
                    <Button size="sm" className="flex-1">Request quote</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
