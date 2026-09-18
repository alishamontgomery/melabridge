import { describe, expect, it, vi } from "vitest";
import { reconcileStripeSubscriptionSnapshot } from "./payments.functions";

function stripeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_test",
    customer: "cus_test",
    metadata: { userId: "user-id" },
    status: "active",
    cancel_at_period_end: false,
    items: {
      data: [{
        current_period_start: 1_700_000_000,
        current_period_end: 1_702_592_000,
        price: { id: "price_test", lookup_key: "planner_pro", product: "prod_test" },
      }],
    },
    ...overrides,
  };
}

describe("reconcileStripeSubscriptionSnapshot", () => {
  it("rejects a Stripe subscription owned by another user without writing", async () => {
    const rpc = vi.fn();
    const result = await reconcileStripeSubscriptionSnapshot({
      subscription: stripeSubscription({ metadata: { userId: "other-user" } }),
      supabaseAdmin: { rpc },
      userId: "user-id",
      environment: "sandbox",
    });

    expect(result).toEqual({ error: "Subscription ownership could not be verified." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("writes the current Stripe snapshot through the ordered RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const result = await reconcileStripeSubscriptionSnapshot({
      subscription: stripeSubscription({ cancel_at_period_end: true }),
      supabaseAdmin: { rpc },
      userId: "user-id",
      environment: "sandbox",
      now: 1_800_000_000_000,
    });

    expect(result).toEqual({ ok: true, reconciled: true });
    expect(rpc).toHaveBeenCalledWith("sync_subscription_stripe_event", expect.objectContaining({
      _user_id: "user-id",
      _stripe_subscription_id: "sub_test",
      _stripe_customer_id: "cus_test",
      _product_id: "prod_test",
      _price_id: "planner_pro",
      _status: "active",
      _cancel_at_period_end: true,
      _event_created_at: 1_800_000_000,
      _event_priority: 4,
    }));
  });

  it("returns a safe error when the ordered write fails", async () => {
    const result = await reconcileStripeSubscriptionSnapshot({
      subscription: stripeSubscription(),
      supabaseAdmin: { rpc: vi.fn().mockResolvedValue({ error: new Error("db unavailable") }) },
      userId: "user-id",
      environment: "sandbox",
    });

    expect(result).toEqual({ error: "Unable to save the latest subscription status." });
  });
});