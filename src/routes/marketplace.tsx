import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { PublicShell } from "@/components/public-shell";
import { useAuth } from "@/lib/auth";
import {
  Store,
  Search,
  Star,
  MapPin,
  BadgeCheck,
  Sparkles,
  SlidersHorizontal,
  Heart,
  Share2,
  GitCompare,
  X,
  ExternalLink,
  Plane,
  Globe,
  Clock,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Section } from "@/components/module-page";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createBooking } from "@/lib/bookings.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCompare, useFavorites, useRecentlyViewed } from "@/lib/marketplace-prefs";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — MelaBridge" },
      { name: "description", content: "Discover, compare, and book vetted vendors matched to your event." },
      { property: "og:title", content: "MelaBridge Marketplace" },
      { property: "og:description", content: "Vetted vendors, matched to your event." },
    ],
  }),
  component: MarketplacePage,
});

type VendorRow = {
  id: string;
  business_name: string | null;
  business_category: string | null;
  business_description?: string | null;
  city: string | null;
  state: string | null;
  starting_price: number | null;
  logo_url: string | null;
  onboarding_completed: boolean | null;
  mobile_service?: boolean | null;
  travel_radius?: number | null;
  years_in_business?: number | null;
  website?: string | null;
  portfolio_urls?: string[] | null;
  social_links?: Record<string, string> | null;
  business_hours?: Record<string, string> | null;
};

type Filters = {
  category: string | null;
  city: string;
  maxPrice: number; // 0 = any
  travelOnly: boolean;
  verifiedOnly: boolean;
};

const DEFAULT_FILTERS: Filters = {
  category: null,
  city: "",
  maxPrice: 0,
  travelOnly: false,
  verifiedOnly: false,
};

const PRICE_MAX = 25000;

