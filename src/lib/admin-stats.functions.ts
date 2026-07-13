import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminStats = {
  activeUsers: number;
  eventsInFlight: number;
  vendorApplications: number;
  openReports: number;
  pendingRefunds: number;
};

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

    const [usersRes, eventsRes, vendorsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("events")
        .select("id", { count: "exact", head: true })
        .neq("status", "archived"),
      supabaseAdmin
        .from("vendor_profiles")
        .select("id", { count: "exact", head: true })
        .eq("onboarding_completed", false),
    ]);

    return {
      activeUsers: usersRes.count ?? 0,
      eventsInFlight: eventsRes.count ?? 0,
      vendorApplications: vendorsRes.count ?? 0,
      openReports: 0,
      pendingRefunds: 0,
    };
  });
