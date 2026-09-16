import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { legacyUserIdForClerkUser } from "@/lib/clerk-identity.server";
import { externalClerkClient } from "@/lib/clerk-config.server";
import { z } from "zod";

/** Removes only the Clerk identity; application records remain retained and suspended. */
export const deleteAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({}).parse(input))
  .handler(async () => {
    const session = await auth();
    if (!session.userId) throw new Error("Unauthorized");
    const legacyUserId = await legacyUserIdForClerkUser(session.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const links = (supabaseAdmin as any).from("clerk_identity_links");
    const { error: suspendError } = await links
      .update({ status: "suspended" })
      .eq("legacy_user_id", legacyUserId)
      .eq("clerk_user_id", session.userId);
    if (suspendError) {
      throw new Error("We couldn't prepare your application identity for deletion. Please try again.");
    }

    try {
      await externalClerkClient().users.deleteUser(session.userId);
    } catch (error) {
      const { error: restoreError } = await links
        .update({ status: "active" })
        .eq("legacy_user_id", legacyUserId)
        .eq("clerk_user_id", session.userId);
      if (restoreError) {
        throw new Error("Account deletion could not be completed safely. Contact support before trying again.");
      }
      throw error;
    }
    return { ok: true };
  });