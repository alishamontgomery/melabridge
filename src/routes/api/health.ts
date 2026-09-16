import { createFileRoute } from "@tanstack/react-router";
import { externalClerkOptions } from "@/lib/clerk-config.server";
import { hasAiProvider } from "@/lib/ai-client.server";
import { getSyntheticMonitorStatus } from "@/lib/reliability-monitor";
import { safeErrorMessage } from "@/lib/reliability-logger";

type CheckStatus = "ok" | "degraded" | "unknown";

type ReadinessCheck = {
  status: CheckStatus;
  configured?: boolean;
  detail?: string;
};

function keyMode(value: string | undefined): "test" | "live" | null {
  if (value?.startsWith("pk_test_") || value?.startsWith("sk_test_")) return "test";
  if (value?.startsWith("pk_live_") || value?.startsWith("sk_live_")) return "live";
  return null;
}

function providerReadiness(): Record<string, ReadinessCheck> {
  const publishable = process.env.CLERK_PUBLISHABLE_KEY;
  const secret = process.env.CLERK_SECRET_KEY;
  const publishableMode = keyMode(publishable);
  const secretMode = keyMode(secret);
  let clerk: ReadinessCheck;
  try {
    externalClerkOptions();
    clerk =
      publishableMode && secretMode && publishableMode !== secretMode
        ? { status: "degraded", configured: true, detail: "Clerk key environments do not match" }
        : { status: "ok", configured: true, detail: "Keys are configured; session handshake is monitored separately" };
  } catch (error) {
    clerk = { status: "degraded", configured: false, detail: safeErrorMessage(error) };
  }

  const supabaseConfigured = Boolean(
    process.env.SUPABASE_URL && process.env.service_role,
  );
  return {
    clerk,
    supabase: {
      status: supabaseConfigured ? "ok" : "degraded",
      configured: supabaseConfigured,
      detail: supabaseConfigured ? undefined : "Supabase server configuration is incomplete",
    },
    stripe: {
      status: process.env.STRIPE_SECRET_KEY ? "ok" : "degraded",
      configured: Boolean(process.env.STRIPE_SECRET_KEY),
      detail: process.env.STRIPE_SECRET_KEY ? undefined : "Stripe server key is not configured",
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
        const checks = providerReadiness();
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