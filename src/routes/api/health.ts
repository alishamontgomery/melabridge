import { createFileRoute } from "@tanstack/react-router";
import { checkExternalClerkCredentials } from "@/lib/clerk-config.server";
import { hasAiProvider } from "@/lib/ai-client.server";
import { getSyntheticMonitorStatus } from "@/lib/reliability-monitor";
import { safeErrorMessage } from "@/lib/reliability-logger";
import { getStripeSecretKey } from "@/lib/stripe.server";

type CheckStatus = "ok" | "degraded" | "unknown";

type ReadinessCheck = {
  status: CheckStatus;
  configured?: boolean;
  detail?: string;
};

async function providerReadiness(): Promise<Record<string, ReadinessCheck>> {
  const clerkCheck = await checkExternalClerkCredentials();
  const clerk: ReadinessCheck =
    clerkCheck.issue === "ok"
      ? { status: "ok", configured: true, detail: clerkCheck.message }
      : clerkCheck.issue === "unavailable"
        ? { status: "unknown", configured: true, detail: clerkCheck.message }
        : {
            status: "degraded",
            configured: clerkCheck.issue !== "missing" && clerkCheck.issue !== "malformed",
            detail: clerkCheck.message,
          };

  const supabaseConfigured = Boolean(
    process.env.SUPABASE_URL && process.env.service_role,
  );
  const stripeConfigured = Boolean(
    getStripeSecretKey("live") ?? getStripeSecretKey("sandbox"),
  );
  return {
    clerk,
    supabase: {
      status: supabaseConfigured ? "ok" : "degraded",
      configured: supabaseConfigured,
      detail: supabaseConfigured ? undefined : "Supabase server configuration is incomplete",
    },
    stripe: {
      status: stripeConfigured ? "ok" : "degraded",
      configured: stripeConfigured,
      detail: stripeConfigured ? undefined : "Stripe server key is not configured",
    },
    gemini: {
      status: hasAiProvider() ? "ok" : "degraded",
      configured: hasAiProvider(),
      detail: hasAiProvider() ? undefined : "MelaAssist provider key is not configured",
    },
    googlePlaces: {
      status: process.env.GOOGLE_PLACES_API_KEY ? "ok" : "degraded",
      configured: Boolean(process.env.GOOGLE_PLACES_API_KEY),
      detail: process.env.GOOGLE_PLACES_API_KEY ? undefined : "Google Places fallback is not configured",
    },
    resend: {
      status: "unknown",
      detail: "Resend is managed through the installed connector; delivery is checked by send results",
    },
  };
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const checkedAt = new Date().toISOString();
        const checks = await providerReadiness();
        let database: ReadinessCheck;
        const startedAt = Date.now();
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("profiles").select("id").limit(1);
          database = error
            ? { status: "degraded", detail: "Database readiness query failed" }
            : { status: "ok", detail: `${Date.now() - startedAt}ms` };
        } catch (error) {
          database = { status: "degraded", detail: safeErrorMessage(error).slice(0, 180) };
        }

        const allChecks = { app: { status: "ok" as const }, database, ...checks };
        const status: CheckStatus = Object.values(allChecks).every((check) => check.status === "ok")
          ? "ok"
          : Object.values(allChecks).some((check) => check.status === "degraded")
            ? "degraded"
            : "unknown";
        return Response.json({
          status,
          checkedAt,
          checks: allChecks,
          synthetic: getSyntheticMonitorStatus(),
        }, { status: status === "degraded" ? 503 : 200 });
      },
    },
  },
});