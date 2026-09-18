import { describe, expect, it, vi } from "vitest";
import {
  isSubscriptionStale,
  loadSubscriptionWithReconciliation,
  SUBSCRIPTION_RECONCILE_AFTER_MS,
} from "./use-subscription";

describe("isSubscriptionStale", () => {
  const now = Date.parse("2026-09-18T12:00:00.000Z");

  it("does not reconcile a recently updated subscription", () => {
    expect(isSubscriptionStale({ updated_at: new Date(now - 1_000).toISOString() }, now)).toBe(false);
  });

  it("reconciles a subscription once the freshness window expires", () => {
    expect(isSubscriptionStale({
      updated_at: new Date(now - SUBSCRIPTION_RECONCILE_AFTER_MS).toISOString(),
    }, now)).toBe(true);
  });

  it("treats an invalid update timestamp as stale", () => {
    expect(isSubscriptionStale({ updated_at: "invalid" }, now)).toBe(true);
  });

  it("does not call reconciliation when no local subscription exists", () => {
    expect(isSubscriptionStale(null, now)).toBe(false);
  });
});

describe("loadSubscriptionWithReconciliation", () => {
  const stale = {
    updated_at: "2020-01-01T00:00:00.000Z",
  } as never;
  const fresh = {
    updated_at: new Date().toISOString(),
  } as never;

  it("returns the refreshed row after successful reconciliation", async () => {
    const read = vi.fn().mockResolvedValueOnce(stale).mockResolvedValueOnce(fresh);
    const reconcile = vi.fn().mockResolvedValue({ ok: true, reconciled: true });

    await expect(loadSubscriptionWithReconciliation({ read, reconcile })).resolves.toBe(fresh);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("falls back to the local row when the server request rejects", async () => {
    const read = vi.fn().mockResolvedValue(stale);
    const reconcile = vi.fn().mockRejectedValue(new Error("network unavailable"));

    await expect(loadSubscriptionWithReconciliation({ read, reconcile })).resolves.toBe(stale);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("falls back to the local row when reconciliation returns an error", async () => {
    const read = vi.fn().mockResolvedValue(stale);
    const reconcile = vi.fn().mockResolvedValue({ error: "Stripe unavailable" });

    await expect(loadSubscriptionWithReconciliation({ read, reconcile })).resolves.toBe(stale);
    expect(read).toHaveBeenCalledTimes(1);
  });
});