function MarketplacePage() {
  const { user, loading } = useAuth();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "favorites" | "recent">("all");
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null);

  const favorites = useFavorites();
  const compare = useCompare();
  const recent = useRecentlyViewed();

  const vendorsQ = useQuery({
    queryKey: ["marketplace-vendors"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_profiles_public")
        .select(
          "id, business_name, business_category, business_description, city, state, starting_price, logo_url, onboarding_completed, mobile_service, travel_radius, years_in_business, website, portfolio_urls, social_links, business_hours",
        )
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) throw error;
      return (data ?? []) as VendorRow[];
    },
  });

  const vendors = vendorsQ.data ?? [];
  const activeVendor = useMemo(
    () => vendors.find((v) => v.id === activeVendorId) ?? null,
    [vendors, activeVendorId],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => v.business_category && set.add(v.business_category));
    return Array.from(set).sort();
  }, [vendors]);

  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase();
    return vendors.filter((v) => {
      const name = (v.business_name ?? "").toLowerCase();
      const cat = (v.business_category ?? "").toLowerCase();
      const city = (v.city ?? "").toLowerCase();
      const desc = (v.business_description ?? "").toLowerCase();
      if (s && !(name.includes(s) || cat.includes(s) || city.includes(s) || desc.includes(s))) return false;
      if (filters.category && v.business_category !== filters.category) return false;
      if (filters.city && !city.includes(filters.city.trim().toLowerCase())) return false;
      if (filters.maxPrice > 0 && (v.starting_price ?? 0) > filters.maxPrice) return false;
      if (filters.travelOnly && !v.mobile_service) return false;
      if (filters.verifiedOnly && !v.onboarding_completed) return false;
      return true;
    });
  }, [vendors, query, filters]);

  const visible = useMemo(() => {
    if (tab === "favorites") return filtered.filter((v) => favorites.has(v.id));
    if (tab === "recent") {
      const map = new Map(filtered.map((v) => [v.id, v] as const));
      return recent.list.map((id) => map.get(id)).filter(Boolean) as VendorRow[];
    }
    return filtered;
  }, [filtered, tab, favorites, recent.list]);

  const activeChipCount =
    (filters.category ? 1 : 0) +
    (filters.city ? 1 : 0) +
    (filters.maxPrice > 0 ? 1 : 0) +
    (filters.travelOnly ? 1 : 0) +
    (filters.verifiedOnly ? 1 : 0);

  const openProfile = (v: VendorRow) => {
    setActiveVendorId(v.id);
    recent.push(v.id);
  };

  const share = async (v: VendorRow) => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/marketplace?v=${v.id}` : "";
    const title = v.business_name ?? "MelaBridge vendor";
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (navigator as Navigator).share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) =>
    !loading && !user ? <PublicShell>{children}</PublicShell> : <AppShell active="/marketplace">{children}</AppShell>;

  const compareVendors = useMemo(
    () => compare.list.map((id) => vendors.find((v) => v.id === id)).filter(Boolean) as VendorRow[],
    [compare.list, vendors],
  );

  return (
    <Shell>
      <div className="space-y-6 pb-24">
        <PageHeader
          eyebrow="Marketplace"
          title="Vetted vendors, matched to you"
          description="Search verified vendors across catering, florals, photography, planning, entertainment, and more."
          icon={Store}
          actions={
            <Button asChild className="gap-2 bg-gradient-to-r from-primary to-gold text-primary-foreground">
              <Link to="/concierge">
                <Sparkles className="h-4 w-4" /> AI match
              </Link>
            </Button>
          }
        />

        {/* Sticky search + filter bar */}
        <div className="sticky top-16 z-20 -mx-2 rounded-2xl border border-border/60 bg-background/85 p-2 shadow-soft backdrop-blur sm:top-20 sm:mx-0 sm:p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search vendors, categories, cities…"
                className="h-11 pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search vendors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1 gap-2 sm:flex-none"
                onClick={() => setFiltersOpen(true)}
                aria-label="Open filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeChipCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                    {activeChipCount}
                  </Badge>
                )}
              </Button>
              <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                <TabsList className="h-11">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="favorites" className="text-xs">
                    <Heart className="mr-1 h-3.5 w-3.5" />
                    {favorites.list.length || ""}
                  </TabsTrigger>
                  <TabsTrigger value="recent" className="text-xs">Recent</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {activeChipCount > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1">
              {filters.category && (
                <FilterChip label={filters.category} onClear={() => setFilters((f) => ({ ...f, category: null }))} />
              )}
              {filters.city && (
                <FilterChip label={`in ${filters.city}`} onClear={() => setFilters((f) => ({ ...f, city: "" }))} />
              )}
              {filters.maxPrice > 0 && (
                <FilterChip
                  label={`Under $${filters.maxPrice.toLocaleString()}`}
                  onClear={() => setFilters((f) => ({ ...f, maxPrice: 0 }))}
                />
              )}
              {filters.travelOnly && (
                <FilterChip label="Traveling vendors" onClear={() => setFilters((f) => ({ ...f, travelOnly: false }))} />
              )}
              {filters.verifiedOnly && (
                <FilterChip label="Verified only" onClear={() => setFilters((f) => ({ ...f, verifiedOnly: false }))} />
              )}
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="ml-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        <Section
          title={
            tab === "favorites"
              ? "Your favorites"
              : tab === "recent"
                ? "Recently viewed"
                : "Available vendors"
          }
          description={
            tab === "favorites"
              ? "Vendors you've saved on this device."
              : tab === "recent"
                ? "The last vendors you opened."
                : `${visible.length} of ${vendors.length} shown`
          }
        >
          {vendorsQ.isLoading ? (
            <SkeletonGrid />
          ) : visible.length === 0 ? (
            <EmptyState
              tab={tab}
              hasVendors={vendors.length > 0}
              hasFilters={activeChipCount > 0 || query.trim().length > 0}
              onReset={() => {
                setFilters(DEFAULT_FILTERS);
                setQuery("");
                setTab("all");
              }}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((v) => (
                <VendorCard
                  key={v.id}
                  v={v}
                  favorited={favorites.has(v.id)}
                  compared={compare.has(v.id)}
                  onOpen={() => openProfile(v)}
                  onFavorite={() => favorites.toggle(v.id)}
                  onCompare={() => {
                    const r = compare.toggle(v.id);
                    if (r === "full") toast.info(`You can compare up to ${compare.max} vendors`);
                  }}
                  onShare={() => share(v)}
                />
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Compare tray */}
      {compareVendors.length > 0 && (
        <CompareTray
          vendors={compareVendors}
          onRemove={(id) => compare.remove(id)}
          onClear={() => compare.clear()}
          onOpen={(v) => openProfile(v)}
        />
      )}

      {/* Filters sheet */}
      <FiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        setFilters={setFilters}
        categories={categories}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      {/* Profile sheet */}
      <VendorProfileSheet
        vendor={activeVendor}
        allVendors={vendors}
        favorited={activeVendor ? favorites.has(activeVendor.id) : false}
        onOpenChange={(o) => !o && setActiveVendorId(null)}
        onFavorite={() => activeVendor && favorites.toggle(activeVendor.id)}
        onShare={() => activeVendor && share(activeVendor)}
        onOpenVendor={(v) => openProfile(v)}
        isSignedIn={!!user}
      />
    </Shell>
  );
}

/* -------------------- Small parts -------------------- */

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2.5 py-1 text-xs text-primary">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove filter ${label}`}
        className="rounded-full p-0.5 hover:bg-primary/15"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="overflow-hidden border-border/60 p-0">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({
  tab,
  hasVendors,
  hasFilters,
  onReset,
}: {
  tab: "all" | "favorites" | "recent";
  hasVendors: boolean;
  hasFilters: boolean;
  onReset: () => void;
}) {
  const title =
    tab === "favorites"
      ? "No favorites yet"
      : tab === "recent"
        ? "Nothing recent"
        : hasFilters
          ? "No vendors match your filters"
          : hasVendors
            ? "No vendors match that search"
            : "Marketplace is warming up";
  const description =
    tab === "favorites"
      ? "Tap the heart on any vendor to save them here. Favorites are stored on this device."
      : tab === "recent"
        ? "Open a vendor profile and it'll show up here for quick access."
        : hasFilters
          ? "Try broadening your filters — remove price caps, expand the city, or clear categories."
          : "Be one of the first — invite vendors or set up your own vendor profile.";
  return (
    <Card className="border-dashed p-10 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft">
        <Store className="h-5 w-5" />
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {hasFilters && (
          <Button variant="outline" onClick={onReset}>
            Clear filters
          </Button>
        )}
        <Button asChild variant="hero">
          <Link to="/concierge">
            <Sparkles className="mr-1.5 h-4 w-4" /> Ask MelaAssist
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/vendor-portal">Become a vendor</Link>
        </Button>
      </div>
    </Card>
  );
}

