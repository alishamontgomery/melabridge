import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { vendorOffersCategory } from "@/lib/vendor-categories";
import { distanceMilesBetween, getKnownPostalLocation, isPostalCode } from "@/lib/marketplace-location";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || null);

const VendorSourcingInput = z
  .object({
    eventId: z.string().uuid(),
    requestType: z.enum(["concierge", "private_vendor"]),
    category: z.string().trim().min(1, "Choose a vendor category").max(100),
    vendorName: optionalText(160),
    contactEmail: z
      .union([z.string().trim().email("Enter a valid email address").max(255), z.literal("")])
      .optional()
      .transform((value) => value || null),
    contactPhone: optionalText(40),
    website: z
      .union([z.string().trim().url("Enter a complete website URL").max(500), z.literal("")])
      .optional()
      .transform((value) => value || null),
    location: optionalText(180),
    budgetRange: optionalText(120),
    notes: optionalText(2000),
  })
  .superRefine((value, context) => {
    if (value.requestType === "private_vendor" && !value.vendorName) {
      context.addIssue({
        code: "custom",
        path: ["vendorName"],
        message: "Enter the vendor's business or contact name",
      });
    }
  });

export type VendorMatch = {
  id: string;
  business_name: string | null;
  business_category: string | null;
  business_categories: string[] | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  starting_price: number | null;
};

export type VendorSourcingRequest = {
  id: string;
  event_id: string;
  request_type: "concierge" | "private_vendor";
  category: string;
  vendor_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  location: string | null;
  budget_range: string | null;
  notes: string | null;
  status: "new" | "in_progress" | "matched" | "closed";
  created_at: string;
  matches?: VendorMatch[];
};

export type GoogleVendorMatch = {
  id: string;
  name: string;
  address: string | null;
  websiteUri: string | null;
  googleMapsUri: string | null;
  distanceMiles: number | null;
  source: "google";
};

export type GoogleBusinessUrlIdentity = {
  externalId: string;
  name: string;
};

type GooglePageState = {
  tokens: Record<string, string>;
  pageCounts?: Record<string, number>;
  seenTokens?: Record<string, string[]>;
  seenBusinesses?: Record<string, string[]>;
};

const GOOGLE_MAX_PAGES_PER_TERM = 3;
const GOOGLE_QUERY_EXPANSIONS: Array<{ matches: string[]; terms: string[] }> = [
  {
    matches: ["photo booth", "photobooth"],
    terms: ["photo booth", "photobooth", "360 photo booth", "photo booth rental"],
  },
  {
    matches: ["balloon"],
    terms: ["balloon artist", "balloon decor", "party decorator", "event decorator", "balloons"],
  },
  {
    matches: ["photography", "photographer"],
    terms: ["event photographer", "wedding photographer", "portrait photographer"],
  },
  {
    matches: ["videography", "videographer"],
    terms: ["event videographer", "wedding videographer", "videography"],
  },
  {
    matches: ["dj"],
    terms: ["DJ", "wedding DJ", "event DJ"],
  },
  {
    matches: ["mc", "host", "emcee"],
    terms: ["event emcee", "event host", "master of ceremonies"],
  },
  {
    matches: ["venue"],
    terms: ["event venue", "wedding venue", "party venue"],
  },
  {
    matches: ["catering", "caterer"],
    terms: ["event catering", "wedding catering", "caterer"],
  },
  {
    matches: ["food truck"],
    terms: ["food truck", "mobile catering", "event food truck"],
  },
  {
    matches: ["cake", "dessert", "bakery"],
    terms: ["custom cake", "cake decorator", "dessert catering", "bakery"],
  },
  {
    matches: ["bartend", "bar service"],
    terms: ["mobile bartending", "event bartending", "bar service"],
  },
  {
    matches: ["florist", "floral"],
    terms: ["event florist", "wedding florist", "floral designer"],
  },
  {
    matches: ["event decor", "decorator", "party decor"],
    terms: ["event decorator", "party decorator", "wedding decor", "event decor"],
  },
  {
    matches: ["rental"],
    terms: ["party rentals", "event rentals", "tent rentals"],
  },
  {
    matches: ["planner", "planning"],
    terms: ["event planner", "wedding planner", "party planner"],
  },
  {
    matches: ["officiant"],
    terms: ["wedding officiant", "ceremony officiant", "marriage officiant"],
  },
  {
    matches: ["transportation", "limo", "limousine", "party bus"],
    terms: ["event transportation", "limousine service", "party bus"],
  },
  {
    matches: ["security"],
    terms: ["event security", "party security", "security service"],
  },
  {
    matches: ["entertainment"],
    terms: ["event entertainment", "live entertainment", "party entertainment"],
  },
  {
    matches: ["hair", "makeup", "beauty"],
    terms: ["event hair and makeup", "bridal hair and makeup", "makeup artist"],
  },
  {
    matches: ["invitation", "stationery"],
    terms: ["event invitations", "wedding invitations", "stationery designer"],
  },
];

