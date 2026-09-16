import { createFileRoute } from "@tanstack/react-router";
import { buildVendorCalendar } from "@/lib/calendar-ical";

export const Route = createFileRoute("/api/public/calendar/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.token)) {
          return new Response("Calendar not found", { status: 404 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: settings, error: settingsError } = await supabaseAdmin
            .from("calendar_settings")
            .select("user_id")
            .eq("calendar_feed_token", params.token)
            .maybeSingle();

          if (settingsError) throw settingsError;
          if (!settings) return new Response("Calendar not found", { status: 404 });

          const [{ data: events, error: eventsError }, { data: blocks, error: blocksError }] =
            await Promise.all([
              supabaseAdmin
                .from("calendar_events")
                .select("id,starts_at,ends_at,updated_at")
                .eq("vendor_id", settings.user_id)
                .eq("status", "confirmed")
                .order("starts_at"),
              supabaseAdmin
                .from("calendar_blocked_dates")
                .select("id,start_date,end_date,reason,updated_at")
                .eq("user_id", settings.user_id)
                .order("start_date"),
            ]);

          if (eventsError) throw eventsError;
          if (blocksError) throw blocksError;

          const calendar = buildVendorCalendar(settings.user_id, events ?? [], blocks ?? []);
          return new Response(calendar, {
            headers: {
              "Content-Type": "text/calendar; charset=utf-8",
              "Content-Disposition": 'inline; filename="melabridge-calendar.ics"',
              "Cache-Control": "private, max-age=300",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch (error) {
          console.error("[calendar-feed] Could not build calendar feed", error);
          return new Response("Calendar feed unavailable", { status: 503 });
        }
      },
    },
  },
});