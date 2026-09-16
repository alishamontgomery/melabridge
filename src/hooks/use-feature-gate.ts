import { useMemo } from "react";
import { useSubscription } from "./use-subscription";
import { useRole } from "@/lib/use-role";
import {
  findPlanByPriceId,
  planIncludes,
  featureGates,
  billingConfig,
  type FeatureKey,
  type Plan,
} from "@/lib/billing-config";

export interface FeatureGateResult {
  /** Whether the current user's plan unlocks this feature. */
  allowed: boolean;
  /** True while the subscription data is still loading. */
  loading: boolean;
  /** The minimum plan that unlocks this feature (for upgrade prompts). */
  requiredPlan: Plan | null;
  /** True when access is granted via the admin bypass. */
  isAdminBypass: boolean;
}

/**
 * Central feature-gate hook. Reads the user's active subscription and
 * compares it against the feature map in billing-config.ts.
 *
 * Admin users always get `allowed: true` so they can test any premium
 * feature without a subscription or profile-type change.
 *
 * Usage:
 *   const { allowed, loading, requiredPlan, isAdminBypass } = useFeatureGate("ticketing");
 */
export function useFeatureGate(feature: FeatureKey): FeatureGateResult {
  const { subscription, isActive, loading } = useSubscription();
  const { role, loading: roleLoading } = useRole();

  const currentPlan = useMemo(
    () => findPlanByPriceId(subscription?.price_id ?? null),
    [subscription?.price_id],
  );

  const isAdminBypass = role === "admin";
  const allowed = isAdminBypass || (isActive && planIncludes(currentPlan?.id, feature));

  const requiredPlan = useMemo<Plan | null>(() => {
    const gate = featureGates[feature];
    const audience = role === "vendor" ? "vendor" : "planner";
    const id = gate?.requiredPlans.find((planId) => billingConfig.plans[planId]?.audience === audience);
    return id ? (billingConfig.plans[id] ?? null) : null;
  }, [feature, role]);

  return { allowed, loading: loading || roleLoading, requiredPlan, isAdminBypass };
}