function normalizeGoogleText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const GOOGLE_RETAIL_PLACE_TYPES = new Set([
  "department store",
  "discount store",
  "drugstore",
  "electronics store",
  "furniture store",
  "home goods store",
  "home improvement store",
  "market",
  "shopping mall",
  "shopping center",
  "sporting goods store",
  "supermarket",
  "warehouse store",
  "wholesaler",
]);

const GOOGLE_RETAIL_NAME_MARKERS = [
  "store",
  "shop",
  "supercenter",
  "superstore",
  "mall",
  "market",
  "outlet",
  "warehouse",
  "department",
  "wholesale",
  "retail",
  "crafts",
];

const GOOGLE_SERVICE_INTENT_MARKERS = [
  "artist",
  "cater",
  "decor",
  "designer",
  "entertain",
  "florist",
  "makeup",
  "photograph",
  "planner",
  "rental",
  "service",
  "videograph",
];

const GOOGLE_SERVICE_NAME_MARKERS = [
  "artist",
  "balloon",
  "cater",
  "decor",
  "designer",
  "event",
  "floral",
  "party",
  "photograph",
  "planner",
  "rental",
  "service",
  "studio",
  "videograph",
];

function hasNormalizedMarker(value: string, markers: string[]) {
  return markers.some((marker) => value.includes(marker));
}

/**
 * Text Search often returns large retailers for broad event-service terms.
 * Keep those listings for an explicitly retail-oriented query, but do not
 * present them as service providers when the user asked for an artist,
 * decorator, planner, photographer, or another service business.
 */
export function shouldIncludeGooglePlace(
  place: { name: string; types?: string[]; primaryType?: string },
  query?: string,
  category?: string,
) {
  const requested = normalizeGoogleText([query, category].filter(Boolean).join(" "));
  const serviceSearch = hasNormalizedMarker(requested, GOOGLE_SERVICE_INTENT_MARKERS);
  if (!serviceSearch) return true;

  const name = normalizeGoogleText(place.name);
  const types = [...(place.types ?? []), place.primaryType]
    .filter(Boolean)
    .map((type) => normalizeGoogleText(type));
  const isRetailPlace = types.some((type) => GOOGLE_RETAIL_PLACE_TYPES.has(type));
  if (!isRetailPlace) return true;

  if (hasNormalizedMarker(name, GOOGLE_RETAIL_NAME_MARKERS)) return false;
  return hasNormalizedMarker(name, GOOGLE_SERVICE_NAME_MARKERS);
}

function googleBusinessIdentity(place: { id: string; name: string; address: string | null }) {
  const name = normalizeGoogleText(place.name);
  const address = normalizeGoogleText(place.address);
  return `id:${place.id}|name:${name}|address:${address}`;
}

export function googleSearchTerms(query: string | undefined, category: string | undefined) {
  const requested = [query, category].filter(Boolean).join(" ").trim();
  const normalized = normalizeGoogleText(requested);
  const expansion = GOOGLE_QUERY_EXPANSIONS.find(({ matches }) =>
    matches.some((match) => normalized.includes(normalizeGoogleText(match))),
  );
  if (!expansion) return requested ? [requested] : ["event services"];

  // A multi-word query can be a specific business name that also contains a
  // service term, for example "Capture a Perfect Memory Photo Booth". Keep
  // the exact name search first so Google can return that business instead of
  // only the generic photo-booth expansion terms.
  const exactNameSearch = isLikelyBusinessNameSearch(query, category) && query?.trim()
    ? [query.trim()]
    : [];
  return Array.from(new Set([...exactNameSearch, ...expansion.terms]));
}

