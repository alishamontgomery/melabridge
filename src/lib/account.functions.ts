import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { legacyUserIdForClerkUser } from "@/lib/clerk-identity.server";
import { externalClerkClient } from "@/lib/clerk-config.server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const notificationCategory = z.enum([
  "rsvp", "budget", "task_deadline", "booking", "calendar", "event_updates",
]);

export const getNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notification_preferences")
      .select("category,in_app_enabled,email_enabled,frequency")
      .eq("user_id", context.userId)
      .eq("channel", "all");
    if (error) throw new Error("Could not load notification preferences");
    return data ?? [];
  });

export const saveNotificationPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      category: notificationCategory,
      inAppEnabled: z.boolean(),
      emailEnabled: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const frequency = data.category === "event_updates" ? "weekly" : "instant";
    const { error } = await context.supabase.from("notification_preferences").upsert({
      user_id: context.userId,
      category: data.category,
      channel: "all",
      in_app_enabled: data.inAppEnabled,
      email_enabled: data.emailEnabled,
      frequency,
    }, { onConflict: "user_id,category,channel" });
    if (error) throw new Error("Could not save notification preference");
    return { ok: true };
  });

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
