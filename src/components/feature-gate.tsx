import { useState, type ReactNode } from "react";
import { Crown, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFeatureGate } from "@/hooks/use-feature-gate";
import { UpgradeModal } from "@/components/upgrade-modal";
import { featureGates, type FeatureKey } from "@/lib/billing-config";

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  /**
   * Custom locked-state UI. If omitted, renders the built-in upgrade card.
   * Receives `onUpgrade` so it can trigger the shared UpgradeModal.
   */
  fallback?: (onUpgrade: () => void) => ReactNode;
}

/**
 * Wraps a premium surface. Renders children when the user's plan allows the
 * feature; renders a polished upgrade prompt otherwise.
 *
 * Example:
 *   <FeatureGate feature="ticketing">
 *     <TicketsTab ... />
 *   </FeatureGate>
 */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { allowed, loading } = useFeatureGate(feature);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Show nothing while subscription data loads to avoid flash of wrong state
  if (loading) return null;

  if (allowed) return <>{children}</>;

  const gate = featureGates[feature];
  const open = () => setUpgradeOpen(true);

  return (
    <>
      {fallback ? (
        fallback(open)
      ) : (
        <Card className="border-border/60 p-12 text-center shadow-soft">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/10 to-gold/10">
            <Lock className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <h3 className="font-display text-lg font-semibold">
            {gate?.label ?? "Premium feature"}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {gate?.description ?? "Upgrade your plan to unlock this feature."}
          </p>
          {gate?.benefits && gate.benefits.length > 0 && (
            <ul className="mx-auto mt-4 max-w-xs space-y-1.5 text-left text-sm text-muted-foreground">
              {gate.benefits.slice(0, 3).map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {b}
                </li>
              ))}
            </ul>
          )}
          <Button className="mt-6 gap-2" onClick={open}>
            <Crown className="h-4 w-4" aria-hidden="true" /> Unlock this feature
          </Button>
        </Card>
      )}
      <UpgradeModal feature={feature} open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </>
  );
}
