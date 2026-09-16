import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Crown, LockKeyhole } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { featureGates, formatPrice, type FeatureKey } from "@/lib/billing-config";
import { useFeatureGate } from "@/hooks/use-feature-gate";

export function PremiumUpgradeGate({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: ReactNode;
}) {
  const { allowed, loading, requiredPlan } = useFeatureGate(feature);

  if (loading) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground" role="status">
        Checking plan access…
      </Card>
    );
  }

  if (allowed) return <>{children}</>;

  const price = requiredPlan ? formatPrice(requiredPlan) : null;
  const gate = featureGates[feature];

  return (
    <Card className="overflow-hidden border-primary/25 shadow-soft">
      <div className="bg-gradient-to-br from-primary/10 via-background to-gold/10 p-6 text-center sm:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-primary">Upgrade to unlock</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">{gate.label}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          {gate.description}
        </p>
        {requiredPlan && price && (
          <div className="mx-auto mt-5 flex w-fit items-baseline gap-2 rounded-full border border-primary/20 bg-background/80 px-4 py-2">
            <Crown className="h-4 w-4 text-primary" />
            <span className="font-semibold">{requiredPlan.name}</span>
            <span className="text-sm text-muted-foreground">{price.amount}{price.period}</span>
          </div>
        )}
        <Button asChild variant="hero" className="mt-5">
          <Link
            to="/subscription"
            search={{ audience: requiredPlan?.audience === "vendor" ? "vendor" : "planner" }}
          >
            View plans
          </Link>
        </Button>
      </div>
    </Card>
  );
}