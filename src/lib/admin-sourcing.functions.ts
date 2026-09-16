import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VendorDemandBreakdown = {
  label: string;
  count: number;
};

export type VendorDemandSummary = {
  totalNeeds: number;
  recentNeeds: number;
  previousNeeds: number;
  unmatchedNeeds: number;
  categories: VendorDemandBreakdown[];
  locations: VendorDemandBreakdown[];
  recentTrend: "up" | "down" | "flat";
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

/**
 * Admins see demand signals only. Requesters, event details, private vendor
 * contacts, notes, and lifecycle controls never cross this boundary.
 */
export const getAdminVendorDemand = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VendorDemandSummary> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const now = Date.now();
    const recentSince = new Date(now - 30 * 86_400_000).toISOString();
    const previousSince = new Date(now - 60 * 86_400_000).toISOString();

    const { data: needs, error } = await admin
      .from("vendor_sourcing_requests")
      .select("id,category,location,created_at")
      .eq("request_type", "concierge")
      .gte("created_at", previousSince)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error("Could not load vendor demand.");

    const rows = (needs ?? []) as { id: string; category: string; location: string | null; created_at: string }[];
    const recent = rows.filter((row) => row.created_at >= recentSince);
    const recentIds = recent.map((row) => row.id);
    const { data: matches, error: matchError } = recentIds.length
      ? await admin.from("vendor_demand_matches").select("request_id").in("request_id", recentIds)
      : { data: [], error: null };
    if (matchError) throw new Error("Could not load vendor demand matches.");

    const matchedIds = new Set((matches ?? []).map((match: { request_id: string }) => match.request_id));
    const countBy = (values: string[]) => {
      const counts = new Map<string, number>();
      for (const value of values) {
        const label = value.trim() || "Not specified";
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      return [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 12);
    };

    const previousCount = rows.filter((row) => row.created_at < recentSince).length;
    const recentCount = recent.length;
    return {
      totalNeeds: rows.length,
      recentNeeds: recentCount,
      previousNeeds: previousCount,
      unmatchedNeeds: recent.filter((row) => !matchedIds.has(row.id)).length,
      categories: countBy(recent.map((row) => row.category)),
      locations: countBy(recent.map((row) => row.location ?? "")),
      recentTrend: recentCount > previousCount ? "up" : recentCount < previousCount ? "down" : "flat",
    };
  });