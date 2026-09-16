import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Crown, CheckCircle2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  featureGates,
  billingConfig,
  formatPrice,
  type FeatureKey,
  type BillingAudience,
} from "@/lib/billing-config";
import { useRole } from "@/lib/use-role";

interface UpgradeModalProps {
  feature: FeatureKey;
  open: boolean;
  onClose: () => void;
}

/**
 * Shared upgrade prompt shown whenever a user taps a locked premium feature.
 * Automatically scopes to the authenticated user's profile type.
 *
 * Admin users bypass the feature gate entirely via use-feature-gate.ts, so
 * this modal should never appear for admin accounts.
 */
export function UpgradeModal({ feature, open, onClose }: UpgradeModalProps) {
  const { role } = useRole();
  const gate = featureGates[feature];

  // Resolve the user's billing audience from their profile type.
  const userAudience = useMemo((): BillingAudience => {
    if (role === "vendor") return "vendor";
    if (role === "organization") return "planner";
    return "host";
  }, [role]);

  // Find the plan in the feature's requiredPlans list that matches this user's audience.
  // Fall back to the first plan if no audience match (e.g., feature only unlocked on one audience).
  const requiredPlanId =
    gate?.requiredPlans.find((pid) => billingConfig.plans[pid]?.audience === userAudience) ??
    gate?.requiredPlans[0];
  const plan = requiredPlanId ? billingConfig.plans[requiredPlanId] : null;
  const { amount, period } = plan ? formatPrice(plan) : { amount: "", period: "" };

  if (!gate) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-md sm:p-6">
        <DialogHeader>
          <div className="mb-3 flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-gold/15">
              <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <Badge variant="secondary" className="text-xs">Premium feature</Badge>
          </div>
          <DialogTitle className="text-xl">Unlock {gate.label}</DialogTitle>
          <DialogDescription className="text-sm">{gate.description}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 py-1">
          {gate.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        {plan && (
          <div className="min-w-0 overflow-hidden rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{plan.name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{plan.tagline}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-xl font-semibold">{amount}</p>
                {period && <p className="text-xs text-muted-foreground">{period}</p>}
              </div>
            </div>
            {plan.trialDays > 0 && (
              <p className="mt-2 text-xs text-primary">
                {plan.trialDays}-day free trial · payment method required · renews automatically unless canceled
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1 gap-2" onClick={onClose}>
            <Link to="/subscription" search={{ audience: plan?.audience }}>
              <Crown className="h-4 w-4" aria-hidden="true" /> Upgrade now
            </Link>
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
