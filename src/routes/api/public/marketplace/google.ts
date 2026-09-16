import { createFileRoute } from "@tanstack/react-router";
import {
  fetchGoogleVendorFallback,
  type GoogleVendorSearchInput,
} from "@/lib/vendor-sourcing.functions";

const ALLOWED_RADII = new Set([10, 25, 50, 100]);

export const Route = createFileRoute("/api/public/marketplace/google")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const radiusCandidate = Number(url.searchParams.get("radiusMiles"));
        const data: GoogleVendorSearchInput = {
          query: url.searchParams.get("query") || undefined,
          category: url.searchParams.get("category") || undefined,
          location: url.searchParams.get("location") || undefined,
          pageState: url.searchParams.get("pageState") || undefined,
          radiusMiles: ALLOWED_RADII.has(radiusCandidate)
            ? radiusCandidate as GoogleVendorSearchInput["radiusMiles"]
            : 25,
        };

        const result = await fetchGoogleVendorFallback(data);
        return Response.json(result, {
          headers: {
              "cache-control": "public, max-age=120, stale-while-revalidate=600",
          },
        });
      },
    },
  },
});