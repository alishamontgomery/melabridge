import { safeErrorRecord } from "./reliability-logger";

let reportsThisWindow = 0;
let windowStartedAt = 0;
const MAX_REPORTS_PER_MINUTE = 20;

export function reportClientReliabilityError(
  error: unknown,
  context: { source?: string; operation?: string } = {},
): void {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - windowStartedAt >= 60_000) {
    windowStartedAt = now;
    reportsThisWindow = 0;
  }
  if (reportsThisWindow >= MAX_REPORTS_PER_MINUTE) return;
  reportsThisWindow += 1;

  const payload = safeErrorRecord(error, {
    source: context.source ?? "browser",
    operation: context.operation,
    route: window.location.pathname,
  });

  void fetch("/api/telemetry/client-error", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Reporting must never create a second visible application error.
  });
}