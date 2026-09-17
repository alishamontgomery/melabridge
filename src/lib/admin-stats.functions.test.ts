import { describe, expect, it, vi } from "vitest";
import { applyActiveSubscriptionFilters } from "./admin-stats.functions";

describe("applyActiveSubscriptionFilters", () => {
  it("defines the dashboard metric as unexpired active plus trialing subscriptions", () => {
    const query = {
      in: vi.fn(),
      or: vi.fn(),
    };
    query.in.mockReturnValue(query);
    query.or.mockReturnValue(query);
    const nowIso = "2026-09-17T00:00:00.000Z";

    expect(applyActiveSubscriptionFilters(query, nowIso)).toBe(query);
    expect(query.in).toHaveBeenCalledWith("status", ["active", "trialing"]);
    expect(query.or).toHaveBeenCalledWith(
      `current_period_end.is.null,current_period_end.gt.${nowIso}`,
    );
  });
});