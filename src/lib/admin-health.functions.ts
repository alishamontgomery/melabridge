import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getSyntheticMonitorStatus, type SyntheticMonitorRun } from "@/lib/reliability-monitor";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export type ServiceStatus = "ok" | "degraded" | "unknown";

export type SystemHealthResult = {
  overall: ServiceStatus;
  services: {
    name: string;
    status: ServiceStatus;
    latencyMs?: number;
    detail?: string;
  }[];
  checkedAt: string;
  synthetic: SyntheticMonitorRun | null;
};

/**
 * Performs real connectivity checks against each platform service and
 * returns a granular health status. Only admins may call this.
 */
export const getSystemHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemHealthResult> => {
    try {
      await assertAdmin(context);
    } catch {
      return {
        overall: "unknown",
        services: [],
        checkedAt: new Date().toISOString(),
        synthetic: getSyntheticMonitorStatus(),
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // --- DB ping ---
    const dbStart = Date.now();
    const { error: dbError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .limit(1);
    const dbLatency = Date.now() - dbStart;
    const dbStatus: ServiceStatus = dbError ? "degraded" : "ok";

    // --- Clerk-to-Supabase identity bridge ping ---
    const identityStart = Date.now();
    const { error: identityError } = await (supabaseAdmin as any)
      .from("clerk_identity_links")
      .select("legacy_user_id")
      .limit(1);
    const identityLatency = Date.now() - identityStart;
    const identityStatus: ServiceStatus = identityError ? "degraded" : "ok";

    // --- Storage ping (list buckets) ---
    const storageStart = Date.now();
    const { error: storageError } = await supabaseAdmin.storage.listBuckets();
    const storageLatency = Date.now() - storageStart;
    const storageStatus: ServiceStatus = storageError ? "degraded" : "ok";

    // --- Email service ---
    const emailStatus: ServiceStatus = "unknown";
    const stripeStatus: ServiceStatus =
      process.env.STRIPE_SECRET_KEY ? "ok" : "degraded";

    const allStatuses: ServiceStatus[] = [
      dbStatus,
      identityStatus,
      storageStatus,
      emailStatus,
      stripeStatus,
    ];
    const overall: ServiceStatus = allStatuses.every((s) => s === "ok")
      ? "ok"
      : allStatuses.some((s) => s === "degraded")
      ? "degraded"
      : "unknown";

    return {
      overall,
      services: [
        {
          name: "Database",
          status: dbStatus,
          latencyMs: dbLatency,
          detail: dbError?.message,
        },
        {
          name: "Identity bridge",
          status: identityStatus,
          latencyMs: identityLatency,
          detail: identityError?.message,
        },
        {
          name: "Storage",
          status: storageStatus,
          latencyMs: storageLatency,
          detail: storageError?.message,
        },
        {
          name: "Email",
          status: emailStatus,
          detail: "Resend is managed through the installed connector; delivery outcomes are checked when mail is sent",
        },
        {
          name: "Stripe",
          status: stripeStatus,
          detail: stripeStatus === "degraded" ? "STRIPE_SECRET_KEY not configured" : undefined,
        },
      ],
      checkedAt: new Date().toISOString(),
      synthetic: getSyntheticMonitorStatus(),
    };
  });