export function isGooglePlaceWithinSearchRadius(
  place: { distanceMiles: number | null },
  hasLocationBias: boolean,
  radiusMiles: number,
) {
  // Google can return service-area businesses without a public address or
  // coordinates. The location bias has already been sent to Google, so keep
  // those businesses instead of treating a private home address as "outside"
  // the requested radius.
  return !hasLocationBias || place.distanceMiles == null || place.distanceMiles <= radiusMiles;
}

export function parseGoogleBusinessSearchUrl(value: string): GoogleBusinessUrlIdentity | null {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "share.google" && !hostname.endsWith(".google.com")) return null;
    const externalId = url.searchParams.get("kgmid") ?? url.searchParams.get("placeid");
    const name = url.searchParams.get("q")?.trim();
    if (!externalId || !name) return null;
    return { externalId, name };
  } catch {
    return null;
  }
}

async function resolveGoogleBusinessSearchUrl(value: string): Promise<GoogleBusinessUrlIdentity | null> {
  const direct = parseGoogleBusinessSearchUrl(value);
  if (direct) return direct;
  if (!/^https?:\/\//i.test(value.trim())) return null;

  try {
    const response = await fetch(value.trim(), {
      redirect: "follow",
      signal: AbortSignal.timeout(4000),
    });
    return parseGoogleBusinessSearchUrl(response.url);
  } catch {
    return null;
  }
}

type LinkedGoogleVendorProfile = {
  id: string;
  business_name: string | null;
  business_category: string | null;
  business_categories: string[] | null;
  custom_service_types: string[] | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  website: string | null;
  social_links: Record<string, string> | null;
};

function isGoogleListingUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "share.google" || hostname.endsWith(".google.com");
  } catch {
    return false;
  }
}

function isGenericLocalBusinessQuery(value: string) {
  const normalized = normalizeGoogleText(value);
  return !normalized || /(^|\s)(business|businesses|vendor|vendors|local|near me)(\s|$)/.test(normalized);
}

function linkedGoogleProfileMatches(
  profile: LinkedGoogleVendorProfile,
  identity: GoogleBusinessUrlIdentity,
  data: GoogleVendorSearchInput,
) {
  const requested = normalizeGoogleText(data.query);
  const profileName = normalizeGoogleText(identity.name || profile.business_name);
  const nameMatch = Boolean(
    requested &&
    (profileName.includes(requested) || requested.includes(profileName)),
  );
  const profileServices = normalizeGoogleText([
    profile.business_category,
    ...(profile.business_categories ?? []),
    ...(profile.custom_service_types ?? []),
  ].filter(Boolean).join(" "));
  const serviceMatch = Boolean(
    requested &&
    (profileServices.includes(requested) || requested.includes(profileServices)),
  );
  const postalRequested = isPostalCode(data.location);
  const profileZip = profile.zip_code?.trim().slice(0, 5);
  const requestedLocation = normalizeGoogleText(data.location);
  const profileCity = normalizeGoogleText(profile.city);
  const profileState = normalizeGoogleText(profile.state);
  const locationMatch = postalRequested
    ? profileZip === data.location?.trim().slice(0, 5)
    : Boolean(
      requestedLocation &&
      (profileCity.includes(requestedLocation) ||
        requestedLocation.includes(profileCity) ||
        profileState === requestedLocation),
    );

  if (nameMatch) return true;
  if (!locationMatch) return false;
  return isGenericLocalBusinessQuery(data.query) || serviceMatch;
}

