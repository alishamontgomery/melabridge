import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlatformStats = {
  totalUsers: number;
  newUsersLast30: number;
  totalVendors: number;
  activeVendors: number;
  incompleteVendors: number;
  verifiedVendors: number;
  newVendorsLast30: number;
  categoryBreakdown: { category: string; count: number }[];
  totalInquiries: number;
  recentInquiries: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
};

export const getPlatformStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformStats | { error: string }> => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!roles || roles.length === 0) return { error: "Forbidden" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      usersRes,
      newUsersRes,
      vendorsRes,
      activeVendorsRes,
      incompleteVendorsRes,
      verifiedVendorsRes,
      newVendorsRes,
      categoriesRes,
      inquiriesRes,
      recentInquiriesRes,
      subsRes,
      activeSubsRes,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
      supabaseAdmin.from("vendor_profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("vendor_profiles").select("id", { count: "exact", head: true }).eq("onboarding_completed", true),
      supabaseAdmin.from("vendor_profiles").select("id", { count: "exact", head: true }).eq("onboarding_completed", false),
      supabaseAdmin.from("vendor_profiles").select("id", { count: "exact", head: true }).eq("is_verified", true),
      supabaseAdmin.from("vendor_profiles").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
      supabaseAdmin.from("vendor_profiles").select("business_category").eq("onboarding_completed", true),
      supabaseAdmin.from("calendar_booking_requests").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("calendar_booking_requests").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
      supabaseAdmin.from("subscriptions").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "trialing"]),
    ]);

    const catMap = new Map<string, number>();
    for (const row of (categoriesRes.data ?? [])) {
      const cat = (row as { business_category: string | null }).business_category ?? "Uncategorized";
      catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
    }
    const categoryBreakdown = Array.from(catMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalUsers: usersRes.count ?? 0,
      newUsersLast30: newUsersRes.count ?? 0,
      totalVendors: vendorsRes.count ?? 0,
      activeVendors: activeVendorsRes.count ?? 0,
      incompleteVendors: incompleteVendorsRes.count ?? 0,
      verifiedVendors: verifiedVendorsRes.count ?? 0,
      newVendorsLast30: newVendorsRes.count ?? 0,
      categoryBreakdown,
      totalInquiries: inquiriesRes.count ?? 0,
      recentInquiries: recentInquiriesRes.count ?? 0,
      totalSubscriptions: subsRes.count ?? 0,
      activeSubscriptions: activeSubsRes.count ?? 0,
    };
  });
