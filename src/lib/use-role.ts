import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AppRole = "personal" | "organization" | "vendor" | "admin";

/**
 * Resolves the current user's primary role.
 *
 * Priority: user_roles table (RBAC source of truth) →
 * profiles.account_type fallback (for users who onboarded before RBAC) →
 * "personal" default.
 */
export function useRole(): {
  role: AppRole;
  loading: boolean;
  error: boolean;
  retry: () => void;
} {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<AppRole> => {
      if (!user) return "personal";

      const [rolesRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle(),
      ]);

      if (rolesRes.error) {
        throw new Error("Unable to verify account permissions");
      }

      const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
      if (roles.includes("admin")) return "admin";

      if (profileRes.error) {
        throw new Error("Unable to verify account permissions");
      }

      const acct = profileRes.data?.account_type as AppRole | null | undefined;
      if (acct === "personal" || acct === "organization" || acct === "vendor" || acct === "admin") {
        return acct;
      }
      if (roles.includes("vendor")) return "vendor";
      if (roles.includes("organization")) return "organization";
      if (roles.includes("personal")) return "personal";
      const metadataRole = user.user_metadata?.account_type;
      if (metadataRole === "vendor" || metadataRole === "organization" || metadataRole === "personal") {
        return metadataRole;
      }
      return "personal";
    },
  });

  return {
    role: data ?? "personal",
    loading: authLoading || isLoading,
    error: isError,
    retry: () => {
      void refetch();
    },
  };
}