async function fetchLinkedGoogleVendorResults(
  data: GoogleVendorSearchInput,
): Promise<GoogleVendorMatch[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const profileSelect = "id, business_name, business_category, business_categories, custom_service_types, city, state, zip_code, website, social_links";
    const [websiteResult, linkedResult] = await Promise.all([
      (supabaseAdmin as any)
        .from("vendor_profiles")
        .select(profileSelect)
        .or("website.ilike.%share.google%,website.ilike.%google.com/search%,website.ilike.%google.com/maps%")
        .limit(100),
      (supabaseAdmin as any)
        .from("vendor_profiles")
        .select(profileSelect)
        .not("social_links->>google_business_url", "is", null)
        .limit(100),
    ]);
    const profiles = Array.from(
      new Map(
        [...(websiteResult.data ?? []), ...(linkedResult.data ?? [])]
          .map((profile) => [profile.id, profile]),
      ).values(),
    );
    if (!profiles.length) return [];

    const results = await Promise.all((profiles as LinkedGoogleVendorProfile[]).map(async (profile) => {
      const googleListingUrl = profile.social_links?.google_business_url
        ?? (isGoogleListingUrl(profile.website) ? profile.website : null);
      if (!googleListingUrl) return null;
      const identity = await resolveGoogleBusinessSearchUrl(googleListingUrl);
      if (!identity || !linkedGoogleProfileMatches(profile, identity, data)) return null;
      return {
        id: `google-${identity.externalId}`,
        name: identity.name || profile.business_name || "Google business",
        address: null,
        websiteUri: profile.website && !isGoogleListingUrl(profile.website) ? profile.website : null,
        googleMapsUri: googleListingUrl,
        distanceMiles: null,
        source: "google" as const,
      };
    }));
    return results.filter(Boolean) as GoogleVendorMatch[];
  } catch (error) {
    console.warn("[vendor-search] Linked Google listing lookup unavailable", error instanceof Error ? error.message : "unknown error");
    return [];
  }
}

function isLikelyBusinessNameSearch(query: string | undefined, category: string | undefined) {
  if (category?.trim()) return false;
  const words = query?.trim().split(/\s+/).filter(Boolean) ?? [];
  return words.length >= 3;
}

const GoogleVendorSearchInputSchema = z.object({
  query: z.string().trim().max(120).optional(),
  category: z.string().trim().max(100).optional(),
  location: z.string().trim().max(180).optional(),
  radiusMiles: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]).optional(),
  pageState: z.string().trim().max(16_000).optional(),
});
export type GoogleVendorSearchInput = z.infer<typeof GoogleVendorSearchInputSchema>;

const GOOGLE_LOCATION_BIAS_RADIUS_METERS = 50_000;

function encodeGooglePageState(state: GooglePageState) {
  return btoa(JSON.stringify(state))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeGooglePageState(value: string | undefined): GooglePageState | null {
  if (!value) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as unknown;
    if (!parsed || typeof parsed !== "object" || !("tokens" in parsed)) return null;
    const tokens = (parsed as { tokens?: unknown }).tokens;
    if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) return null;
    const validEntries = Object.entries(tokens).filter(
      ([term, token]) =>
        term.length <= 180 &&
        typeof token === "string" &&
        token.length > 0 &&
        token.length <= 4096,
    );
    if (validEntries.length === 0 || validEntries.length > 8) return null;
    return { tokens: Object.fromEntries(validEntries) };
  } catch {
    return null;
  }
}

/**
 * Public fallback search. It never invents records: without a configured
 * Places key it returns an explicit unconfigured result, and every returned
 * place carries a Google Maps link for attribution.
 */
