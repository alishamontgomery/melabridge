/**
 * POST /api/cron/process-scheduled-messages
 *
 * Secured by the CRON_SECRET environment variable (Bearer token).
 * Called by the scheduler background process every 5 minutes.
 *
 * Finds all event_communications rows that are scheduled and due,
 * sends them, then marks them sent.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/process-scheduled-messages")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Validate secret
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
          console.error("[cron] CRON_SECRET not configured");
          return new Response("Not configured", { status: 503 });
        }

        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (token !== cronSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { processScheduledMessages, isServiceClientAvailable } = await import(
            "@/lib/scheduled-messages.server"
          );
          if (!isServiceClientAvailable()) {
            console.warn("[cron] service_role secret not configured — scheduled delivery unavailable in this environment");
            return Response.json(
              { ok: false, skipped: true, reason: "service_role secret not configured" },
              { status: 503 }
            );
          }
          const result = await processScheduledMessages();
          console.log(`[cron] Processed scheduled messages:`, result);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[cron] processScheduledMessages failed:", err);
          return Response.json(
            { ok: false, error: "Internal error" },
            { status: 500 }
          );
        }
      },

      // Health-check — no auth required, just confirms the endpoint is reachable
      GET: async () => {
        return Response.json({ ok: true });
      },
    },
  },
});
