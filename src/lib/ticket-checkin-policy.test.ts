import { describe, expect, it } from "vitest";
import { isCheckInEligibleOrderStatus } from "./ticket-checkin-policy";

describe("isCheckInEligibleOrderStatus", () => {
  it("keeps paid and partially refunded attendee tickets valid", () => {
    expect(isCheckInEligibleOrderStatus("paid")).toBe(true);
    expect(isCheckInEligibleOrderStatus("partially_refunded")).toBe(true);
  });

  it.each(["refunded", "failed", "expired", null, undefined])(
    "rejects invalid order status %s",
    (status) => {
      expect(isCheckInEligibleOrderStatus(status)).toBe(false);
    },
  );
});