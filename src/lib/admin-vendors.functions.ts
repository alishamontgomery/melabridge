import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export type VendorRow = {
  id: string;
  user_id: string;
  business_name: string;
  business_category: string;
  business_categories?: string[] | null;
  city: string | null;
  state: string | null;
  onboarding_completed: boolean;
  accepted_terms: boolean;
  years_in_business: number | null;
  starting_price: number | null;
  created_at: string;
  email: string | null;
  website: string | null;
  business_description: string | null;
  is_verified: boolean;
  verified_at: string | null;
};

/** List all vendor profiles for admin review. */
export const listVendorsForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VendorRow[] | { error: string }> => {
    try {
      await assertAdmin(context);
    } catch {
      return { error: "Forbidden" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("vendor_profiles")
      .select(
        "id, user_id, business_name, business_category, business_categories, city, state, onboarding_completed, accepted_terms, years_in_business, starting_price, created_at, email, website, business_description, is_verified, verified_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return { error: error.message };

    return (data ?? []).map((v) => ({
      ...v,
      is_verified: v.is_verified ?? false,
      verified_at: v.verified_at ?? null,
    })) as VendorRow[];
  });

const verifyInput = z.object({
  vendorProfileId: z.string().uuid(),
  verify: z.boolean(),
});

/** Mark a vendor as verified (or unverify). */
export const setVendorVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => verifyInput.parse(raw))
  .handler(async ({ data, context }) => {
    try {
      await assertAdmin(context);
    } catch {
      return { error: "Forbidden" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("vendor_profiles")
      .update({
        is_verified: data.verify,
        verified_at: data.verify ? new Date().toISOString() : null,
      })
      .eq("id", data.vendorProfileId);

    if (error) return { error: error.message };
    return { success: true };
  });
