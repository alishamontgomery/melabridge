import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/app-shell";
import { PublicShell } from "@/components/public-shell";
import { useAuth, type CompatibleUser } from "@/lib/auth";
import {
  Store,
  Search,
  Star,
  MapPin,
  BadgeCheck,
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
  HandHelping,
  UserPlus,
  CheckCircle2,
  Loader2,
  CalendarDays,
  Sparkles,
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
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn, ensureAbsoluteUrl } from "@/lib/utils";
import { getVendorServiceTypes, vendorOffersCategory } from "@/lib/vendor-categories";
import { getCategorySpec, type CatFieldDef } from "@/lib/vendor-category-fields";
import {
  formatActiveCategoryFilter,
  getPackageSpecChips,
  hasCategoryDetails,
  loadAllMarketplacePackages,
  matchesCategoryFilters,
  removeCategoryFilter,
  shouldShowExternalFallback,
  type CategoryFilters,
  type CategoryFilterValue,
} from "@/lib/marketplace-category-filtering";
import { useRole } from "@/lib/use-role";
import { useCompare, useMarketplaceFavorites, useRecentlyViewed } from "@/lib/marketplace-prefs";
import { useActiveEvent, type EventRow } from "@/lib/use-active-event";
import {
  createVendorSourcingRequest,
  listMyVendorSourcingRequests,
  type GoogleVendorMatch,
  type VendorMatch,
  type VendorSourcingRequest,
} from "@/lib/vendor-sourcing.functions";
import { getKnownPostalLocation, isPostalCode } from "@/lib/marketplace-location";
import { requestExternalVendorClaim } from "@/lib/vendor-claims.functions";
import { trackEvent } from "@/lib/analytics";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — MelaBridge" },
      { name: "description", content: "Discover event vendors by category, location, profile, and package." },
      { property: "og:title", content: "MelaBridge Marketplace" },
      { property: "og:description", content: "Browse event vendors and explore their profiles and packages." },
    ],
  }),
  component: MarketplacePage,
});

type VendorRow = {
  id: string;
  business_name: string | null;
  business_category: string | null;
  business_categories: string[] | null;
  custom_service_types: string[] | null;
  business_description?: string | null;
  city: string | null;
  state: string | null;
  zip_code?: string | null;
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

type MarketplacePackage = {
  vendor_id: string;
  service_category: string | null;
  category_fields: Record<string, unknown> | null;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
};

type Filters = {
  category: string | null;
  city: string;
  maxPrice: number; // 0 = any
  travelOnly: boolean;
  completeOnly: boolean;
  categoryDetails: CategoryFilters;
};

const DEFAULT_FILTERS: Filters = {
  category: null,
  city: "",
  maxPrice: 0,
  travelOnly: false,
  completeOnly: false,
  categoryDetails: {},
};

const PRICE_MAX = 25000;
const RADIUS_OPTIONS = [10, 25, 50, 100] as const;
type RadiusMiles = (typeof RADIUS_OPTIONS)[number];
const MARKETPLACE_SEARCH_STORAGE_KEY = "melabridge.marketplace.search";

type MarketplaceSearchDraft = {
  query: string;
  locationQuery: string;
  radiusMiles: RadiusMiles;
};

function readMarketplaceSearchDraft(): MarketplaceSearchDraft {
  const fallback: MarketplaceSearchDraft = { query: "", locationQuery: "", radiusMiles: 25 };
  if (typeof window === "undefined") return fallback;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(MARKETPLACE_SEARCH_STORAGE_KEY) ?? "null") as Partial<MarketplaceSearchDraft> | null;
    const radiusMiles = saved?.radiusMiles;
    return {
      query: typeof saved?.query === "string" ? saved.query : fallback.query,
      locationQuery: typeof saved?.locationQuery === "string" ? saved.locationQuery : fallback.locationQuery,
      radiusMiles: typeof radiusMiles === "number" && RADIUS_OPTIONS.includes(radiusMiles as RadiusMiles)
        ? radiusMiles as RadiusMiles
        : fallback.radiusMiles,
    };
  } catch {
    return fallback;
  }
}

function hasGoogleSearchIntent(search: MarketplaceSearchState) {
  const location = search.locationQuery.trim();
  return (
    (isPostalCode(location) && location.length === 5) ||
    (!/^\d+$/.test(location) && (
      search.query.trim().length >= 2 ||
      location.length >= 2
    ))
  );
}

const MARKETPLACE_VENDOR_SELECT =
  "id, business_name, business_category, business_categories, custom_service_types, business_description, city, state, zip_code, starting_price, logo_url, onboarding_completed, mobile_service, travel_radius, years_in_business, website, portfolio_urls, social_links, business_hours";

function normalizeMarketplaceSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function fetchMarketplaceVendors(signal?: AbortSignal) {
  const query = supabase
    .from("vendor_profiles_public")
    .select(MARKETPLACE_VENDOR_SELECT)
    .limit(1000);
  const result = signal ? await query.abortSignal(signal) : await query;
  if (result.error) throw result.error;
  return (result.data ?? []) as VendorRow[];
}

