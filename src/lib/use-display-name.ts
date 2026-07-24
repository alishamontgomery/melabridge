import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Resolves the user's display name for greetings.
 *
 * Priority:
 *  1. User first name (auth metadata: first_name / full_name / name / display_name)
 *  2. Profile display_name
 *  3. Vendor business_name
 *  4. Email local part (last fallback)
 *  5. "there"
 */
export function useDisplayName(): { firstName: string; fullName: string; businessName: string | null; loading: boolean } {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["display-name", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return { display_name: null as string | null, business_name: null as string | null };
      const [p, v] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        supabase.from("vendor_profiles").select("business_name").eq("user_id", user.id).maybeSingle(),
      ]);
      return {
        display_name: p.data?.display_name ?? null,
        business_name: v.data?.business_name ?? null,
      };
    },
  });

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const metaName =
    (typeof meta.first_name === "string" && meta.first_name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.display_name === "string" && meta.display_name) ||
    "";

  const profileName = data?.display_name?.trim() || "";
  const businessName = data?.business_name?.trim() || null;
  const emailLocal = user?.email ? user.email.split("@")[0] : "";

  const fullName =
    metaName.trim() ||
    profileName ||
    businessName ||
    emailLocal ||
    "there";

  const first = fullName.split(/\s+/)[0];
  const firstName = first && first !== emailLocal
    ? first
    : emailLocal
      ? emailLocal.charAt(0).toUpperCase() + emailLocal.slice(1)
      : "there";

  return {
    firstName,
    fullName,
    businessName,
    loading: authLoading || isLoading,
  };
}
