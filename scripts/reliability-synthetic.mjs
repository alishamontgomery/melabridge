#!/usr/bin/env node
import { chromium } from "playwright";

const baseUrl = process.env.APP_URL || "http://localhost:5000";
const productionUrl = process.env.PRODUCTION_URL || "https://melabridge.com";
const cronSecret = process.env.CRON_SECRET;
const checks = [];

function add(name, status, detail, latencyMs) {
  checks.push({
    name,
    status,
    detail: String(detail).replace(/\s+/g, " ").slice(0, 500),
    ...(typeof latencyMs === "number" ? { latencyMs } : {}),
    nonDestructive: true,
  });
}

async function pageCheck(name, path, expected) {
  const started = Date.now();
  try {
    const response = await fetch(new URL(path, baseUrl), {
      headers: { accept: "text/html" },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const location = response.headers.get("location") || "";
    if (response.status >= 300 && response.status < 400 && /clerk/i.test(location)) {
      add(name, "blocked", `HTTP ${response.status}; Clerk browser handshake required`, Date.now() - started);
      return;
    }
    const body = await response.text();
    const missing = expected.filter((text) => !body.includes(text));
    add(name, response.ok && missing.length === 0 ? "ok" : "degraded",
      response.ok && missing.length === 0
        ? `HTTP ${response.status}`
        : `HTTP ${response.status}; missing: ${missing.join(", ") || "response body"}`,
      Date.now() - started);
  } catch (error) {
    add(name, "degraded", error instanceof Error ? error.message : "request failed", Date.now() - started);
  }
}

async function routeCheck(name, path) {
  const started = Date.now();
  try {
    const response = await fetch(new URL(path, baseUrl), {
      headers: { accept: "text/html" },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const reachable = response.status >= 200 && response.status < 400;
    add(name, reachable ? "blocked" : "degraded",
      reachable
        ? `HTTP ${response.status}; route reachable, authenticated flow not executed`
        : `HTTP ${response.status}; route is not reachable`,
      Date.now() - started);
  } catch (error) {
    add(name, "degraded", error instanceof Error ? error.message : "request failed", Date.now() - started);
  }
}

async function healthCheck() {
  const started = Date.now();
  try {
    const response = await fetch(new URL("/api/health", baseUrl), {
      headers: { accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    const payload = JSON.parse(body);
    const hasChecks = payload && typeof payload.checks === "object" && payload.checks !== null;
    add("health_endpoint", hasChecks && response.status < 504 ? "ok" : "degraded",
      hasChecks ? `HTTP ${response.status}; readiness status ${payload.status}` : "Health response missing readiness checks",
      Date.now() - started);
  } catch (error) {
    add("health_endpoint", "degraded", error instanceof Error ? error.message : "health request failed", Date.now() - started);
  }
}

async function productionCheck() {
  const started = Date.now();
  try {
    const response = await fetch(new URL("/", productionUrl), {
      headers: { accept: "text/html" },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const location = response.headers.get("location") || "";
    const body = await response.text();
    const redirectedToWww = /https?:\/\/www\.melabridge\.com/i.test(location);
    const healthy = response.status === 200 && body.includes("MelaBridge") && !redirectedToWww;
    add(
      "production_canonical_host",
      healthy ? "ok" : "degraded",
      healthy
        ? `HTTP ${response.status}; canonical host is ${new URL(productionUrl).hostname}`
        : `HTTP ${response.status}; production host redirected or missing the app surface${location ? ` (${location})` : ""}`,
      Date.now() - started,
    );
  } catch (error) {
    add(
      "production_canonical_host",
      "degraded",
      error instanceof Error ? error.message : "production request failed",
      Date.now() - started,
    );
  }
}

async function productionHealthCheck() {
  const started = Date.now();
  try {
    const response = await fetch(new URL("/api/health", productionUrl), {
      headers: { accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json();
    const hasChecks = payload && typeof payload.checks === "object" && payload.checks !== null;
    const healthy = response.status === 200 && hasChecks;
    add(
      "production_health_endpoint",
      healthy ? "ok" : "degraded",
      healthy
        ? `HTTP ${response.status}; readiness status ${payload.status}`
        : `HTTP ${response.status}; production health response missing readiness checks`,
      Date.now() - started,
    );
  } catch (error) {
    add(
      "production_health_endpoint",
      "degraded",
      error instanceof Error ? error.message : "production health request failed",
      Date.now() - started,
    );
  }
}

async function productionClerkHandshakeCheck() {
  const started = Date.now();
  try {
    const response = await fetch(
      new URL("/api/__clerk/v1/client/handshake?_clerk_js_version=5.125.0", productionUrl),
      {
        headers: { accept: "application/json" },
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      },
    );
    const body = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(body);
    } catch {
      // A non-JSON response is handled as a failed Clerk transport below.
    }
    const errors = Array.isArray(payload?.errors) ? payload.errors : [];
    const hostInvalid = errors.some((error) => error?.code === "host_invalid");
    const healthy = response.status < 400 && !hostInvalid;
    add(
      "production_clerk_handshake",
      healthy ? "ok" : "degraded",
      healthy
        ? `HTTP ${response.status}; Clerk production handshake accepted`
        : hostInvalid
          ? "Clerk returned host_invalid for the production domain"
          : `HTTP ${response.status}; Clerk production handshake was not accepted`,
      Date.now() - started,
    );
  } catch (error) {
    add(
      "production_clerk_handshake",
      "degraded",
      error instanceof Error ? error.message : "production Clerk handshake failed",
      Date.now() - started,
    );
  }
}

async function browserChecks() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });

    for (const path of ["/", "/pricing", "/marketplace", "/auth"]) {
      const started = Date.now();
      try {
        await page.goto(new URL(path, baseUrl).toString(), {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });
        await page.waitForTimeout(1200);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        add(`mobile_navigation_${path === "/" ? "home" : path.slice(1)}`,
          overflow ? "degraded" : "ok",
          overflow ? "Horizontal overflow at 390px viewport" : "Loaded at 390px viewport",
          Date.now() - started);
      } catch (error) {
        add(`mobile_navigation_${path === "/" ? "home" : path.slice(1)}`, "degraded",
          error instanceof Error ? error.message : "browser navigation failed",
          Date.now() - started);
      }
    }

    await page.goto(new URL("/", baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(1200);
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    const homepagePricing = page.locator("#pricing");
    const homeText = await homepagePricing.innerText();
    const homeCards = await homepagePricing.locator("div.mt-14 > div").count();
    const homeAnnual = await homepagePricing.getByRole("button", { name: /Annual · \$290\/year/ }).count();
    if (homeCards !== 3 || !homeText.includes("$29/month") || homeAnnual !== 1) {
      add("planner_billing_selection", "degraded", `Homepage pricing surface mismatch: ${homeCards} cards`, undefined);
    } else {
      await homepagePricing.getByRole("button", { name: /Annual · \$290\/year/ }).click();
      const annualText = await homepagePricing.innerText();
      const href = await homepagePricing.getByRole("link", { name: /Start 5-day free trial/ }).getAttribute("href");
      const preservesAnnual = href?.includes("billing=annual") || href?.includes("billing%3Dannual");
      add("planner_billing_selection", annualText.includes("Save $58") && preservesAnnual ? "ok" : "degraded",
        annualText.includes("Save $58") ? "Annual selection and savings rendered" : "Annual selection did not render expected savings");
    }

    await page.goto(new URL("/pricing", baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
    const pricingText = await page.locator("#plans").innerText();
    const pricingCards = await page.locator("#plans div.grid").first().locator(":scope > div").count();
    add("public_pricing_cards", pricingCards === 3 && pricingText.includes("$290/year") ? "ok" : "degraded",
      `${pricingCards} public cards; annual price ${pricingText.includes("$290/year") ? "present" : "missing"}`);

    await page.goto(new URL("/marketplace", baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
    const search = page.getByRole("textbox", { name: "Search vendors" });
    await search.fill("__melabridge_monitor_no_native_vendor__");
    await page.waitForTimeout(1800);
    const marketplaceText = await page.locator("body").innerText();
    const googleState = /Google result|External search is not configured|No vendors match|No vendors available yet/.test(marketplaceText);
    add("google_places_zero_native_search",
      marketplaceText.includes("0 native vendors") && googleState ? "ok" : "degraded",
      marketplaceText.includes("0 native vendors")
        ? "Zero-native search rendered without creating marketplace data"
        : "Marketplace did not expose the zero-native state");

    const authWarnings = browserErrors.filter((error) => /infinite redirect loop|Clerk/i.test(error));
    add("clerk_auth_readiness",
      authWarnings.length > 0 ? "degraded" : "blocked",
      authWarnings.length > 0
        ? "Clerk browser reported a session/instance warning"
        : "Signed-out auth surface loaded; no test session or signup was created");

    if (browserErrors.length > 0 && authWarnings.length === 0) {
      add("browser_console_errors", "degraded", browserErrors.join(" | "));
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  await Promise.all([
    productionCheck(),
    productionHealthCheck(),
    productionClerkHandshakeCheck(),
  ]);
  await pageCheck("public_homepage", "/", ["MelaBridge"]);
  await pageCheck("public_pricing", "/pricing", ["Planner Pro", "$290/year"]);
  await pageCheck("clerk_auth_surface", "/auth", ["Sign in", "Create account"]);
  await pageCheck("marketplace_surface", "/marketplace", ["Marketplace", "native vendor"]);
  await healthCheck();
  for (const [name, path] of [
    ["vendor_creation_route", "/vendor-profile-builder"],
    ["vendor_preview_route", "/vendor-profile/demo?preview=1"],
    ["vendor_publish_route", "/vendor-profile-builder"],
    ["melaassist_package_suggestion_route", "/vendor-packages"],
    ["ticket_route", "/ticket/demo"],
    ["ticket_scan_route", "/checkin/demo"],
    ["staff_scan_route", "/staff-checkin/demo"],
  ]) await routeCheck(name, path);

  try {
    await browserChecks();
  } catch (error) {
    add("browser_synthetic_runner", "degraded", error instanceof Error ? error.message : "browser runner failed");
  }

  add("stripe_live_checkout", "not_run", "No checkout session or charge is created by the monitor.");
  const overall = checks.some((check) => check.status === "degraded")
    ? "degraded"
    : checks.some((check) => check.status === "blocked" || check.status === "not_run")
      ? "blocked"
      : "ok";
  const run = {
    startedAt: new Date(Date.now() - 1).toISOString(),
    completedAt: new Date().toISOString(),
    overall,
    checks,
  };
  if (cronSecret) {
    const response = await fetch(new URL("/api/monitor/report", baseUrl), {
      method: "POST",
      headers: {
        authorization: `Bearer ${cronSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(run),
    });
    if (!response.ok) throw new Error(`Monitor report rejected with HTTP ${response.status}`);
  }
  console.log(`[reliability-synthetic] ${overall}; ${checks.filter((check) => check.status === "ok").length}/${checks.length} checks passed`);
  for (const check of checks) console.log(`[reliability-synthetic] ${check.status.toUpperCase()} ${check.name}: ${check.detail}`);
  process.exitCode = overall === "degraded" ? 1 : 0;
}

await main();