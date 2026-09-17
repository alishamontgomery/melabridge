import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminStats = {
  activeUsers: number;
  activeSubscriptions: number;
  totalVendors: number;
  activeVendors: number;
  totalEvents: number;
  publishedEvents: number;
  ticketOrders: number;
  ticketAttendees: number;
  checkedInAttendees: number;
  /** Not yet tracked — omitted until a reports queue table is available. */
  openReports?: number;
  /** Not yet tracked — omitted until a billing refunds table is available. */
  pendingRefunds?: number;
};

export function applyActiveSubscriptionFilters<T extends {
  in: (column: string, values: string[]) => T;
  or: (filters: string) => T;
}>(query: T, nowIso: string): T {
  // AdminOS defines "Active subscriptions" as current active + trialing rows,
  // matching the task requirement and the subscription summary categories.
  return query
    .in("status", ["active", "trialing"])
    .or(`current_period_end.is.null,current_period_end.gt.${nowIso}`);
}

export const getAdminStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStats | { error: string }> => {
    const { supabase, userId } = context;

    // Verify caller is admin via has_role RPC
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!roles || roles.length === 0) {
      return { error: "Forbidden" };
    }

    // Load admin client only after authorization
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const nowIso = new Date().toISOString();
    const [
      usersRes,
      activeSubscriptionsRes,
      totalVendorsRes,
      activeVendorsRes,
      eventsRes,
      publishedEventsRes,
      ticketOrdersRes,
      ticketAttendeesRes,
      checkedInAttendeesRes,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      applyActiveSubscriptionFilters(
        supabaseAdmin
          .from("subscriptions")
          .select("id", { count: "exact", head: true }),
        nowIso,
      ),
      supabaseAdmin.from("vendor_profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("vendor_profiles")
        .select("id", { count: "exact", head: true })
        .eq("onboarding_completed", true),
      supabaseAdmin.from("events").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabaseAdmin
        .from("events")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("is_published", true),
      supabaseAdmin.from("ticket_orders").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("ticket_attendees").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("ticket_attendees")
        .select("id", { count: "exact", head: true })
        .not("checked_in_at", "is", null),
    ]);

    const dbErrors = [
      usersRes.error,
      activeSubscriptionsRes.error,
      totalVendorsRes.error,
      activeVendorsRes.error,
      eventsRes.error,
      publishedEventsRes.error,
      ticketOrdersRes.error,
      ticketAttendeesRes.error,
      checkedInAttendeesRes.error,
    ].filter(Boolean);
    if (dbErrors.length > 0) {
      const msg = dbErrors[0]!.message;
      console.error("[admin-stats] Database error:", msg);
      return { error: `Database error: ${msg}` };
    }

    return {
      activeUsers: usersRes.count ?? 0,
      activeSubscriptions: activeSubscriptionsRes.count ?? 0,
      totalVendors: totalVendorsRes.count ?? 0,
      activeVendors: activeVendorsRes.count ?? 0,
      totalEvents: eventsRes.count ?? 0,
      publishedEvents: publishedEventsRes.count ?? 0,
      ticketOrders: ticketOrdersRes.count ?? 0,
      ticketAttendees: ticketAttendeesRes.count ?? 0,
      checkedInAttendees: checkedInAttendeesRes.count ?? 0,
    };
  });
