import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/lib/auth";
import { reconcileSubscription } from "@/utils/payments.functions";

export interface SubscriptionRow {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  product_id: string;
  price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  environment: string;
  created_at: string;
  updated_at: string;
}

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
export const SUBSCRIPTION_RECONCILE_AFTER_MS = 5 * 60 * 1000;

export function isSubscriptionStale(
  subscription: Pick<SubscriptionRow, "updated_at"> | null,
  now = Date.now(),
) {
  if (!subscription) return false;
  const updatedAt = new Date(subscription.updated_at).getTime();
  return !Number.isFinite(updatedAt) || now - updatedAt >= SUBSCRIPTION_RECONCILE_AFTER_MS;
}

export async function loadSubscriptionWithReconciliation({
  read,
  reconcile,
}: {
  read: () => Promise<SubscriptionRow | null>;
  reconcile: () => Promise<{ ok: true; reconciled: boolean } | { error: string }>;
}) {
  const local = await read();
  if (!isSubscriptionStale(local)) return local;

  try {
    const result = await reconcile();
    if ("ok" in result && result.reconciled) return await read();
  } catch (error) {
    console.warn("[useSubscription] Stripe reconciliation failed; using local status:", error);
  }
  return local;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const env = (() => {
    try {
      return getStripeEnvironment();
    } catch {
      return null;
    }
  })();

  const refetch = async () => {
    if (!user || !env) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const read = async () => {
      const { data } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .eq("environment", env)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      return (data as SubscriptionRow | null) ?? null;
    };
    try {
      const data = await loadSubscriptionWithReconciliation({
        read,
        reconcile: () => reconcileSubscription({ data: { environment: env } }),
      });
      setSubscription(data);
    } catch (error) {
      console.warn("[useSubscription] Subscription load failed:", error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
    if (!user) return;

    // Wrap in try/catch: Supabase Realtime can throw synchronously when
    // the table isn't in the realtime publication, or during React StrictMode's
    // effect double-invoke. A crash here should never take down the whole page —
    // the subscription data is already fetched via refetch() above.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        // Supabase reuses channels by topic. React StrictMode can remount this
        // effect before the prior async removal finishes, so every subscription
        // needs a distinct topic rather than attaching handlers to a subscribed
        // channel from the previous effect.
        .channel(`subscriptions:${user.id}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
          () => refetch(),
        )
        .subscribe();
    } catch (e) {
      console.warn("[useSubscription] Realtime setup failed (live updates disabled):", e);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, env]);

  const isActive = !!subscription && (
    (ACTIVE_STATUSES.has(subscription.status) &&
      (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date())) ||
    (subscription.status === "canceled" && subscription.current_period_end &&
      new Date(subscription.current_period_end) > new Date())
  );

  return { subscription, loading, isActive: !!isActive, refetch, environment: env };
}
