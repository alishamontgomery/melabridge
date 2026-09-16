import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The identity-link table is intentionally accessed only from server code.
 * Clerk IDs are external identities; application rows continue to use the
 * legacy UUID stored in `legacy_user_id`.
 */
type IdentityLinkClient = SupabaseClient<any>;

export async function legacyUserIdForClerkUser(clerkUserId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as IdentityLinkClient;
  const { data, error } = await admin
    .from("clerk_identity_links")
    .select("legacy_user_id")
    .eq("clerk_user_id", clerkUserId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to resolve the Clerk identity link: ${error.message}`);
  }
  if (data?.legacy_user_id && typeof data.legacy_user_id === "string") {
    return data.legacy_user_id;
  }

  // A protected server function can be the first request after Clerk session
  // activation. Provision through the same idempotent path used by the
  // callback instead of making route-specific code depend on link timing.
  const { provisionClerkIdentity } = await import("@/lib/auth-register.functions");
  const provisioned = await provisionClerkIdentity();
  if (provisioned.clerkUserId !== clerkUserId) {
    throw new Error("The Clerk session changed while resolving your application identity.");
  }
  return provisioned.userId;
}