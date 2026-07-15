import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { PublicShell } from "@/components/public-shell";
import { useAuth } from "@/lib/auth";
import { Store, Search, Star, MapPin, BadgeCheck, Sparkles, Filter, Bookmark } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MetricRow, Section } from "@/components/module-page";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createBooking } from "@/lib/bookings.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — MelaBridge" },
      { name: "description", content: "Discover, compare, and book vetted vendors matched to your event." },
    ],
  }),
  component: MarketplacePage,
});

type VendorRow = {
  id: string;
  business_name: string;
  business_category: string;
  city: string | null;
  state: string | null;
  starting_price: number | null;
  logo_url: string | null;
  onboarding_completed: boolean;
};

function MarketplacePage() {
  const { user, loading } = useAuth();
  const [query, setQuery] = useState("");


  const vendorsQ = useQuery({
    queryKey: ["marketplace-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_profiles_public")
        .select("id, business_name, business_category, city, state, starting_price, logo_url, onboarding_completed")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as VendorRow[];
    },
  });

  const vendors = vendorsQ.data ?? [];
  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return vendors;
    return vendors.filter(
      (v) =>
        v.business_name.toLowerCase().includes(s) ||
        v.business_category.toLowerCase().includes(s) ||
        (v.city ?? "").toLowerCase().includes(s),
    );
  }, [vendors, query]);

  const Shell = ({ children }: { children: React.ReactNode }) =>
    !loading && !user ? <PublicShell>{children}</PublicShell> : <AppShell active="/marketplace">{children}</AppShell>;

  return (
    <Shell>

      <div className="space-y-6">
        <PageHeader
          eyebrow="Marketplace"
          title="Vetted vendors, matched to you"
          description="Search verified vendors across catering, florals, photography, planning, entertainment, and more."
          icon={Store}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vendors, categories, cities…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" /> Filters</Button>
          <Button className="gap-2 bg-gradient-to-r from-primary to-gold text-primary-foreground" asChild>
            <Link to="/concierge"><Sparkles className="h-4 w-4" /> AI match</Link>
          </Button>
        </div>
        <MetricRow
          metrics={[
            { label: "Listed vendors", value: vendors.length.toLocaleString() },
            { label: "Verification", value: "BridgeCheck™", hint: "Verified badge" },
            { label: "Categories", value: "20+", hint: "Every event need" },
            { label: "AI matching", value: "On", hint: "Personalized picks" },
          ]}
        />
        <Section title="Available vendors" description="Ranked by recency. Reviews, availability, and AI matching are rolling out.">
          {vendorsQ.isLoading ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">Loading vendors…</Card>
          ) : filtered.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="font-display text-lg font-semibold">No vendors yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {vendors.length === 0
                  ? "Be one of the first — invite vendors or set up your own vendor profile."
                  : "No vendors match that search."}
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button asChild variant="hero"><Link to="/vendor-portal">Become a vendor</Link></Button>
                <Button asChild variant="outline"><Link to="/vendors">Invite vendors</Link></Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((v) => (
                <VendorCard key={v.id} v={v} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </AppShell>
  );
}

function VendorCard({ v }: { v: VendorRow }) {
  const location = [v.city, v.state].filter(Boolean).join(", ");
  const navigate = useNavigate();
  const saveFn = useServerFn(createBooking);
  const save = useMutation({
    mutationFn: () => saveFn({ data: { vendorId: v.id, title: v.business_name, category: v.business_category } }),
    onSuccess: (b: any) => {
      toast.success("Saved to your bookings");
      navigate({ to: "/bookings/$id", params: { id: b.id } });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });
  return (
    <Card className="overflow-hidden border-border/60 shadow-soft transition hover:shadow-elegant">
      <div
        className="h-24 bg-gradient-to-br from-primary/20 via-gold/20 to-transparent bg-cover bg-center"
        style={v.logo_url ? { backgroundImage: `url(${v.logo_url})` } : undefined}
      />
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              {v.business_name}
              <BadgeCheck className="h-3.5 w-3.5 text-primary" />
            </p>
            <p className="text-xs text-muted-foreground">{v.business_category}</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {location && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{location}</span>
          )}
          {v.starting_price != null && (
            <span className="inline-flex items-center gap-1"><Star className="h-3 w-3" />From ${v.starting_price.toLocaleString()}</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">View profile</Button>
          <Button size="sm" className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
            <Bookmark className="mr-1 h-3.5 w-3.5" />
            {save.isPending ? "Saving…" : "Save vendor"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
