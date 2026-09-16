import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTemplateEmail } from "./email-templates/send-email";

const notifyInput = z.object({
  /** The event the new member was added to — used to verify the caller is a member. */
  eventId: z.string().uuid(),
  /** Email address of the newly added member — must be a valid email. */
  to: z.string().email(),
  /** Display name of the event, shown in the email subject and body. */
  eventName: z.string().min(1).max(200),
  /** User ID of the newly added member — used to create the in-app notification. */
  invitedUserId: z.string().uuid(),
});

/**
 * Sends a "You've been added to [Event Name]" email to a newly invited team member.
 *
 * Security gates:
 * 1. Caller must be authenticated (requireSupabaseAuth middleware).
 * 2. Caller must be a member of the target event (owner/editor check against event_members).
 * 3. The outbound event URL is derived server-side from the verified eventId — callers
 *    cannot inject arbitrary links into outbound email.
 */
export const notifyTeamMemberAdded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => notifyInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // --- Authorization: caller must be a member of this event ---
    const { data: membership, error: memberErr } = await supabase
      .from("event_members")
      .select("role")
      .eq("event_id", data.eventId)
      .eq("user_id", userId)
      .maybeSingle();

    // Also allow the event owner (events.owner_id)
    let authorised = !!membership && !memberErr;
    if (!authorised) {
      const { data: owned } = await supabase
        .from("events")
        .select("id")
        .eq("id", data.eventId)
        .eq("owner_id", userId)
        .maybeSingle();
      authorised = !!owned;
    }
    if (!authorised) {
      // Silently succeed — don't leak that the event exists to unauthorised callers.
      return { sent: false, reason: "unauthorised" as const };
    }

    // --- Derive the event URL server-side so callers cannot inject arbitrary links ---
    const siteUrl = process.env.SITE_URL ?? "https://melabridge.com";
    const eventUrl = `${siteUrl}/events`;

    // --- Insert in-app notification for the invited member ---
    // Use the service-role client so the write is not blocked by RLS (the
    // caller is the *inviting* user, not the notification recipient).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: notifError } = await supabaseAdmin.from("notifications").insert({
      user_id: data.invitedUserId,
      title: `You've been added to ${data.eventName}`,
      body: "Open the event to start collaborating.",
      href: `/events/${data.eventId}`,
    });
    if (notifError) {
      // Non-fatal but we want visibility in server logs.
      console.error("[team-invite] Failed to insert in-app notification:", notifError.message);
    }

    try {
      const result = await sendTemplateEmail("team-invite", data.to, {
        templateData: {
          eventName: data.eventName,
          eventUrl,
        },
        idempotencyKey: `team-invite-${data.to}-${data.eventId}`,
      });
      return result;
    } catch {
      // Email failure is non-critical — member is already added.
      return { sent: false, reason: "email_error" as const };
    }
  });
