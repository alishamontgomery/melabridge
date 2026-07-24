import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

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

function authHeaders() {
  const lov = process.env.LOVABLE_API_KEY;
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!lov || !key) throw new Error("Google Maps connector not configured");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": key,
    "Content-Type": "application/json",
  };
}

export const autocompletePlaces = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AutocompleteInput.parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${GATEWAY}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ input: data.input }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Places autocomplete failed [${res.status}]: ${body}`);
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
  .inputValidator((d: unknown) => DetailsInput.parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${GATEWAY}/places/v1/places/${encodeURIComponent(data.placeId)}`, {
      method: "GET",
      headers: {
        ...authHeaders(),
        "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Place details failed [${res.status}]: ${body}`);
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