async function fetchMarketplaceGoogleResults(
  search: MarketplaceSearchState,
  filters: Pick<Filters, "category" | "city">,
  signal: AbortSignal,
  pageState?: string | null,
) {
  const params = new URLSearchParams();
  if (search.query.trim()) params.set("query", search.query.trim());
  if (filters.category) params.set("category", filters.category);
  if (search.locationQuery.trim() || filters.city.trim()) {
    params.set("location", search.locationQuery.trim() || filters.city.trim());
  }
  params.set("radiusMiles", String(search.radiusMiles));
  if (pageState) params.set("pageState", pageState);

  const response = await fetch(`/api/public/marketplace/google?${params.toString()}`, {
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error("Google vendor search is unavailable.");
  return response.json() as Promise<{
    configured: boolean;
    results: GoogleVendorMatch[];
    nextPageState: string | null;
  }>;
}

function dedupeGoogleResults(results: GoogleVendorMatch[]) {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  return results
    .filter((place) => {
      const normalizedName = place.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const normalizedAddress = (place.address ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const nameAddress = `${normalizedName}|${normalizedAddress}`;
      if (seenIds.has(place.id) || seenNames.has(nameAddress)) return false;
      seenIds.add(place.id);
      seenNames.add(nameAddress);
      return true;
    })
    .sort((a, b) => (a.distanceMiles ?? Number.POSITIVE_INFINITY) - (b.distanceMiles ?? Number.POSITIVE_INFINITY));
}

type NativeSearchState = {
  requestId: number;
  status: "loading" | "success" | "error";
  vendors: VendorRow[];
  error: unknown;
};

type GoogleSearchState = {
  requestId: number;
  status: "loading" | "success" | "error";
  configured: boolean;
  results: GoogleVendorMatch[];
  nextPageState: string | null;
  error: unknown;
};

const MarketplaceSearchInput = memo(function MarketplaceSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const keepFocusRef = useRef(false);
  const typingRef = useRef(false);
  const restoreTimersRef = useRef<number[]>([]);

  const restoreFocus = () => {
    if (!typingRef.current || !inputRef.current) return;
    const activeElement = document.activeElement;
    if (activeElement && activeElement !== document.body && activeElement !== inputRef.current) return;
    inputRef.current.focus({ preventScroll: true });
  };

  const scheduleFocusRestore = () => {
    restoreTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    restoreTimersRef.current = [0, 40, 120, 260].map((delay) =>
      window.setTimeout(() => {
        restoreFocus();
        if (delay === 260) typingRef.current = false;
      }, delay),
    );
  };

  useLayoutEffect(() => {
    if (keepFocusRef.current) scheduleFocusRestore();
  }, [value]);

  useEffect(() => {
    const liveValue = inputRef.current?.value ?? value;
    if (liveValue !== value) onChange(liveValue);
    // Capture any text entered into the server-rendered input before React
    // hydrated it; do not overwrite that first live DOM value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        placeholder="Service or category"
        className="h-11 pl-9"
        defaultValue={value}
        onFocus={() => {
          keepFocusRef.current = true;
        }}
        onChange={(event) => {
          typingRef.current = true;
          onChange(event.target.value);
          scheduleFocusRestore();
        }}
        aria-label="Search vendors"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            if (inputRef.current) inputRef.current.value = "";
            onChange("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});

type MarketplaceSearchState = MarketplaceSearchDraft;

function MarketplaceShell({
  loading,
  user,
  children,
}: {
  loading: boolean;
  user: unknown;
  children: React.ReactNode;
}) {
  // Marketplace is public. Do not render AppShell while Clerk is resolving:
  // AppShell redirects any unresolved signed-out state to /auth, which can
  // remount this page in the middle of a ZIP entry.
  return user ? (
    <AppShell active="/marketplace">{children}</AppShell>
  ) : (
    <PublicShell>{children}</PublicShell>
  );
}

function MarketplacePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const requestClaim = useServerFn(requestExternalVendorClaim);
  const { role } = useRole();
  const isVendor = role === "vendor";
  const { event: activeEvent } = useActiveEvent();
  const [initialSearch] = useState(readMarketplaceSearchDraft);
  const [query, setQuery] = useState(initialSearch.query);
  const [locationQuery, setLocationQuery] = useState(initialSearch.locationQuery);
  const [radiusMiles, setRadiusMiles] = useState<RadiusMiles>(initialSearch.radiusMiles);
  const searchRequestIdRef = useRef(0);
  const latestNativeRequestIdRef = useRef(0);
  const latestGoogleRequestIdRef = useRef(0);
  const activeNativeControllerRef = useRef<AbortController | null>(null);
  const activeGoogleControllerRef = useRef<AbortController | null>(null);
  const latestGoogleSearchRef = useRef<MarketplaceSearchState | null>(null);
  const latestGoogleFiltersRef = useRef<Pick<Filters, "category" | "city">>(DEFAULT_FILTERS);
  const googlePageStateHistoryRef = useRef<Set<string>>(new Set());
  const googlePageRequestsRef = useRef(0);
  const [nativeSearchState, setNativeSearchState] = useState<NativeSearchState | null>(null);
  const [googleSearchState, setGoogleSearchState] = useState<GoogleSearchState | null>(null);
  const [googlePageLoading, setGooglePageLoading] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const radiusSelectRef = useRef<HTMLSelectElement>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "favorites" | "recent">("all");
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null);
  const [claimingExternalId, setClaimingExternalId] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        MARKETPLACE_SEARCH_STORAGE_KEY,
        JSON.stringify({ query, locationQuery, radiusMiles }),
      );
    } catch {
      // sessionStorage may be blocked; the in-memory search still works.
    }
  }, [locationQuery, query, radiusMiles]);

  // The server-rendered search controls can receive input before React has
  // hydrated. Keep that DOM input instead of letting controlled values erase
  // it, then reconcile the live values into React state after hydration.
  useEffect(() => {
    const liveLocation = locationInputRef.current?.value ?? locationQuery;
    const liveRadius = Number(radiusSelectRef.current?.value);
    const nextRadius = RADIUS_OPTIONS.includes(liveRadius as RadiusMiles)
      ? liveRadius as RadiusMiles
      : radiusMiles;

    if (liveLocation !== locationQuery) setLocationQuery(liveLocation);
    if (nextRadius !== radiusMiles) setRadiusMiles(nextRadius);
  }, []);

  const persistSearchDraft = (draft: MarketplaceSearchDraft) => {
    try {
      window.sessionStorage.setItem(MARKETPLACE_SEARCH_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // sessionStorage may be blocked; the in-memory search still works.
    }
  };

  const updateQuery = (value: string) => {
    setQuery(value);
    persistSearchDraft({ query: value, locationQuery, radiusMiles });
  };

  const updateLocationQuery = (value: string) => {
    if (locationInputRef.current && locationInputRef.current.value !== value) {
      locationInputRef.current.value = value;
    }
    setLocationQuery(value);
    persistSearchDraft({ query, locationQuery: value, radiusMiles });
  };

  const updateRadiusMiles = (value: RadiusMiles) => {
    const liveLocation = locationInputRef.current?.value ?? locationQuery;
    if (liveLocation !== locationQuery) setLocationQuery(liveLocation);
    if (radiusSelectRef.current && radiusSelectRef.current.value !== String(value)) {
      radiusSelectRef.current.value = String(value);
    }
    setRadiusMiles(value);
    persistSearchDraft({ query, locationQuery: liveLocation, radiusMiles: value });
  };

  const startMarketplaceSearch = useCallback((
    search: MarketplaceSearchState,
    filterSnapshot: Pick<Filters, "category" | "city">,
  ) => {
    const requestId = ++searchRequestIdRef.current;
    activeNativeControllerRef.current?.abort();
    activeGoogleControllerRef.current?.abort();

    const nativeController = new AbortController();
    const googleController = new AbortController();
    activeNativeControllerRef.current = nativeController;
    activeGoogleControllerRef.current = googleController;
    latestNativeRequestIdRef.current = requestId;
    latestGoogleRequestIdRef.current = requestId;
    latestGoogleSearchRef.current = search;
    latestGoogleFiltersRef.current = filterSnapshot;
    googlePageStateHistoryRef.current = new Set();
    googlePageRequestsRef.current = 0;
    setGooglePageLoading(false);

    // Start both source requests before awaiting or settling either one.
    const nativeRequest = fetchMarketplaceVendors(nativeController.signal);
    const googleRequest = hasGoogleSearchIntent(search)
      ? fetchMarketplaceGoogleResults(search, filterSnapshot, googleController.signal)
      : Promise.resolve({
          configured: true,
          results: [] as GoogleVendorMatch[],
          nextPageState: null,
        });

    setNativeSearchState({
      requestId,
      status: "loading",
      vendors: [],
      error: null,
    });
    setGoogleSearchState({
      requestId,
      status: "loading",
      configured: true,
      results: [],
      error: null,
    });

    void nativeRequest.then((vendors) => {
      if (latestNativeRequestIdRef.current !== requestId) return;
      setNativeSearchState({ requestId, status: "success", vendors, error: null });
    }).catch((error: unknown) => {
      if (latestNativeRequestIdRef.current !== requestId) return;
      setNativeSearchState({ requestId, status: "error", vendors: [], error });
    });

    void googleRequest.then((result) => {
      if (latestGoogleRequestIdRef.current !== requestId) return;
      setGoogleSearchState({
        requestId,
        status: "success",
        configured: result.configured,
        results: result.results,
        nextPageState: result.nextPageState,
        error: null,
      });
    }).catch((error: unknown) => {
      if (latestGoogleRequestIdRef.current !== requestId) return;
      setGoogleSearchState({
        requestId,
        status: "error",
        configured: false,
        results: [],
        nextPageState: null,
        error,
      });
    });
  }, []);

  const submitSearch = () => {
    const liveQuery = typeof document !== "undefined"
      ? document.querySelector<HTMLInputElement>('input[aria-label="Search vendors"]')?.value ?? query
      : query;
    const liveLocation = locationInputRef.current?.value ?? locationQuery;
    const liveRadius = Number(radiusSelectRef.current?.value);
    const nextRadius = RADIUS_OPTIONS.includes(liveRadius as RadiusMiles)
      ? liveRadius as RadiusMiles
      : radiusMiles;
    const nextSearch = { query: liveQuery, locationQuery: liveLocation, radiusMiles: nextRadius };
    setQuery(liveQuery);
    setLocationQuery(liveLocation);
    setRadiusMiles(nextRadius);
    startMarketplaceSearch(nextSearch, { category: filters.category, city: filters.city });
    trackEvent("marketplace_search_submitted", {
      has_service: liveQuery.trim().length > 0,
      has_location: liveLocation.trim().length > 0,
      radius_miles: nextRadius,
    });
    persistSearchDraft(nextSearch);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key === "Enter" &&
      (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)
    ) {
      event.preventDefault();
      event.stopPropagation();
      submitSearch();
    }
  };

  const vendorsQ = useQuery({
    queryKey: ["marketplace-vendors"],
    staleTime: 60_000,
    retry: false,
    queryFn: () => fetchMarketplaceVendors(),
  });

  const packagesQ = useQuery({
    queryKey: ["marketplace-package-category-fields", (vendorsQ.data ?? []).map((vendor) => vendor.id)],
    enabled: (vendorsQ.data?.length ?? 0) > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const vendorIds = (vendorsQ.data ?? []).map((vendor) => vendor.id);
      return loadAllMarketplacePackages<MarketplacePackage>(async (from, to) => {
        const { data, error } = await supabase
          .from("vendor_packages")
          .select("vendor_id, service_category, category_fields, is_featured, sort_order, created_at")
          .in("vendor_id", vendorIds)
          .order("is_featured", { ascending: false })
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
          .range(from, to);
        if (error) throw error;
        return (data ?? []) as MarketplacePackage[];
      });
    },
  });

  const favorites = useMarketplaceFavorites(user?.id, vendorsQ.data ?? []);
  const compare = useCompare();
  const recent = useRecentlyViewed();

  const vendors = useMemo(
    () => nativeSearchState
      ? nativeSearchState.status === "success" ? nativeSearchState.vendors : []
      : vendorsQ.data ?? [],
    [nativeSearchState, vendorsQ.data],
  );
  const activeVendor = useMemo(
    () => vendors.find((v) => v.id === activeVendorId) ?? null,
    [vendors, activeVendorId],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => getVendorServiceTypes(v).forEach((category) => set.add(category)));
    return Array.from(set).sort();
  }, [vendors]);

  const packagesByVendor = useMemo(() => {
    const grouped = new Map<string, MarketplacePackage[]>();
    for (const pkg of packagesQ.data ?? []) {
      const current = grouped.get(pkg.vendor_id) ?? [];
      current.push(pkg);
      grouped.set(pkg.vendor_id, current);
    }
    return grouped;
  }, [packagesQ.data]);

  const filtered = useMemo(() => {
    const postalLocation = getKnownPostalLocation(locationQuery);
    const postalSearch = isPostalCode(locationQuery);
    const s = normalizeMarketplaceSearchText(query);
    const locationText = normalizeMarketplaceSearchText(locationQuery);
    const requestedZip = postalSearch ? locationQuery.trim().slice(0, 5) : null;
    return vendors.filter((v) => {
      const name = normalizeMarketplaceSearchText(v.business_name);
      const cat = normalizeMarketplaceSearchText(getVendorServiceTypes(v).join(" "));
      const city = normalizeMarketplaceSearchText(v.city);
      const desc = normalizeMarketplaceSearchText(v.business_description);
      const website = normalizeMarketplaceSearchText(v.website);
      if (s && !(name.includes(s) || cat.includes(s) || city.includes(s) || desc.includes(s) || website.includes(s))) return false;
      if (
        postalLocation &&
        v.zip_code?.trim().slice(0, 5) !== requestedZip &&
        !city.includes(normalizeMarketplaceSearchText(postalLocation.label.split(",")[0]))
      ) return false;
      if (locationText && !postalSearch && !city.includes(locationText)) return false;
      if (filters.category && !vendorOffersCategory(v, filters.category)) return false;
      if (filters.city && !city.includes(filters.city.trim().toLowerCase())) return false;
      if (filters.maxPrice > 0 && (v.starting_price ?? 0) > filters.maxPrice) return false;
      if (filters.travelOnly && !v.mobile_service) return false;
      if (filters.completeOnly && !v.onboarding_completed) return false;
      if (
        filters.category &&
        Object.keys(filters.categoryDetails).length > 0 &&
        !(packagesByVendor.get(v.id) ?? []).some((pkg) => {
          const packageCategory = pkg.service_category ?? v.business_category;
          return (
            packageCategory?.toLowerCase() === filters.category?.toLowerCase() &&
            matchesCategoryFilters(pkg.category_fields ?? {}, filters.categoryDetails)
          );
        })
      ) return false;
      return true;
    });
  }, [vendors, query, locationQuery, filters, packagesByVendor]);

  /** Organic quality score — no paid/sponsored signals. */
  const rankScore = useCallback((v: VendorRow): number => {
    let s = 0;
    if (v.onboarding_completed) s += 30;       // complete profile
    if (v.logo_url) s += 15;                   // has logo
    if ((v.business_description?.length ?? 0) >= 100) s += 15; // rich description
    if ((v.portfolio_urls?.length ?? 0) >= 3) s += 20;         // portfolio photos
    if ((v.portfolio_urls?.length ?? 0) >= 1) s += 5;
    if (v.starting_price != null) s += 10;     // transparent pricing
    if (typeof v.years_in_business === "number" && v.years_in_business > 0) s += 5;
    return s;
  }, []);

  /**
   * Search relevance is intentionally query-driven, not business-name-driven.
   * Exact service and ZIP matches should lead a local search, while profile
   * quality remains the tie-breaker. Native profiles still render before
   * external Google results.
   */
  const searchRelevanceScore = useCallback((v: VendorRow): number => {
    let score = rankScore(v);
    const normalizedQuery = normalizeMarketplaceSearchText(query);
    const normalizedName = normalizeMarketplaceSearchText(v.business_name);
    const serviceTypes = getVendorServiceTypes(v).map((value) =>
      normalizeMarketplaceSearchText(value),
    );
    const normalizedLocation = normalizeMarketplaceSearchText(locationQuery);
    const postalLocation = getKnownPostalLocation(locationQuery);

    if (normalizedQuery) {
      if (serviceTypes.some((service) => service === normalizedQuery)) score += 240;
      else if (serviceTypes.some((service) => service.includes(normalizedQuery) || normalizedQuery.includes(service))) {
        score += 150;
      } else if (normalizedName === normalizedQuery) {
        score += 1_000;
      } else if (normalizedName.includes(normalizedQuery)) {
        score += 90;
      }
    }

    if (normalizedLocation) {
      const vendorZip = v.zip_code?.trim().slice(0, 5);
      const requestedZip = isPostalCode(normalizedLocation) ? normalizedLocation.slice(0, 5) : null;
      const vendorCity = normalizeMarketplaceSearchText(v.city);
      const requestedCity = postalLocation?.label.split(",")[0].trim().toLowerCase() ?? normalizedLocation;

      if (requestedZip && vendorZip === requestedZip) score += 300;
      else if (postalLocation && vendorCity === requestedCity) score += 150;
      else if (!requestedZip && vendorCity.includes(normalizedLocation)) score += 150;
    }

    return score;
  }, [locationQuery, query, rankScore]);

  const visible = useMemo(() => {
    if (tab === "favorites") return filtered.filter((v) => favorites.has(v.id));
    if (tab === "recent") {
      const map = new Map(filtered.map((v) => [v.id, v] as const));
      return recent.list.map((id) => map.get(id)).filter(Boolean) as VendorRow[];
    }
    return [...filtered].sort((a, b) => searchRelevanceScore(b) - searchRelevanceScore(a));
  }, [filtered, tab, favorites, recent.list, searchRelevanceScore]);

  const nativeLoading = nativeSearchState ? nativeSearchState.status === "loading" : vendorsQ.isLoading;
  const nativeError = nativeSearchState ? nativeSearchState.status === "error" : vendorsQ.isError;
  const googleLoading = googleSearchState?.status === "loading";
  const googleConfigured = googleSearchState?.configured !== false;
  const googleResults = googleSearchState?.results ?? [];
  const visibleGoogleResults = googleResults;
  const categoryDetailsActive = hasCategoryDetails(filters.categoryDetails);
  const showGoogleFallback = shouldShowExternalFallback(
    tab,
    visible.length,
    googleResults.length,
    categoryDetailsActive,
  );
  const showMarketplaceSkeleton = nativeLoading && googleResults.length === 0;

  const retryNativeVendors = () => {
    if (!nativeSearchState) {
      void vendorsQ.refetch();
      return;
    }

    const requestId = nativeSearchState.requestId;
    activeNativeControllerRef.current?.abort();
    const controller = new AbortController();
    activeNativeControllerRef.current = controller;
    latestNativeRequestIdRef.current = requestId;
    setNativeSearchState({
      requestId,
      status: "loading",
      vendors: [],
      error: null,
    });

    void fetchMarketplaceVendors(controller.signal).then((nextVendors) => {
      if (latestNativeRequestIdRef.current !== requestId) return;
      setNativeSearchState({ requestId, status: "success", vendors: nextVendors, error: null });
    }).catch((error: unknown) => {
      if (latestNativeRequestIdRef.current !== requestId) return;
      setNativeSearchState({ requestId, status: "error", vendors: [], error });
    });
  };

  const activeChipCount =
    (filters.category ? 1 : 0) +
    (filters.city || locationQuery ? 1 : 0) +
    (filters.maxPrice > 0 ? 1 : 0) +
    (filters.travelOnly ? 1 : 0) +
    (filters.completeOnly ? 1 : 0) +
    Object.keys(filters.categoryDetails).length;

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
        await window.navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  const claimExternal = async (place: GoogleVendorMatch) => {
    if (!user) {
      toast.info("Sign in to request ownership of this listing.");
      navigate({ to: "/auth", search: { next: typeof window !== "undefined" ? window.location.pathname : "/marketplace" } });
      return;
    }
    setClaimingExternalId(place.id);
    try {
      const result = await requestClaim({
        data: {
          source: "google_places",
          externalId: place.id.replace(/^google-/, ""),
          businessName: place.name,
          websiteUri: place.websiteUri,
          googleMapsUri: place.googleMapsUri!,
        },
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else if (result.ownershipVerified) {
        toast.success("Ownership evidence recorded. Your claim is pending admin review and does not grant a Verified badge.");
      } else {
        toast.info("Claim request saved for manual review. It does not grant a Verified badge.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't submit that claim request.");
    } finally {
      setClaimingExternalId(null);
    }
  };

  const loadMoreGoogleResults = async () => {
    const current = googleSearchState;
    const search = latestGoogleSearchRef.current;
    if (!current?.nextPageState || !search || googlePageLoading) return;
    if (googlePageRequestsRef.current >= 3 || googlePageStateHistoryRef.current.has(current.nextPageState)) {
      setGoogleSearchState((previous) =>
        previous?.requestId === current.requestId ? { ...previous, nextPageState: null } : previous,
      );
      return;
    }

    const requestId = latestGoogleRequestIdRef.current;
    const controller = new AbortController();
    activeGoogleControllerRef.current?.abort();
    activeGoogleControllerRef.current = controller;
    googlePageRequestsRef.current += 1;
    googlePageStateHistoryRef.current.add(current.nextPageState);
    setGooglePageLoading(true);
    try {
      const result = await fetchMarketplaceGoogleResults(
        search,
        latestGoogleFiltersRef.current,
        controller.signal,
        current.nextPageState,
      );
      if (latestGoogleRequestIdRef.current !== requestId) return;
       const mergedResults = dedupeGoogleResults([...googleResults, ...result.results]);
       const addedNewBusinesses = mergedResults.length > googleResults.length;
       const nextPageState =
         addedNewBusinesses &&
         result.nextPageState &&
         !googlePageStateHistoryRef.current.has(result.nextPageState) &&
         googlePageRequestsRef.current < 3
           ? result.nextPageState
           : null;
      setGoogleSearchState((previous) =>
        previous?.requestId === requestId
          ? {
              ...previous,
              status: "success",
              configured: result.configured,
              results: mergedResults,
               nextPageState,
              error: null,
            }
          : previous,
      );
      trackEvent("marketplace_results_expanded", {
        source: "google",
         result_count: mergedResults.length,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (latestGoogleRequestIdRef.current !== requestId) return;
      setGoogleSearchState((previous) =>
        previous?.requestId === requestId
          ? { ...previous, status: "error", error }
          : previous,
      );
    } finally {
      if (latestGoogleRequestIdRef.current === requestId) setGooglePageLoading(false);
    }
  };

  const compareVendors = useMemo(
    () => compare.list.map((id) => vendors.find((v) => v.id === id)).filter(Boolean) as VendorRow[],
    [compare.list, vendors],
  );

  return (
    <MarketplaceShell loading={loading} user={user}>
      <div className="space-y-6 pb-24">
        <PageHeader
          eyebrow="Marketplace"
          title="Find vendors for your event"
          description="Browse vendor profiles across catering, florals, photography, planning, entertainment, and more."
          icon={Store}
          actions={undefined}
        />

        {/* Sticky search + filter bar */}
        <div
          role="search"
          onKeyDown={handleSearchKeyDown}
          className="sticky top-16 z-20 -mx-2 rounded-2xl border border-border/60 bg-background/85 p-2 shadow-soft backdrop-blur sm:top-20 sm:mx-0 sm:p-3"
        >
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto_auto] sm:items-end">
            <MarketplaceSearchInput value={query} onChange={updateQuery} />
            <label className="relative block">
              <span className="sr-only">Search by ZIP code or city</span>
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ZIP code or city"
                className="h-11 pl-9 pr-9"
                ref={locationInputRef}
                defaultValue={initialSearch.locationQuery}
                onChange={(event) => updateLocationQuery(event.target.value)}
                aria-label="Search by ZIP code or city"
                inputMode="search"
              />
              {locationQuery && (
                <button
                  type="button"
                  onClick={() => updateLocationQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Clear location search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
            <label className="flex h-11 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
              <span className="whitespace-nowrap text-xs text-muted-foreground">Within</span>
              <select
                ref={radiusSelectRef}
                defaultValue={initialSearch.radiusMiles}
                onChange={(event) => updateRadiusMiles(Number(event.target.value) as RadiusMiles)}
                className="min-w-0 flex-1 bg-transparent font-medium outline-none"
                aria-label="Search radius in miles"
              >
                {RADIUS_OPTIONS.map((miles) => (
                  <option key={miles} value={miles}>{miles} miles</option>
                ))}
              </select>
            </label>
            <Button type="button" onClick={submitSearch} className="h-11 w-full gap-2 sm:w-auto">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            Search a service and location together. MelaBridge profiles appear before clearly labeled Google results.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
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
                <FilterChip label={filters.category} onClear={() => setFilters((f) => ({ ...f, category: null, categoryDetails: {} }))} />
              )}
              {filters.category && Object.entries(filters.categoryDetails).map(([key, value]) => {
                const field = getCategorySpec(filters.category)?.fields.find((item) => item.key === key);
                if (!field) return null;
                return (
                  <FilterChip
                    key={key}
                    label={formatActiveCategoryFilter(field, value)}
                    onClear={() => setFilters((current) => ({
                      ...current,
                      categoryDetails: removeCategoryFilter(current.categoryDetails, key),
                    }))}
                  />
                );
              })}
              {filters.city && (
                <FilterChip label={`in ${filters.city}`} onClear={() => setFilters((f) => ({ ...f, city: "" }))} />
              )}
              {locationQuery && (
                <FilterChip
                  label={`near ${locationQuery} · ${radiusMiles} mi`}
                  onClear={() => updateLocationQuery("")}
                />
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
              {filters.completeOnly && (
                <FilterChip label="Complete profiles" onClear={() => setFilters((f) => ({ ...f, completeOnly: false }))} />
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
          {filters.category && getCategorySpec(filters.category) && (
            <div className="mt-3 hidden border-t border-border/60 px-1 pt-3 md:block">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Refine {filters.category} packages
              </p>
              <div className="grid gap-3 lg:grid-cols-3">
                {getCategorySpec(filters.category)!.fields
                  .filter((field) => field.kind !== "text" && field.kind !== "backdrop_picker")
                  .map((field) => (
                    <CategoryFilterControl
                      key={field.key}
                      field={field}
                      value={filters.categoryDetails[field.key]}
                      compact
                      onChange={(value) =>
                        setFilters((current) => ({
                          ...current,
                          categoryDetails:
                            value == null
                              ? removeCategoryFilter(current.categoryDetails, field.key)
                              : { ...current.categoryDetails, [field.key]: value },
                        }))
                      }
                    />
                  ))}
              </div>
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
              ? user ? "Vendors you've saved across all your devices." : "Vendors you've saved on this device."
              : tab === "recent"
                ? "The last vendors you opened."
              : visible.length > 0 || googleResults.length > 0
                ? `${visible.length} MelaBridge vendor${visible.length === 1 ? "" : "s"} shown${showGoogleFallback ? ` · ${googleResults.length} Google result${googleResults.length === 1 ? "" : "s"}` : ""}`
                : query.trim() || locationQuery.trim()
                  ? "No published MelaBridge vendors matched this search"
                  : "No published MelaBridge vendors yet · Search local businesses above"
          }
        >
          {showMarketplaceSkeleton || (categoryDetailsActive && packagesQ.isLoading && googleResults.length === 0) ? (
            <SkeletonGrid />
          ) : categoryDetailsActive && packagesQ.isError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
              <p className="font-semibold text-destructive">Could not load package details</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your category filters have not been applied. Retry before relying on these results.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => packagesQ.refetch()}>
                Retry package filters
              </Button>
            </div>
          ) : visible.length === 0 && !showGoogleFallback ? (
            nativeError ? (
              <div className="space-y-6" role="status" aria-live="polite">
                <NativeVendorError onRetry={retryNativeVendors} />
                {googleLoading && <p className="text-center text-sm text-muted-foreground">Searching Google for matching businesses…</p>}
              </div>
            ) : (
              <EmptyState
                tab={tab}
                hasVendors={vendors.length > 0}
                  hasFilters={activeChipCount > 0 || query.trim().length > 0 || locationQuery.trim().length > 0}
                isVendor={isVendor}
                onReset={() => {
                  setFilters(DEFAULT_FILTERS);
                  updateQuery("");
                  updateLocationQuery("");
                  updateRadiusMiles(25);
                  setTab("all");
                }}
              />
            )
          ) : (
            <div className="space-y-6">
              {nativeError && (
                <div role="status" aria-live="polite">
                  <NativeVendorError onRetry={retryNativeVendors} />
                </div>
              )}
              {nativeLoading && googleResults.length > 0 && (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                  Local MelaBridge profiles are still loading. Google results are shown independently.
                </div>
              )}
              {visible.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((v) => (
                    <VendorCard
                      key={v.id}
                      v={v}
                       packages={packagesByVendor.get(v.id) ?? []}
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
              {showGoogleFallback && (
                <GoogleFallbackSection
                  results={visibleGoogleResults}
                  hasMore={googleResults.length > visibleGoogleResults.length || !!googleSearchState?.nextPageState}
                  loadingMore={googlePageLoading}
                  onShowMore={loadMoreGoogleResults}
                  claimingId={claimingExternalId}
                  onClaim={claimExternal}
                />
              )}
              {visible.length === 0 && (query.trim() || locationQuery.trim()) && (
                <MissingNativeVendorNotice
                  user={user}
                  isVendor={isVendor}
                  query={query}
                  locationQuery={locationQuery}
                />
              )}
              {!googleConfigured && visible.length < 6 && (
                <p className="text-center text-xs text-muted-foreground">
                  More local vendors will appear as businesses join MelaBridge. External search is not configured for this workspace.
                </p>
              )}
            </div>
          )}
        </Section>

        <SourcingWorkspace
          user={user}
          isVendor={isVendor}
          activeEvent={activeEvent}
          prominent={visible.length === 0}
        />
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
      />
    </MarketplaceShell>
  );
}

/* -------------------- Small parts -------------------- */

function GoogleFallbackSection({
  results,
  hasMore,
  loadingMore,
  onShowMore,
  claimingId,
  onClaim,
}: {
  results: GoogleVendorMatch[];
  hasMore: boolean;
  loadingMore: boolean;
  onShowMore: () => void;
  claimingId: string | null;
  onClaim: (place: GoogleVendorMatch) => void;
}) {
  return (
    <section className="space-y-3" aria-label="Google vendor results">
      <div className="flex flex-wrap items-end justify-between gap-2 border-t border-border/60 pt-5">
        <div>
          <h3 className="font-display text-lg font-semibold">More places from Google</h3>
          <p className="text-xs text-muted-foreground">
            Native MelaBridge vendors appear first. These external results are provided by Google and are not MelaBridge profiles.
          </p>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">Google results</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((place) => (
          <Card key={place.id} className="min-w-0 border-border/60 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Globe className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-semibold">{place.name}</h4>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {place.address ?? "Service-area business · address not publicly listed"}
                </p>
                {place.distanceMiles != null && (
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {place.distanceMiles < 10 ? place.distanceMiles.toFixed(1) : Math.round(place.distanceMiles)} mi away
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {place.websiteUri && (
                    <a
                      href={ensureAbsoluteUrl(place.websiteUri) ?? undefined}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Visit business website <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <a
                    href={place.googleMapsUri ?? undefined}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Open Google listing <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-8 px-0 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onClaim(place)}
                  disabled={claimingId === place.id}
                >
                  {claimingId === place.id ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
                  Claim this business
                </Button>
              </div>
            </div>
            <p className="mt-3 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
              Powered by Google · External listing
            </p>
          </Card>
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center pt-1">
          <Button type="button" variant="outline" onClick={onShowMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loadingMore ? "Loading more results…" : "Show more Google results"}
          </Button>
        </div>
      )}
    </section>
  );
}

function MissingNativeVendorNotice({
  user,
  isVendor,
  query,
  locationQuery,
}: {
  user: CompatibleUser | null;
  isVendor: boolean;
  query: string;
  locationQuery: string;
}) {
  const googleSearchText = [query.trim(), locationQuery.trim()].filter(Boolean).join(" ");
  const googleSearchUrl = googleSearchText
    ? `https://www.google.com/search?q=${encodeURIComponent(googleSearchText)}`
    : null;

  return (
    <Card className="border-primary/20 bg-primary/[0.035] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <h3 className="font-display text-lg font-semibold">Don’t see the business you searched for?</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Google Search can show service-area businesses that Places does not return as a Marketplace result. Open Google’s business search for the exact query, or create a native MelaBridge profile so the business appears here directly.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {googleSearchUrl && (
            <a
              href={googleSearchUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition hover:bg-accent"
            >
              Open Google business search <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {!user ? (
            <Button asChild className="gap-2">
              <Link to="/auth" search={{ type: "vendor", intent: "signup", next: "/vendor-profile-builder" }}>
                Create a vendor profile <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : isVendor ? (
            <Button asChild className="gap-2">
              <Link to="/vendor-profile-builder">
                Complete your profile <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function NativeVendorError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-destructive">Local MelaBridge vendors are temporarily unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Google results are shown separately. Retry to load native profiles.
          </p>
        </div>
        <Button variant="outline" onClick={onRetry}>Retry local vendors</Button>
      </div>
    </div>
  );
}

function SourcingWorkspace({
  user,
  isVendor,
  activeEvent,
  prominent,
}: {
  user: { id: string } | null;
  isVendor: boolean;
  activeEvent: EventRow | null;
  prominent: boolean;
}) {
  type FormState = {
    category: string;
    vendorName: string;
    contactEmail: string;
    contactPhone: string;
    website: string;
    location: string;
    budgetRange: string;
    notes: string;
  };
  const [dialog, setDialog] = useState<"concierge" | "private_vendor" | null>(null);
  const [matchedVendors, setMatchedVendors] = useState<VendorMatch[]>([]);
  const [matchNoticeOpen, setMatchNoticeOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    category: "",
    vendorName: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    location: "",
    budgetRange: "",
    notes: "",
  });
  const requestsQ = useQuery({
    queryKey: ["my-vendor-sourcing-requests"],
    queryFn: () => listMyVendorSourcingRequests(),
    enabled: Boolean(user) && !isVendor,
  });
  const [saving, setSaving] = useState(false);

  const open = (kind: "concierge" | "private_vendor") => {
    setForm({
      category: "",
      vendorName: "",
      contactEmail: "",
      contactPhone: "",
      website: "",
      location: activeEvent ? [activeEvent.location, activeEvent.venue_city, activeEvent.venue_state].filter(Boolean).join(", ") : "",
      budgetRange: "",
      notes: "",
    });
    setDialog(kind);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !dialog) {
      toast.error("Choose an event you own before saving this vendor need.");
      return;
    }
    setSaving(true);
    try {
      const result = await createVendorSourcingRequest({
        data: {
          eventId: activeEvent.id,
          requestType: dialog,
          category: form.category,
          vendorName: form.vendorName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          website: form.website,
          location: form.location,
          budgetRange: form.budgetRange,
          notes: form.notes,
        },
      });
      trackEvent("vendor_sourcing_request_created", {
        request_type: dialog,
        matched_vendors: result.matches.length,
      });
      if (dialog === "concierge" && result.matches.length > 0) {
        setMatchedVendors(result.matches);
        setMatchNoticeOpen(true);
        toast.success(`${result.matches.length} matching vendor${result.matches.length === 1 ? "" : "s"} found`);
      } else if (dialog === "concierge") {
        toast.success("Vendor need saved — we'll notify you when a match is published");
      } else {
        toast.success("Known vendor saved privately to your event");
      }
      setDialog(null);
      requestsQ.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't save that request. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (isVendor) {
    return (
      <Card className="relative overflow-hidden border-primary/20 bg-primary/[0.035] p-5 sm:p-7">
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">For founding vendors</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">Be visible when the right event is looking.</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Complete your public profile to appear in marketplace search. MelaBridge does not claim to vet or recommend vendors who have not completed onboarding.
            </p>
          </div>
          <Button asChild className="shrink-0 gap-2">
            <Link to="/vendor-profile-builder">Build your vendor profile <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className={cn("border-border/70 bg-card p-5 sm:p-7", prominent && "border-primary/25 bg-primary/[0.035]")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold">Need a vendor?</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Tell us what you’re looking for, or add a vendor you already know to your event.</p>
          </div>
           <div className="flex shrink-0 flex-col gap-2 sm:items-end">
             <Button asChild><Link to="/auth">Sign in to continue <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
             <Button asChild variant="outline" size="sm">
               <Link to="/auth" search={{ type: "vendor", intent: "signup", next: "/vendor-profile-builder" }}>
                 Create a vendor profile
               </Link>
             </Button>
           </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn("overflow-hidden border-primary/20 bg-primary/[0.035] p-0", prominent && "shadow-elegant")}>
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative p-5 sm:p-7">
            <div className="absolute -left-12 -top-16 h-44 w-44 rounded-full bg-gold/20 blur-3xl" />
            <div className="relative">
              <h2 className="font-display text-2xl font-semibold">Need a vendor?</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Tell us what you’re looking for, or add a vendor you already know to your event.</p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => open("concierge")} disabled={!activeEvent} className="justify-start gap-2 sm:justify-center">
                  <HandHelping className="h-4 w-4" /> Request a vendor
                </Button>
                <Button onClick={() => open("private_vendor")} disabled={!activeEvent} variant="outline" className="justify-start gap-2 sm:justify-center">
                  <UserPlus className="h-4 w-4" /> Add a vendor
                </Button>
              </div>
              {!activeEvent && (
                <p className="mt-3 text-xs text-muted-foreground">
                   Create an event first to save a vendor need.{" "}
                  <Link to="/events/new" className="font-medium text-primary underline-offset-2 hover:underline">
                    Create event
                  </Link>
                </p>
              )}
              {activeEvent && <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Saving to <strong className="font-medium text-foreground">{activeEvent.name}</strong></p>}
            </div>
          </div>
          <div className="border-t border-primary/10 bg-background/45 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between">
               <p className="font-display text-lg font-semibold">Your saved vendor needs</p>
              {requestsQ.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {requestsQ.isError ? <p className="mt-4 text-sm text-destructive">We couldn't load your saved vendor needs.</p> : requestsQ.data?.length ? (
              <div className="mt-4 space-y-2">
                {requestsQ.data.slice(0, 3).map((r) => <RequestRow key={r.id} request={r} />)}
              </div>
            ) : <p className="mt-4 text-sm leading-6 text-muted-foreground">Your saved needs will appear here.</p>}
          </div>
        </div>
      </Card>
      <SourcingDialog open={dialog} onOpenChange={setDialog} form={form} setForm={setForm} onSubmit={submit} saving={saving} activeEvent={activeEvent} />
      <Dialog open={matchNoticeOpen} onOpenChange={setMatchNoticeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Matching vendors are available</DialogTitle>
            <DialogDescription>These published marketplace vendors match the category and location you requested.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {matchedVendors.map((vendor) => (
              <Link
                key={vendor.id}
                to="/vendor-profile/$vendorId"
                params={{ vendorId: vendor.id }}
                onClick={() => setMatchNoticeOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-border/70 p-3 transition hover:border-primary/40 hover:bg-muted/30"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/10 text-primary">
                  {vendor.logo_url ? <img src={vendor.logo_url} alt="" className="h-full w-full object-cover" /> : <Store className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{vendor.business_name ?? "Vendor"}</p>
                  <p className="truncate text-xs text-muted-foreground">{[getVendorServiceTypes(vendor).join(", "), vendor.city, vendor.state].filter(Boolean).join(" · ")}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RequestRow({ request }: { request: VendorSourcingRequest }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><CheckCircle2 className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{request.vendor_name || request.category}</p><p className="mt-0.5 text-xs text-muted-foreground">{request.request_type === "private_vendor" ? "Saved privately to this event" : "We'll notify you when a matching vendor is available"}</p></div>
      <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(request.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
    </div>
  );
}

function SourcingDialog({
  open, onOpenChange, form, setForm, onSubmit, saving, activeEvent,
}: {
  open: "concierge" | "private_vendor" | null;
  onOpenChange: (value: "concierge" | "private_vendor" | null) => void;
  form: {
    category: string;
    vendorName: string;
    contactEmail: string;
    contactPhone: string;
    website: string;
    location: string;
    budgetRange: string;
    notes: string;
  };
  setForm: React.Dispatch<React.SetStateAction<{
    category: string;
    vendorName: string;
    contactEmail: string;
    contactPhone: string;
    website: string;
    location: string;
    budgetRange: string;
    notes: string;
  }>>;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  activeEvent: EventRow | null;
}) {
  const isPrivate = open === "private_vendor";
  const field = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open={Boolean(open)} onOpenChange={(value) => !value && onOpenChange(null)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{isPrivate ? "Add a known vendor" : "Request a vendor"}</DialogTitle><DialogDescription>{isPrivate ? "Keep a trusted contact attached to your event without publishing them to the marketplace." : "We'll show matching published vendors now and notify you when a qualified match becomes available later."}</DialogDescription></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">Event: <strong className="text-foreground">{activeEvent?.name}</strong></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Category *<Input className="mt-1.5" required value={form.category} onChange={(e) => field("category", e.target.value)} placeholder="Photography, catering…" /></label>
            {isPrivate && <label className="text-sm font-medium">Vendor or business name *<Input className="mt-1.5" required value={form.vendorName} onChange={(e) => field("vendorName", e.target.value)} placeholder="Business name" /></label>}
            {isPrivate && <label className="text-sm font-medium">Email<Input className="mt-1.5" type="email" value={form.contactEmail} onChange={(e) => field("contactEmail", e.target.value)} placeholder="hello@example.com" /></label>}
            {isPrivate && <label className="text-sm font-medium">Phone<Input className="mt-1.5" type="tel" value={form.contactPhone} onChange={(e) => field("contactPhone", e.target.value)} /></label>}
            <label className="text-sm font-medium">Location<Input className="mt-1.5" value={form.location} onChange={(e) => field("location", e.target.value)} placeholder="City or service area" /></label>
            <label className="text-sm font-medium">Budget range<Input className="mt-1.5" value={form.budgetRange} onChange={(e) => field("budgetRange", e.target.value)} placeholder="e.g. $2,000–$4,000" /></label>
          </div>
          {isPrivate && <label className="block text-sm font-medium">Website<Input className="mt-1.5" type="url" value={form.website} onChange={(e) => field("website", e.target.value)} placeholder="https://…" /></label>}
          <label className="block text-sm font-medium">Notes<Textarea className="mt-1.5 min-h-24" value={form.notes} onChange={(e) => field("notes", e.target.value)} placeholder={isPrivate ? "Anything your team should remember…" : "Date, guest count, style, or what good looks like…"} /></label>
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isPrivate ? "Save private contact" : "Find matching vendors"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
  isVendor,
  onReset,
}: {
  tab: "all" | "favorites" | "recent";
  hasVendors: boolean;
  hasFilters: boolean;
  isVendor?: boolean;
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
             : "Search local businesses to get started";
  const description =
    tab === "favorites"
      ? "Tap the heart on any vendor to save them here. Favorites are stored on this device."
      : tab === "recent"
        ? "Open a vendor profile and it'll show up here for quick access."
        : hasFilters
          ? "Try broadening your filters — remove price caps, expand the city, or clear categories."
           : !hasVendors && !hasFilters
             ? "No published MelaBridge profiles are available yet. Enter a service and ZIP or city above to search local Google businesses too, or add a vendor you already know below."
             : isVendor
            ? "Complete your vendor profile below to become one of the first businesses listed."
             : "Try broadening your search, or add a vendor you already know below.";
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
      </div>
    </Card>
  );
}

/* -------------------- Vendor card -------------------- */

function VendorCard({
  v,
  packages,
  favorited,
  compared,
  onOpen,
  onFavorite,
  onCompare,
  onShare,
}: {
  v: VendorRow;
  packages: MarketplacePackage[];
  favorited: boolean;
  compared: boolean;
  onOpen: () => void;
  onFavorite: () => void;
  onCompare: () => void;
  onShare: () => void;
}) {
  const location = [v.city, v.state].filter(Boolean).join(", ");
  const specChips = getPackageSpecChips(packages, v.business_category);
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
              <BadgeCheck className="h-3 w-3 text-primary" /> Profile complete
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
            {getVendorServiceTypes(v).join(" · ") || "Vendor"}
            {location ? ` · ${location}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1" aria-label="New vendor profile">
            <Sparkles className="h-3 w-3" /> New profile
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

        {specChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Package highlights">
            {specChips.map((chip) => (
              <Badge key={chip} variant="secondary" className="text-[10px] font-medium">
                {chip}
              </Badge>
            ))}
          </div>
        )}

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
  const categorySpec = getCategorySpec(filters.category);
  const setCategory = (category: string | null) =>
    setFilters((current) => ({ ...current, category, categoryDetails: {} }));

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
                    onClick={() => setCategory(active ? null : c)}
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

          {categorySpec && (
            <div className="space-y-4 border-y border-border/60 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {filters.category} details
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Results match at least one package with all selected details.
                </p>
              </div>
              {categorySpec.fields
                .filter((field) => field.kind !== "text" && field.kind !== "backdrop_picker")
                .map((field) => (
                  <CategoryFilterControl
                    key={field.key}
                    field={field}
                    value={filters.categoryDetails[field.key]}
                    onChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        categoryDetails:
                          value == null
                            ? removeCategoryFilter(current.categoryDetails, field.key)
                            : { ...current.categoryDetails, [field.key]: value },
                      }))
                    }
                  />
                ))}
            </div>
          )}

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
              label="Complete profiles only"
              hint="Vendors who finished their public marketplace profile."
              checked={filters.completeOnly}
              onChange={(v) => setFilters((f) => ({ ...f, completeOnly: v }))}
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

function CategoryFilterControl({
  field,
  value,
  onChange,
  compact = false,
}: {
  field: CatFieldDef;
  value: CategoryFilterValue | undefined;
  onChange: (value: CategoryFilterValue | undefined) => void;
  compact?: boolean;
}) {
  if (field.kind === "number") {
    return (
      <label className={cn("block text-sm font-medium", compact && "max-w-xs")}>
        {field.label}
        <div className="relative mt-1.5">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={typeof value === "number" ? value : ""}
            onChange={(event) => {
              const next = event.target.valueAsNumber;
              onChange(Number.isFinite(next) && next > 0 ? next : undefined);
            }}
            placeholder={field.placeholder}
            className={field.suffix ? "pr-16" : undefined}
          />
          {field.suffix && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {field.suffix}
            </span>
          )}
        </div>
      </label>
    );
  }

  if (field.kind === "toggle") {
    if (compact) {
      return (
        <button
          type="button"
          aria-pressed={value === true}
          onClick={() => onChange(value === true ? undefined : true)}
          className={cn(
            "h-fit w-fit rounded-full border px-3 py-1.5 text-xs transition",
            value === true
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
          )}
        >
          {field.label}
        </button>
      );
    }
    return (
      <ToggleRow
        label={field.label}
        hint="Only show packages where this is included."
        checked={value === true}
        onChange={(checked) => onChange(checked ? true : undefined)}
      />
    );
  }

  const selected = Array.isArray(value) ? value : [];
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{field.label}</p>
      <div className="flex flex-wrap gap-1.5">
        {(field.options ?? []).map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => {
                const next = active
                  ? selected.filter((item) => item !== option)
                  : [...selected, option];
                onChange(next.length > 0 ? next : undefined);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
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
                    <td className="py-2 text-muted-foreground">{getVendorServiceTypes(v).join(" · ") || "—"}</td>
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
}: {
  vendor: VendorRow | null;
  allVendors: VendorRow[];
  favorited: boolean;
  onOpenChange: (v: boolean) => void;
  onFavorite: () => void;
  onShare: () => void;
  onOpenVendor: (v: VendorRow) => void;
}) {
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
    .filter((v) => v.id !== vendor.id && getVendorServiceTypes(v).some((category) => getVendorServiceTypes(vendor).includes(category)))
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
                      <BadgeCheck className="h-3 w-3" /> Profile complete
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getVendorServiceTypes(vendor).join(" · ") || "Vendor"}
                  {location ? ` · ${location}` : ""}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild className="gap-1.5">
                <Link to="/vendor-profile/$vendorId" params={{ vendorId: vendor.id }}>
                  View profile &amp; inquire
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" onClick={onFavorite} className="gap-1.5">
                <Heart className={cn("h-4 w-4", favorited && "fill-current text-primary")} />
                {favorited ? "Favorited" : "Favorite"}
              </Button>
              <Button variant="outline" onClick={onShare} className="gap-1.5">
                <Share2 className="h-4 w-4" /> Share
              </Button>
              {ensureAbsoluteUrl(vendor.website) && (
                <Button asChild variant="ghost" className="gap-1.5">
                  <a href={ensureAbsoluteUrl(vendor.website)!} target="_blank" rel="noreferrer">
                    <Globe className="h-4 w-4" /> Website <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Key facts */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                {Object.entries(social).map(([label, url]) => {
                  const href = ensureAbsoluteUrl(String(url));
                  return href ? (
                    <Button key={label} asChild size="sm" variant="outline" className="gap-1.5">
                      <a href={href} target="_blank" rel="noreferrer">
                        {label} <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  ) : null;
                })}
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
                        {[getVendorServiceTypes(r).join(", "), r.city].filter(Boolean).join(" · ") || "Vendor"}
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
