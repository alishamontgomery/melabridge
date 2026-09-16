import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GOOGLE_PLACES_API = "https://places.googleapis.com/v1";

const AutocompleteInput = z.object({ input: z.string().trim().min(2).max(200) });
const DetailsInput = z.object({ placeId: z.string().trim().min(1).max(200) });

export type PlaceSuggestion = { placeId: string; primary: string; secondary: string };
export type PlaceDetails = {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  formatted: string;
};

function googlePlacesHeaders(fieldMask?: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("Google Places is not configured");
  return {
    "X-Goog-Api-Key": key,
    ...(fieldMask ? { "X-Goog-FieldMask": fieldMask } : {}),
    "Content-Type": "application/json",
  };
}

export const autocompletePlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => AutocompleteInput.parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${GOOGLE_PLACES_API}/places:autocomplete`, {
      method: "POST",
      headers: googlePlacesHeaders(
        "suggestions.placePrediction.placeId," +
        "suggestions.placePrediction.structuredFormat.mainText.text," +
        "suggestions.placePrediction.structuredFormat.secondaryText.text," +
        "suggestions.placePrediction.text.text",
      ),
      body: JSON.stringify({ input: data.input }),
    });
    if (!res.ok) {
      throw new Error(`Places autocomplete failed [${res.status}]`);
    }
    const json = (await res.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId: string;
          structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
          text?: { text: string };
        };
      }>;
    };
    const suggestions: PlaceSuggestion[] = (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({
        placeId: p.placeId,
        primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
      }));
    return { suggestions };
  });

export const getPlaceDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => DetailsInput.parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${GOOGLE_PLACES_API}/places/${encodeURIComponent(data.placeId)}`, {
      method: "GET",
      headers: googlePlacesHeaders("id,formattedAddress,location,addressComponents"),
    });
    if (!res.ok) {
      throw new Error(`Place details failed [${res.status}]`);
    }
    const json = (await res.json()) as {
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
    };
    const comps = json.addressComponents ?? [];
    const findComp = (type: string, short = false) => {
      const c = comps.find((x) => (x.types ?? []).includes(type));
      return (short ? c?.shortText : c?.longText) ?? "";
    };
    const streetNumber = findComp("street_number");
    const route = findComp("route");
    const details: PlaceDetails = {
      street: [streetNumber, route].filter(Boolean).join(" "),
      city: findComp("locality") || findComp("postal_town") || findComp("sublocality"),
      state: findComp("administrative_area_level_1", true),
      zip: findComp("postal_code"),
      lat: json.location?.latitude ?? null,
      lng: json.location?.longitude ?? null,
      formatted: json.formattedAddress ?? "",
    };
    return details;
  });
