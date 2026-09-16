import { logReliability, safeErrorMessage, safeRoute } from "./reliability-logger";

export type SyntheticStatus = "ok" | "degraded" | "blocked" | "not_run";

export type SyntheticCheck = {
  name: string;
  status: SyntheticStatus;
  latencyMs?: number;
  detail: string;
  nonDestructive: true;
};

export type SyntheticMonitorRun = {
  startedAt: string;
  completedAt: string;
  overall: SyntheticStatus;
  checks: SyntheticCheck[];
};

let lastRun: SyntheticMonitorRun | null = null;

export function getSyntheticMonitorStatus(): SyntheticMonitorRun | null {
  return lastRun;
}

export function recordSyntheticMonitorRun(run: SyntheticMonitorRun): void {
  lastRun = run;
  for (const check of run.checks) {
    if (check.status === "degraded") {
      logReliability("error", "synthetic_check_failed", {
        operation: check.name,
        detail: check.detail,
      });
    }
  }
  logReliability("info", "synthetic_monitor_completed", {
    operation: "reliability_monitor",
    detail: `${run.overall}; ${run.checks.filter((check) => check.status === "ok").length}/${run.checks.length} checks passed`,
  });
}

function appUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString();
}

async function checkPage(
  baseUrl: string,
  name: string,
  path: string,
  expectedText: string[],
): Promise<SyntheticCheck> {
  const startedAt = Date.now();
  try {
    const response = await fetch(appUrl(baseUrl, path), {
      headers: { accept: "text/html,application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    const body = (await response.text()).slice(0, 120_000);
    const missing = expectedText.filter((text) => !body.includes(text));
    const status: SyntheticStatus = response.ok && missing.length === 0 ? "ok" : "degraded";
    return {
      name,
      status,
      latencyMs: Date.now() - startedAt,
      detail: status === "ok"
        ? `HTTP ${response.status}`
        : `HTTP ${response.status}; missing expected surface: ${missing.join(", ") || "response body"}`,
      nonDestructive: true,
    };
  } catch (error) {
    return {
      name,
      status: "degraded",
      latencyMs: Date.now() - startedAt,
      detail: safeErrorMessage(error),
      nonDestructive: true,
    };
  }
}

async function checkRouteReachable(
  baseUrl: string,
  name: string,
  path: string,
): Promise<SyntheticCheck> {
  const startedAt = Date.now();
  try {
    const response = await fetch(appUrl(baseUrl, path), {
      headers: { accept: "text/html" },
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
    });
    const status: SyntheticStatus =
      response.status >= 200 && response.status < 400 ? "ok" : "degraded";
    return {
      name,
      status,
      latencyMs: Date.now() - startedAt,
      detail: status === "ok"
        ? `HTTP ${response.status}; route reachable, authenticated flow not executed`
        : `HTTP ${response.status}; route is not reachable`,
      nonDestructive: true,
    };
  } catch (error) {
    return {
      name,
      status: "degraded",
      latencyMs: Date.now() - startedAt,
      detail: safeErrorMessage(error),
      nonDestructive: true,
    };
  }
}

export async function runSyntheticMonitor(baseUrl: string): Promise<SyntheticMonitorRun> {
  const startedAt = new Date().toISOString();
  const checks = await Promise.all([
    checkPage(baseUrl, "public_homepage", "/", ["MelaBridge"]),
    checkPage(baseUrl, "public_pricing", "/pricing", ["Planner Pro", "$290/year"]),
    checkPage(baseUrl, "clerk_auth_readiness", "/auth", ["Sign in", "Create account"]),
    checkRouteReachable(baseUrl, "vendor_creation_route", "/vendor-profile-builder"),
    checkRouteReachable(baseUrl, "vendor_preview_route", "/vendor-profile/demo?preview=1"),
    checkRouteReachable(baseUrl, "vendor_publish_route", "/vendor-profile-builder"),
    checkRouteReachable(baseUrl, "melaassist_package_suggestion_route", "/vendor-packages"),
    checkPage(baseUrl, "marketplace_zero_native_surface", "/marketplace", ["Marketplace", "native vendor"]),
    checkPage(baseUrl, "planner_billing_selection_surface", "/pricing", ["Monthly", "Annual", "$290/year"]),
    checkRouteReachable(baseUrl, "ticket_route", "/ticket/demo"),
    checkRouteReachable(baseUrl, "ticket_scan_route", "/checkin/demo"),
    checkRouteReachable(baseUrl, "staff_scan_route", "/staff-checkin/demo"),
  ]);

  checks.push(
    {
      name: "mobile_navigation",
      status: "not_run",
      detail: "Requires a browser viewport; covered by the separate browser smoke check, not this server-only scheduler.",
      nonDestructive: true,
    },
    {
      name: "google_places_zero_native_search",
      status: "not_run",
      detail: "No external Places query is issued by the recurring monitor; avoids API spend and fabricated marketplace data.",
      nonDestructive: true,
    },
    {
      name: "stripe_live_checkout",
      status: "not_run",
      detail: "No charge or checkout session is created by the recurring monitor.",
      nonDestructive: true,
    },
  );

  const completedAt = new Date().toISOString();
  const overall: SyntheticStatus = checks.some((check) => check.status === "degraded")
    ? "degraded"
    : checks.some((check) => check.status === "blocked" || check.status === "not_run")
      ? "blocked"
      : "ok";
  const run = { startedAt, completedAt, overall, checks };
  recordSyntheticMonitorRun(run);
  return run;
}