import { createFileRoute } from "@tanstack/react-router";
import { logReliability } from "@/lib/reliability-logger";

let acceptedInWindow = 0;
let windowStartedAt = 0;
const MAX_ACCEPTED_PER_MINUTE = 60;

export const Route = createFileRoute("/api/telemetry/client-error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const now = Date.now();
        if (now - windowStartedAt >= 60_000) {
          windowStartedAt = now;
          acceptedInWindow = 0;
        }
        if (acceptedInWindow >= MAX_ACCEPTED_PER_MINUTE) {
          return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
        }

        const contentLength = Number(request.headers.get("content-length") ?? "0");
        if (contentLength > 8_000) {
          return Response.json({ ok: false, error: "payload_too_large" }, { status: 413 });
        }

        let payload: Record<string, unknown>;
        try {
          const parsed: unknown = await request.json();
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
          }
          payload = parsed as Record<string, unknown>;
        } catch {
          return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
        }

        acceptedInWindow += 1;
        logReliability("error", "client_error", {
          source: typeof payload.source === "string" ? payload.source : "browser",
          operation: typeof payload.operation === "string" ? payload.operation : undefined,
          route: typeof payload.route === "string" ? payload.route : undefined,
          detail: typeof payload.message === "string" ? payload.message : "Client error",
        });
        return Response.json({ ok: true }, { status: 202 });
      },
      GET: async () => Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 }),
    },
  },
});