export async function fetchGoogleVendorFallback(
  data: GoogleVendorSearchInput,
): Promise<{ configured: boolean; results: GoogleVendorMatch[]; nextPageState: string | null }> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
     if (!apiKey) return { configured: false, results: [], nextPageState: null };

    const postalSearch = isPostalCode(data.location);
    const postalLocation = getKnownPostalLocation(data.location);
    const radiusMiles = data.radiusMiles ?? 25;
    const locationLabel = postalLocation?.label ?? (postalSearch ? `ZIP code ${data.location}` : data.location ?? "");
    const terms = postalSearch
      ? [data.query, data.category].filter(Boolean).join(" ").trim()
      : [data.query, data.category, data.location].filter(Boolean).join(" ").trim();
     const pageState = decodeGooglePageState(data.pageState);
      const urlIdentity = !pageState && data.query
        ? await resolveGoogleBusinessSearchUrl(data.query)
        : null;
      if (urlIdentity) {
        return {
          configured: true,
          results: [{
            id: `google-${urlIdentity.externalId}`,
            name: urlIdentity.name,
            address: null,
            websiteUri: null,
            googleMapsUri: data.query,
            distanceMiles: null,
            source: "google" as const,
          }],
          nextPageState: null,
        };
      }
      const linkedGoogleResults = await fetchLinkedGoogleVendorResults(data);
     const searchTerms = pageState
       ? Object.keys(pageState.tokens)
       : googleSearchTerms(data.query, data.category);
     const businessNameSearch = isLikelyBusinessNameSearch(data.query, data.category);
     if (!postalSearch && terms.length < 2 && !pageState) {
       return { configured: true, results: [], nextPageState: null };
     }

    try {
       const results: GoogleVendorMatch[] = [...linkedGoogleResults];
        const nextPageTokens: Record<string, string> = {};
        const nextPageCounts: Record<string, number> = {};
        const nextSeenTokens: Record<string, string[]> = {};
        const nextSeenBusinesses: Record<string, string[]> = {};
      for (const searchTerm of searchTerms) {
         const pageCount = pageState?.pageCounts?.[searchTerm] ?? 0;
         if (pageCount >= GOOGLE_MAX_PAGES_PER_TERM) continue;
         const providerPageToken = pageState?.tokens[searchTerm];
         const seenTokens = pageState?.seenTokens?.[searchTerm] ?? [];
         if (providerPageToken && seenTokens.includes(providerPageToken)) continue;
         const seenBusinesses = pageState?.seenBusinesses?.[searchTerm] ?? [];
         const textQuery = [searchTerm || "event services", locationLabel ? `near ${locationLabel}` : ""]
           .filter(Boolean)
           .join(" ");
        const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
             "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.googleMapsUri,places.location,places.types,places.primaryType,nextPageToken",
          },
          body: JSON.stringify({
            textQuery,
            pageSize: 20,
             ...(providerPageToken ? { pageToken: providerPageToken } : {}),
            ...(postalLocation
              ? {
                  locationBias: {
                    circle: {
                      center: {
                        latitude: postalLocation.latitude,
                        longitude: postalLocation.longitude,
                      },
                      // Places Text Search rejects circles larger than 50 km.
                      // The response is filtered by exact distance below.
                      radius: Math.min(radiusMiles * 1_609.344, GOOGLE_LOCATION_BIAS_RADIUS_METERS),
                    },
                  },
                }
              : {}),
          }),
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null) as {
            error?: { code?: number; status?: string; message?: string };
          } | null;
          const safeMessage = errorPayload?.error?.message
            ?.replace(apiKey, "[redacted]")
            .replace(/\s+/g, " ")
            .slice(0, 240);
          console.error("[vendor-search] Google Places fallback failed", JSON.stringify({
            code: errorPayload?.error?.code ?? response.status,
            status: errorPayload?.error?.status ?? "UNKNOWN",
            message: safeMessage ?? "No provider message",
          }));
          continue;
        }
        const payload = (await response.json()) as {
          places?: Array<{
            id?: string;
            displayName?: { text?: string };
            formattedAddress?: string;
            websiteUri?: string;
            googleMapsUri?: string;
            location?: { latitude?: number; longitude?: number };
             types?: string[];
             primaryType?: string;
          }>;
             nextPageToken?: string;
        };
          const pageResults = (payload.places ?? [])
          .filter((place) => place.id && place.displayName?.text && place.googleMapsUri)
          .map((place) => ({
            place,
            id: `google-${place.id}`,
            name: place.displayName!.text!,
            address: place.formattedAddress ?? null,
            websiteUri: place.websiteUri ?? null,
            googleMapsUri: place.googleMapsUri!,
            distanceMiles:
              postalLocation &&
              Number.isFinite(place.location?.latitude) &&
              Number.isFinite(place.location?.longitude)
                ? distanceMilesBetween(postalLocation, {
                    latitude: place.location!.latitude!,
                    longitude: place.location!.longitude!,
                  })
                : null,
            source: "google" as const,
          }))
           .filter((place) => isGooglePlaceWithinSearchRadius(place, Boolean(postalLocation), radiusMiles))
          .filter(({ place }) => shouldIncludeGooglePlace(
            {
              name: place.name,
              types: place.types,
              primaryType: place.primaryType,
            },
            data.query,
            data.category,
          ))
           .map(({ place: _place, ...place }) => place);
          const newPageResults = pageResults.filter((place) => {
            const identity = googleBusinessIdentity(place);
            return !seenBusinesses.includes(identity);
          });
          results.push(...newPageResults);
          const pageBusinessIdentities = Array.from(new Set([
            ...seenBusinesses,
            ...pageResults.map((place) => googleBusinessIdentity(place)),
          ]));
          const nextToken = payload.nextPageToken;
          const tokenHistory = Array.from(new Set([...seenTokens, ...(providerPageToken ? [providerPageToken] : [])]));
          const hasNewBusinesses = newPageResults.length > 0;
          const canContinue =
            hasNewBusinesses &&
            Boolean(nextToken) &&
            !tokenHistory.includes(nextToken as string) &&
            pageCount + 1 < GOOGLE_MAX_PAGES_PER_TERM;
          if (canContinue) {
            nextPageTokens[searchTerm] = nextToken as string;
            nextPageCounts[searchTerm] = pageCount + 1;
            nextSeenTokens[searchTerm] = [...tokenHistory, nextToken as string];
            nextSeenBusinesses[searchTerm] = pageBusinessIdentities;
          }
      }
      return {
        configured: true,
        results: results
           .filter((place, index, all) => all.findIndex((candidate) =>
             googleBusinessIdentity(candidate) === googleBusinessIdentity(place),
           ) === index)
          .sort((a, b) => (a.distanceMiles ?? Number.POSITIVE_INFINITY) - (b.distanceMiles ?? Number.POSITIVE_INFINITY)),
          nextPageState: Object.keys(nextPageTokens).length > 0
            ? encodeGooglePageState({
                tokens: nextPageTokens,
                pageCounts: nextPageCounts,
                seenTokens: nextSeenTokens,
                seenBusinesses: nextSeenBusinesses,
              })
           : null,
      };
    } catch (error) {
      console.error("[vendor-search] Google Places fallback unavailable", error instanceof Error ? error.message : "unknown error");
       return { configured: true, results: [], nextPageState: null };
    }
}

