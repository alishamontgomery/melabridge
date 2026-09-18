import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import { defaultNotificationPreference } from "./notification-delivery.server";

function weekKey(now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function processWeeklyEventDigests(
  supabase: any,
  now = new Date(),
): Promise<{ eligible: number; sent: number; failed: number }> {
  // Send on Mondays only. The scheduler may run repeatedly; the claim table dedupes each week.
  if (now.getUTCDay() !== 1) return { eligible: 0, sent: 0, failed: 0 };

  const [{ data: profiles, error: profilesError }, { data: savedPreferences, error: preferencesError }] =
    await Promise.all([
      supabase.from("profiles").select("id,email,display_name"),
      supabase
        .from("notification_preferences")
        .select("user_id,in_app_enabled,email_enabled,frequency")
        .eq("category", "event_updates")
        .eq("channel", "all"),
    ]);
  if (profilesError || preferencesError) throw new Error("Could not load weekly digest recipients");

  const preferenceByUser = new Map((savedPreferences ?? []).map((pref: any) => [pref.user_id, pref]));
  const defaultPreference = defaultNotificationPreference("event_updates");

  let sent = 0;
  let failed = 0;
  const key = weekKey(now);
  for (const profile of profiles ?? []) {
    const saved = preferenceByUser.get(profile.id) as any;
    const preference = saved ?? defaultPreference;
    if (preference.frequency !== "weekly") continue;

    const { data: events } = await supabase
      .from("events")
      .select("id,name,event_date")
      .eq("owner_id", profile.id)
      .neq("status", "completed");
    const eventRows = events ?? [];
    const body = eventRows.length
      ? `You have ${eventRows.length} active ${eventRows.length === 1 ? "event" : "events"} in MelaBridge. Open your dashboard to review dates, tasks, guests, and planning progress.`
      : "You have no active events right now. Start a new event whenever you're ready.";

    const channels = [
      { name: "in_app", enabled: preference.in_app_enabled !== false },
      { name: "email", enabled: preference.email_enabled !== false },
    ];
    for (const channel of channels) {
      if (!channel.enabled) continue;
      const periodKey = `${key}:${channel.name}`;
      const { error: claimError } = await supabase.from("notification_digest_deliveries").insert({
        user_id: profile.id,
        category: "event_updates",
        period_key: periodKey,
      });
      if (claimError) {
        if (claimError.code === "23505") continue;
        failed++;
        continue;
      }

      try {
        if (channel.name === "in_app") {
          const { error } = await supabase.from("notifications").insert({
            user_id: profile.id,
            category: "event_updates",
            title: "Your weekly event update",
            body,
            href: "/dashboard",
          });
          if (error) throw new Error("in_app_failed");
        } else {
          if (!profile.email) throw new Error("missing_recipient");
          const result = await sendTemplateEmail("account-notification", profile.email, {
            idempotencyKey: `event-updates:${profile.id}:${key}`,
            templateData: {
              recipientName: profile.display_name,
              title: "Your weekly event update",
              body,
              actionUrl: "/dashboard",
            },
          });
          if (!result.sent) throw new Error(result.reason);
        }
        sent++;
      } catch {
        failed++;
        await supabase.from("notification_digest_deliveries")
          .delete()
          .eq("user_id", profile.id)
          .eq("category", "event_updates")
          .eq("period_key", periodKey);
      }
    }
  }
  return { eligible: profiles?.length ?? 0, sent, failed };
}
