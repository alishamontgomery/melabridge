import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AppRole = "planner" | "vendor" | "guest" | "admin";

/**
 * Resolves the current user's primary role.
 *
 * Priority: user_roles table (RBAC source of truth) →
 * profiles.account_type fallback (for users who onboarded before RBAC) →
 * "planner" default.
 */
export function useRole(): { role: AppRole; loading: boolean } {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<AppRole> => {
      if (!user) return "planner";

      const [rolesRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle(),
      ]);

      const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
      if (roles.includes("admin")) return "admin";
      if (roles.includes("planner")) return "planner";
      if (roles.includes("vendor")) return "vendor";
      if (roles.includes("guest")) return "guest";

      const acct = profileRes.data?.account_type as AppRole | null | undefined;
      if (acct === "planner" || acct === "vendor" || acct === "guest" || acct === "admin") {
        return acct;
      }
      return "planner";
    },
  });

  return { role: data ?? "planner", loading: authLoading || isLoading };
}
