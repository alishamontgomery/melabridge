import { createFileRoute } from "@tanstack/react-router";
import { recordSyntheticMonitorRun, type SyntheticMonitorRun } from "@/lib/reliability-monitor";

function isSafeRun(value: unknown): value is SyntheticMonitorRun {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<SyntheticMonitorRun>;
  return (
    typeof run.startedAt === "string" &&
    typeof run.completedAt === "string" &&
    ["ok", "degraded", "blocked", "not_run"].includes(run.overall ?? "") &&
    Array.isArray(run.checks) &&
    run.checks.length <= 40 &&
    run.checks.every((check) =>
      check &&
      typeof check === "object" &&
      typeof check.name === "string" &&
      check.name.length <= 100 &&
      ["ok", "degraded", "blocked", "not_run"].includes(check.status) &&
      typeof check.detail === "string" &&
      check.detail.length <= 500 &&
      check.nonDestructive === true,
    )
  );
}

export const Route = createFileRoute("/api/monitor/report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
        }
        if (!isSafeRun(payload)) {
          return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
        }
        recordSyntheticMonitorRun(payload);
        return Response.json({ ok: true });
      },
      GET: async () => Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 }),
    },
  },
});