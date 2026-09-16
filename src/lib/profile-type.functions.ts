import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { z } from "zod";
import { legacyUserIdForClerkUser } from "@/lib/clerk-identity.server";
import { publicToLegacyProfileType, type PublicProfileType } from "@/lib/profile-types";

const profileTypeSchema = z.object({
  profileType: z.enum(["host", "planner", "vendor"]),
});

/**
 * Changes a user's public profile type without touching any event-owned data.
 * Role replacement runs through the existing service-only RPC so old role rows
 * do not remain active after a switch. Admin accounts are intentionally kept
 * outside this public profile-type control.
 */
export const changeOwnProfileType = createServerFn({ method: "POST" })
  .validator((input: unknown) => profileTypeSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await auth();
    if (!session.userId) throw new Error("Unauthorized");

    const userId = await legacyUserIdForClerkUser(session.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const nextRole = publicToLegacyProfileType(data.profileType as PublicProfileType);

    const [{ data: profile, error: profileReadError }, { data: roles, error: rolesReadError }] = await Promise.all([
      admin.from("profiles").select("account_type").eq("id", userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (profileReadError || rolesReadError) throw new Error("Could not verify your current profile type.");
    if ((roles ?? []).some((row: { role: string }) => row.role === "admin") || profile?.account_type === "admin") {
      throw new Error("Admin access is managed internally and cannot be changed here.");
    }

    const previousRole = (profile?.account_type ?? (roles ?? [])[0]?.role) as string | undefined;
    if (previousRole === "vendor" && nextRole !== "vendor") {
      throw new Error("Vendor business profiles cannot change to another profile type. Delete the business from Settings if you no longer need it.");
    }
    const rollbackRole = ["personal", "organization", "vendor"].includes(previousRole ?? "")
      ? previousRole
      : "personal";

    const { error: roleError } = await admin.rpc("replace_user_primary_role", {
      _user_id: userId,
      _new_role: nextRole,
    });
    if (roleError) throw new Error("Could not update your profile type. Please try again.");

    const { error: profileError } = await admin
      .from("profiles")
      .update({ account_type: nextRole })
      .eq("id", userId);
    if (profileError) {
      await admin.rpc("replace_user_primary_role", { _user_id: userId, _new_role: rollbackRole });
      throw new Error("Could not save your profile type. Please try again.");
    }

    return { profileType: data.profileType };
  });