export const searchGoogleVendorFallback = createServerFn({ method: "GET" })
  .validator((input: unknown) => GoogleVendorSearchInputSchema.parse(input))
  .handler(async ({ data }) => fetchGoogleVendorFallback(data));

function locationMatches(vendor: VendorMatch, location: string | null) {
  if (!location?.trim()) return true;
  const haystack = [vendor.city, vendor.state].filter(Boolean).join(" ").toLowerCase();
  const terms = location.toLowerCase().split(/[\s,]+/).filter((term) => term.length > 2);
  return terms.length === 0 || terms.some((term) => haystack.includes(term));
}

function categoryMatches(vendor: VendorMatch, category: string) {
  const requested = category.trim().toLowerCase();
  return vendorOffersCategory(vendor, requested);
}

async function findPublishedMatches(
  client: any,
  category: string,
  location: string | null,
): Promise<VendorMatch[]> {
  const { data, error } = await client
    .from("vendor_profiles_public")
    .select("id,business_name,business_category,business_categories,city,state,logo_url,starting_price")
    .limit(250);
  if (error) {
    console.error("[vendor-demand] Unable to load published vendors");
    return [];
  }
  return ((data ?? []) as VendorMatch[])
    .filter((vendor) => categoryMatches(vendor, category) && locationMatches(vendor, location))
    .slice(0, 12);
}

