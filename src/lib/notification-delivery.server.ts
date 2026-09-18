import { sendTemplateEmail } from "@/lib/email-templates/send-email";

export type NotificationCategory =
  | "rsvp"
  | "budget"
  | "task_deadline"
  | "booking"
  | "calendar"
  | "event_updates";

export type NotificationPayload = {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  idempotencyKey?: string;
  /** Used when a caller has already updated an existing batched in-app row. */
  skipInApp?: boolean;
};

type Preference = {
  in_app_enabled: boolean;
  email_enabled: boolean;
  frequency: string;
};

export const DEFAULT_NOTIFICATION_PREFERENCE: Preference = {
  in_app_enabled: true,
  email_enabled: false,
  frequency: "instant",
};

export function defaultNotificationPreference(category: NotificationCategory): Preference {
  return category === "event_updates"
    ? { in_app_enabled: true, email_enabled: true, frequency: "weekly" }
    : DEFAULT_NOTIFICATION_PREFERENCE;
}

export async function getNotificationPreference(
  userId: string,
  category: NotificationCategory,
): Promise<Preference> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const supabase = supabaseAdmin as any;
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("in_app_enabled,email_enabled,frequency")
    .eq("user_id", userId)
    .eq("category", category)
    .eq("channel", "all")
    .maybeSingle();

  if (error) throw new Error("Could not load notification preference");
  return data
    ? {
        in_app_enabled: data.in_app_enabled ?? true,
        email_enabled: data.email_enabled ?? false,
        frequency: data.frequency ?? "instant",
      }
    : defaultNotificationPreference(category);
}

/**
 * Delivers one account notification through every enabled immediate channel.
 * Scheduled frequencies are processed by the cron digest worker instead.
 */
export async function dispatchNotification(
  payload: NotificationPayload,
): Promise<{ inApp: boolean; email: boolean; errors: string[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const supabase = supabaseAdmin as any;
  const pref = await getNotificationPreference(payload.userId, payload.category);
  let inApp = false;
  let email = false;
  const errors: string[] = [];

  if (pref.in_app_enabled && !payload.skipInApp) {
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: payload.userId,
        category: payload.category,
        title: payload.title,
        body: payload.body,
        href: payload.href ?? null,
        entity_type: payload.entityType ?? null,
        entity_id: payload.entityId ?? null,
      });
      if (error) throw new Error("insert_failed");
      inApp = true;
    } catch {
      errors.push("in_app_failed");
      console.error("[notification-delivery] In-app delivery failed");
    }
  }

  if (pref.email_enabled && pref.frequency === "instant") {
    try {
      const { data: recipient, error } = await supabase
        .from("profiles")
        .select("email,display_name")
        .eq("id", payload.userId)
        .maybeSingle();
      if (error || !recipient?.email) throw new Error("recipient_unavailable");
      const result = await sendTemplateEmail("account-notification", recipient.email, {
          idempotencyKey: payload.idempotencyKey,
          templateData: {
            recipientName: recipient.display_name,
            title: payload.title,
            body: payload.body,
            actionUrl: payload.href ?? "/notifications",
          },
        });
      email = result.sent;
      if (!result.sent) errors.push(result.reason);
    } catch {
      errors.push("email_failed");
      console.error("[notification-delivery] Email delivery failed");
    }
  }

  return { inApp, email, errors };
}