/* -------------------- Vendor card -------------------- */

function VendorCard({
  v,
  favorited,
  compared,
  onOpen,
  onFavorite,
  onCompare,
  onShare,
}: {
  v: VendorRow;
  favorited: boolean;
  compared: boolean;
  onOpen: () => void;
  onFavorite: () => void;
  onCompare: () => void;
  onShare: () => void;
}) {
  const location = [v.city, v.state].filter(Boolean).join(", ");
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden border-border/60 p-0 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Cover */}
      <div className="relative h-32 overflow-hidden bg-gradient-to-br from-primary/25 via-gold/15 to-primary/5">
        {v.logo_url && (
          <img
            src={v.logo_url}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-70 blur-[1px] transition group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/10 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {v.onboarding_completed && (
            <Badge className="gap-1 bg-background/85 text-[10px] font-semibold text-foreground backdrop-blur">
              <BadgeCheck className="h-3 w-3 text-primary" /> Verified
            </Badge>
          )}
        </div>
        <div className="absolute right-3 top-3 flex gap-1">
          <IconAction
            active={favorited}
            label={favorited ? "Remove from favorites" : "Add to favorites"}
            onClick={stop(onFavorite)}
          >
            <Heart className={cn("h-3.5 w-3.5", favorited && "fill-current")} />
          </IconAction>
          <IconAction
            active={compared}
            label={compared ? "Remove from compare" : "Add to compare"}
            onClick={stop(onCompare)}
          >
            <GitCompare className="h-3.5 w-3.5" />
          </IconAction>
          <IconAction label="Share vendor" onClick={stop(onShare)}>
            <Share2 className="h-3.5 w-3.5" />
          </IconAction>
        </div>
        <div className="absolute -bottom-6 left-4 grid h-12 w-12 place-items-center overflow-hidden rounded-xl border-2 border-background bg-background shadow-soft">
          {v.logo_url ? (
            <img src={v.logo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="font-display text-lg font-bold text-primary">
              {(v.business_name ?? "?").charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-8">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold leading-tight">
            {v.business_name ?? "Unnamed vendor"}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {v.business_category ?? "Vendor"}
            {location ? ` · ${location}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1" aria-label="New — no reviews yet">
            <Star className="h-3 w-3" /> New
          </span>
          {v.mobile_service && (
            <span className="inline-flex items-center gap-1">
              <Plane className="h-3 w-3" /> Travels
            </span>
          )}
          {typeof v.years_in_business === "number" && v.years_in_business > 0 && (
            <span>· {v.years_in_business}y in business</span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="min-w-0 text-sm">
            {v.starting_price != null ? (
              <>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">From</span>{" "}
                <span className="font-semibold">${v.starting_price.toLocaleString()}</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Contact for pricing</span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:underline">
            View profile <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Card>
  );
}

function IconAction({
  children,
  onClick,
  label,
  active,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-full border border-border/60 bg-background/85 text-foreground shadow-soft backdrop-blur transition hover:bg-background",
        active && "border-primary/50 bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}

/* -------------------- Filters sheet -------------------- */

function FiltersSheet({
  open,
  onOpenChange,
  filters,
  setFilters,
  categories,
  onReset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filters: Filters;
  setFilters: (u: Filters | ((f: Filters) => Filters)) => void;
  categories: string[];
  onReset: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-4">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {categories.length === 0 && (
                <p className="text-xs text-muted-foreground">Categories appear once vendors list.</p>
              )}
              {categories.map((c) => {
                const active = filters.category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, category: active ? null : c }))}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
                    )}
                    aria-pressed={active}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">City</p>
            <Input
              value={filters.city}
              onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
              placeholder="e.g. Atlanta, Nairobi, Lagos"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Max starting price</p>
              <span className="text-xs font-medium">
                {filters.maxPrice === 0 ? "Any" : `Under $${filters.maxPrice.toLocaleString()}`}
              </span>
            </div>
            <Slider
              value={[filters.maxPrice]}
              min={0}
              max={PRICE_MAX}
              step={500}
              onValueChange={([v]) => setFilters((f) => ({ ...f, maxPrice: v ?? 0 }))}
            />
            <div className="mt-2 flex gap-1.5">
              {[0, 1000, 5000, 15000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, maxPrice: preset }))}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px]",
                    filters.maxPrice === preset
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {preset === 0 ? "Any" : `<$${preset.toLocaleString()}`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <ToggleRow
              label="Traveling vendors only"
              hint="Vendors who serve outside their home city."
              checked={filters.travelOnly}
              onChange={(v) => setFilters((f) => ({ ...f, travelOnly: v }))}
            />
            <ToggleRow
              label="Verified only"
              hint="Vendors who completed BridgeCheck™ onboarding."
              checked={filters.verifiedOnly}
              onChange={(v) => setFilters((f) => ({ ...f, verifiedOnly: v }))}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onReset}>
              Reset
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Show results
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 p-3 text-left transition hover:bg-accent/40"
      aria-pressed={checked}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-background shadow transition",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

/* -------------------- Compare tray -------------------- */

function CompareTray({
  vendors,
  onRemove,
  onClear,
  onOpen,
}: {
  vendors: VendorRow[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onOpen: (v: VendorRow) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="fixed inset-x-0 bottom-4 z-30 mx-auto max-w-4xl px-3">
      <Card className="border-primary/25 bg-background/95 p-3 shadow-elegant backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {vendors.slice(0, 4).map((v) => (
              <button
                key={v.id}
                onClick={() => onOpen(v)}
                title={v.business_name ?? "Vendor"}
                className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border-2 border-background bg-primary/10 text-xs font-semibold text-primary"
              >
                {v.logo_url ? (
                  <img src={v.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (v.business_name ?? "?").charAt(0).toUpperCase()
                )}
              </button>
            ))}
          </div>
          <p className="flex-1 truncate text-sm font-medium">
            Comparing <span className="text-primary">{vendors.length}</span> vendor{vendors.length === 1 ? "" : "s"}
          </p>
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide" : "Compare"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear compare list">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {expanded && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="pb-2">Vendor</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2">City</th>
                  <th className="pb-2">From</th>
                  <th className="pb-2 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className="border-t border-border/50">
                    <td className="py-2 font-medium">
                      <button className="hover:underline" onClick={() => onOpen(v)}>
                        {v.business_name ?? "—"}
                      </button>
                    </td>
                    <td className="py-2 text-muted-foreground">{v.business_category ?? "—"}</td>
                    <td className="py-2 text-muted-foreground">{v.city ?? "—"}</td>
                    <td className="py-2">
                      {v.starting_price != null ? `$${v.starting_price.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => onRemove(v.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${v.business_name ?? "vendor"} from compare`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* -------------------- Vendor profile sheet -------------------- */

function VendorProfileSheet({
  vendor,
  allVendors,
  favorited,
  onOpenChange,
  onFavorite,
  onShare,
  onOpenVendor,
  isSignedIn,
}: {
  vendor: VendorRow | null;
  allVendors: VendorRow[];
  favorited: boolean;
  onOpenChange: (v: boolean) => void;
  onFavorite: () => void;
  onShare: () => void;
  onOpenVendor: (v: VendorRow) => void;
  isSignedIn: boolean;
}) {
  const navigate = useNavigate();
  const saveFn = useServerFn(createBooking);
  const save = useMutation({
    mutationFn: (v: VendorRow) =>
      saveFn({
        data: {
          vendorId: v.id,
          title: v.business_name ?? "New booking",
          category: v.business_category ?? "Vendor",
        },
      }),
    onSuccess: (b: { id: string }) => {
      toast.success("Saved to your bookings");
      onOpenChange(false);
      navigate({ to: "/bookings/$id", params: { id: b.id } });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to save"),
  });

  // Scroll to top when a new vendor opens
  useEffect(() => {
    const el = document.getElementById("vendor-profile-scroll");
    if (el) el.scrollTop = 0;
  }, [vendor?.id]);

  if (!vendor) {
    return (
      <Sheet open={false} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl" />
      </Sheet>
    );
  }

  const location = [vendor.city, vendor.state].filter(Boolean).join(", ");
  const related = allVendors
    .filter((v) => v.id !== vendor.id && v.business_category === vendor.business_category)
    .slice(0, 4);
  const hours =
    vendor.business_hours && typeof vendor.business_hours === "object" && !Array.isArray(vendor.business_hours)
      ? (vendor.business_hours as Record<string, string>)
      : null;
  const social =
    vendor.social_links && typeof vendor.social_links === "object" && !Array.isArray(vendor.social_links)
      ? (vendor.social_links as Record<string, string>)
      : null;

  return (
    <Sheet open={!!vendor} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        id="vendor-profile-scroll"
        className="w-full overflow-y-auto p-0 sm:max-w-2xl"
        aria-describedby={undefined}
      >
        {/* Hero */}
        <div className="relative h-40 bg-gradient-to-br from-primary/30 via-gold/20 to-primary/5 sm:h-52">
          {vendor.logo_url && (
            <img
              src={vendor.logo_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60"
              loading="lazy"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        <div className="-mt-12 space-y-6 px-5 pb-8 sm:px-8">
          <SheetHeader className="space-y-0 text-left">
            <div className="flex flex-wrap items-end gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-background bg-background shadow-elegant">
                {vendor.logo_url ? (
                  <img src={vendor.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-3xl font-bold text-primary">
                    {(vendor.business_name ?? "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="truncate font-display text-2xl font-semibold">
                    {vendor.business_name ?? "Unnamed vendor"}
                  </SheetTitle>
                  {vendor.onboarding_completed && (
                    <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/15">
                      <BadgeCheck className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {vendor.business_category ?? "Vendor"}
                  {location ? ` · ${location}` : ""}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {isSignedIn ? (
                <Button
                  className="gap-1.5"
                  onClick={() => save.mutate(vendor)}
                  disabled={save.isPending}
                >
                  {save.isPending ? "Saving…" : "Save to bookings"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button asChild className="gap-1.5">
                  <Link to="/auth">Sign in to book</Link>
                </Button>
              )}
              <Button variant="outline" onClick={onFavorite} className="gap-1.5">
                <Heart className={cn("h-4 w-4", favorited && "fill-current text-primary")} />
                {favorited ? "Favorited" : "Favorite"}
              </Button>
              <Button variant="outline" onClick={onShare} className="gap-1.5">
                <Share2 className="h-4 w-4" /> Share
              </Button>
              {vendor.website && (
                <Button asChild variant="ghost" className="gap-1.5">
                  <a href={vendor.website} target="_blank" rel="noreferrer">
                    <Globe className="h-4 w-4" /> Website <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Key facts */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label="Starting at" value={vendor.starting_price != null ? `$${vendor.starting_price.toLocaleString()}` : "By quote"} />
            <Fact
              label="Service area"
              value={
                vendor.mobile_service
                  ? vendor.travel_radius
                    ? `${vendor.travel_radius} mi`
                    : "Travels"
                  : "Local"
              }
            />
            <Fact label="Experience" value={typeof vendor.years_in_business === "number" ? `${vendor.years_in_business}y` : "—"} />
            <Fact label="Reviews" value="New" hint="No reviews yet" />
          </div>

          {/* Overview */}
          {vendor.business_description && (
            <ProfileSection title="About">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {vendor.business_description}
              </p>
            </ProfileSection>
          )}

          {/* Gallery */}
          {vendor.portfolio_urls && vendor.portfolio_urls.length > 0 && (
            <ProfileSection title="Gallery">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {vendor.portfolio_urls.slice(0, 9).map((url, i) => (
                  <div key={`${url}-${i}`} className="aspect-square overflow-hidden rounded-xl bg-muted">
                    <img
                      src={url}
                      alt={`${vendor.business_name ?? "Vendor"} portfolio image ${i + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            </ProfileSection>
          )}

          {/* Hours */}
          {hours && Object.keys(hours).length > 0 && (
            <ProfileSection title="Business hours" icon={Clock}>
              <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                {Object.entries(hours).map(([day, val]) => (
                  <div key={day} className="flex justify-between border-b border-border/40 py-1.5">
                    <dt className="font-medium capitalize">{day}</dt>
                    <dd className="text-muted-foreground">{String(val)}</dd>
                  </div>
                ))}
              </dl>
            </ProfileSection>
          )}

          {/* Service area */}
          {(vendor.city || vendor.mobile_service) && (
            <ProfileSection title="Service area" icon={MapPin}>
              <p className="text-sm text-muted-foreground">
                {location && <>Based in {location}. </>}
                {vendor.mobile_service
                  ? vendor.travel_radius
                    ? `Travels up to ${vendor.travel_radius} miles for events.`
                    : "Available for travel."
                  : "Serves the local area."}
              </p>
            </ProfileSection>
          )}

          {/* Social */}
          {social && Object.keys(social).length > 0 && (
            <ProfileSection title="Connect">
              <div className="flex flex-wrap gap-2">
                {Object.entries(social).map(([label, url]) =>
                  url ? (
                    <Button key={label} asChild size="sm" variant="outline" className="gap-1.5">
                      <a href={String(url)} target="_blank" rel="noreferrer">
                        {label} <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  ) : null,
                )}
              </div>
            </ProfileSection>
          )}

          {/* Related */}
          {related.length > 0 && (
            <ProfileSection title="Related vendors">
              <div className="grid gap-2 sm:grid-cols-2">
                {related.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onOpenVendor(r)}
                    className="flex items-center gap-3 rounded-xl border border-border/60 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                      {r.logo_url ? (
                        <img src={r.logo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        (r.business_name ?? "?").charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.business_name ?? "Vendor"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[r.business_category, r.city].filter(Boolean).join(" · ") || "Vendor"}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </ProfileSection>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-base font-semibold">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ProfileSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {title}
      </h3>
      {children}
    </section>
  );
}