async function recordAndNotifyMatches(
  request: { id: string; user_id: string; category: string; location: string | null },
  matches: VendorMatch[],
) {
  if (!matches.length) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", request.user_id)
    .maybeSingle();

  for (const vendor of matches) {
    const { data: ledger, error: ledgerError } = await admin
      .from("vendor_demand_matches")
      .insert({ request_id: request.id, vendor_profile_id: vendor.id })
      .select("id")
      .maybeSingle();
    if (ledgerError?.code === "23505") continue;
    if (ledgerError || !ledger) {
      console.error("[vendor-demand] Unable to record match");
      continue;
    }

    await admin.from("notifications").insert({
      user_id: request.user_id,
      category: "vendor",
      title: `${vendor.business_name ?? "A vendor"} matches your saved need`,
      body: `A published ${request.category} vendor${request.location ? ` in ${request.location}` : ""} is now available to review.`,
      href: "/marketplace",
      entity_type: "vendor_demand_match",
      entity_id: ledger.id,
    });

    if (profile?.email) {
      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const result = await sendTemplateEmail("vendor-match", profile.email, {
          idempotencyKey: `vendor-demand-match-${ledger.id}`,
          templateData: {
            category: request.category,
            location: request.location ?? undefined,
            vendorName: vendor.business_name ?? "A vendor",
            marketplaceUrl: "https://melabridge.com/marketplace",
          },
        });
        if (result.sent) {
          await admin
            .from("vendor_demand_matches")
            .update({ email_sent_at: new Date().toISOString() })
            .eq("id", ledger.id);
        }
      } catch (error) {
        console.error("[vendor-demand] Match email failed", error instanceof Error ? error.message : "unknown error");
      }
    }
  }
}

/**
 * Re-checks saved, unmatched needs when a vendor becomes publishable.
 * This is intentionally server-only and uses the durable match ledger so
 * profile saves, retries, and repeated availability checks cannot spam users.
 */
export async function matchVendorDemandForVendor(vendorProfileId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const [{ data: vendor }, { data: requests }] = await Promise.all([
    admin
      .from("vendor_profiles_public")
      .select("id,business_name,business_category,business_categories,city,state,logo_url,starting_price")
      .eq("id", vendorProfileId)
      .maybeSingle(),
    admin
      .from("vendor_sourcing_requests")
      .select("id,user_id,category,location")
      .eq("request_type", "concierge")
      .order("created_at", { ascending: true })
      .limit(1000),
  ]);
  if (!vendor || !requests?.length) return;

  for (const request of requests) {
    if (!categoryMatches(vendor as VendorMatch, request.category) || !locationMatches(vendor as VendorMatch, request.location)) continue;
    await recordAndNotifyMatches(request, [vendor as VendorMatch]);
  }
}

export const recheckVendorDemandForCurrentVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("vendor_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (profile?.id) await matchVendorDemandForVendor(profile.id);
    return { ok: true };
  });

export const createVendorSourcingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => VendorSourcingInput.parse(input))
  .handler(async ({ data, context }) => {
    const client = context.supabase as any;
    const { data: event, error: eventError } = await client
      .from("events")
      .select("id, owner_id")
      .eq("id", data.eventId)
      .eq("owner_id", context.userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (eventError || !event) {
      throw new Error("Choose an event you own before saving this vendor need.");
    }

    const { data: created, error } = await client
      .from("vendor_sourcing_requests")
      .insert({
        user_id: context.userId,
        event_id: data.eventId,
        request_type: data.requestType,
        category: data.category,
        vendor_name: data.vendorName,
        contact_email: data.contactEmail,
        contact_phone: data.contactPhone,
        website: data.website,
        location: data.location,
        budget_range: data.budgetRange,
        notes: data.notes,
      })
      .select("id, event_id, request_type, category, vendor_name, contact_email, contact_phone, website, location, budget_range, notes, status, created_at")
      .single();

    if (error || !created) {
      console.error("[vendor-demand] Unable to save vendor need");
      throw new Error("We couldn't save that vendor need. Please try again.");
    }

    const matches = data.requestType === "concierge"
      ? await findPublishedMatches(client, data.category, data.location)
      : [];
    await recordAndNotifyMatches(
      { id: created.id, user_id: context.userId, category: data.category, location: data.location },
      matches,
    );

    return { request: created as VendorSourcingRequest, matches };
  });

export const listMyVendorSourcingRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as any;
    const { data, error } = await client
      .from("vendor_sourcing_requests")
      .select("id, event_id, request_type, category, vendor_name, contact_email, contact_phone, website, location, budget_range, notes, status, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error("We couldn't load your saved vendor needs.");
    return (data ?? []) as VendorSourcingRequest[];
  });
