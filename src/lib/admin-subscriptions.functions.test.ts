import { describe, expect, it } from "vitest";
import { summarizeCurrentPlanRows } from "./admin-subscriptions.functions";

describe("summarizeCurrentPlanRows", () => {
  const now = "2026-09-16T00:00:00.000Z";

  it("excludes expired rows from current customer and plan totals", () => {
    const summary = summarizeCurrentPlanRows(
      [
        {
          price_id: "unknown-current",
          current_period_end: "2026-09-17T00:00:00.000Z",
          user_id: "current-user",
        },
        {
          price_id: "unknown-expired",
          current_period_end: "2026-09-15T00:00:00.000Z",
          user_id: "expired-user",
        },
      ],
      now,
    );

    expect(summary.activeCustomers).toBe(1);
    expect(summary.planBreakdown).toEqual([
      { priceId: "unknown-current", count: 1 },
    ]);
  });

  it("aggregates every row in datasets larger than Supabase's default response cap", () => {
    const rows = Array.from({ length: 1_205 }, (_, index) => ({
      price_id: index < 1_100 ? "plan-a" : "plan-b",
      current_period_end: null,
      user_id: `user-${index}`,
    }));

    const summary = summarizeCurrentPlanRows(rows, now);

    expect(summary.activeCustomers).toBe(1_205);
    expect(summary.planBreakdown).toEqual([
      { priceId: "plan-a", count: 1_100 },
      { priceId: "plan-b", count: 105 },
    ]);
  });
});