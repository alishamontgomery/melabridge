import { createFileRoute } from "@tanstack/react-router";
import { logReliability } from "@/lib/reliability-logger";
import { runSyntheticMonitor } from "@/lib/reliability-monitor";

export const Route = createFileRoute("/api/monitor/synthetic")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
          logReliability("error", "synthetic_monitor_not_configured", {
            operation: "cron_secret",
            detail: "CRON_SECRET is not configured",
          });
          return Response.json({ ok: false, error: "not_configured" }, { status: 503 });
        }
        const authorization = request.headers.get("authorization") ?? "";
        if (authorization !== `Bearer ${cronSecret}`) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        const baseUrl = new URL(request.url).origin;
        const run = await runSyntheticMonitor(baseUrl);
        return Response.json({ ok: run.overall === "ok", ...run }, {
          status: run.overall === "degraded" ? 503 : 200,
        });
      },
      GET: async () => Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 }),
    },
  },
});