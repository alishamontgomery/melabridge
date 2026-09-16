import { describe, it, expect } from "vitest";
import {
  InquiryInput,
  shouldNotifyVendor,
  sanitizeInquiryError,
  type InquiryRpcResult,
} from "./inquiry-validation";

/**
 * Tests for the vendor-inquiry flow contract.
 *
 * These cover the two pure surfaces of the server function:
 *   1. Zod input validation (shape enforced before the RPC is called).
 *   2. The notification decision — a non-critical side effect that must fire
 *      only for a newly created lead, never for an idempotent duplicate.
 *
 * The atomic multi-row write, caller-role, vendor-onboarded, self-inquiry, date,
 * and concurrent-retry idempotency guarantees are enforced (and re-validated) by
 * the submit_vendor_inquiry SECURITY DEFINER RPC at the database layer.
 */

const VENDOR_UUID = "11111111-1111-4111-8111-111111111111";

describe("InquiryInput validation", () => {
  it("accepts a well-formed inquiry", () => {
    const parsed = InquiryInput.parse({
      vendorId: VENDOR_UUID,
      eventName: "Wedding reception",
      eventDate: "2999-06-01",
      eventType: "Wedding",
      message: "Are you available?",
    });
    expect(parsed.vendorId).toBe(VENDOR_UUID);
    expect(parsed.eventName).toBe("Wedding reception");
  });

  it("trims and allows optional event type and message to be omitted", () => {
    const parsed = InquiryInput.parse({
      vendorId: VENDOR_UUID,
      eventName: "  Birthday party  ",
      eventDate: "2999-06-01",
    });
    expect(parsed.eventName).toBe("Birthday party");
    expect(parsed.eventType).toBeUndefined();
    expect(parsed.message).toBeUndefined();
  });

  it("rejects a non-uuid vendorId", () => {
    expect(() =>
      InquiryInput.parse({
        vendorId: "not-a-uuid",
        eventName: "Event",
        eventDate: "2999-06-01",
      }),
    ).toThrow();
  });

  it("rejects an empty event name", () => {
    expect(() =>
      InquiryInput.parse({
        vendorId: VENDOR_UUID,
        eventName: "   ",
        eventDate: "2999-06-01",
      }),
    ).toThrow();
  });

  it("rejects an event name over 200 characters", () => {
    expect(() =>
      InquiryInput.parse({
        vendorId: VENDOR_UUID,
        eventName: "x".repeat(201),
        eventDate: "2999-06-01",
      }),
    ).toThrow();
  });

  it("rejects a malformed event date", () => {
    expect(() =>
      InquiryInput.parse({
        vendorId: VENDOR_UUID,
        eventName: "Event",
        eventDate: "06/01/2999",
      }),
    ).toThrow();
  });

  it("rejects a message over 2000 characters", () => {
    expect(() =>
      InquiryInput.parse({
        vendorId: VENDOR_UUID,
        eventName: "Event",
        eventDate: "2999-06-01",
        message: "x".repeat(2001),
      }),
    ).toThrow();
  });
});

describe("shouldNotifyVendor", () => {
  it("sends a notification for a newly created lead", () => {
    const result: InquiryRpcResult = {
      duplicate: false,
      booking_id: "b1",
      request_id: "r1",
      vendor_user_id: "u1",
    };
    expect(shouldNotifyVendor(result)).toBe(true);
  });

  it("suppresses the notification for an idempotent duplicate", () => {
    const result: InquiryRpcResult = { duplicate: true, request_id: "r1" };
    expect(shouldNotifyVendor(result)).toBe(false);
  });

  it("treats a missing duplicate flag as a fresh lead", () => {
    expect(shouldNotifyVendor({ booking_id: "b1" })).toBe(true);
  });
});

describe("sanitizeInquiryError", () => {
  it("maps a known validation error to friendly copy", () => {
    expect(sanitizeInquiryError("You cannot submit an inquiry to your own profile")).toBe(
      "You can't send an inquiry to your own profile.",
    );
    expect(sanitizeInquiryError("Vendor is not accepting inquiries yet")).toBe(
      "This vendor isn't accepting inquiries yet.",
    );
  });

  it("trims surrounding whitespace before matching", () => {
    expect(sanitizeInquiryError("  Vendor not found  ")).toBe(
      "We couldn't find that vendor.",
    );
  });

  it("collapses unknown / internal errors to a generic message", () => {
    const generic = "We couldn't send your inquiry. Please try again.";
    expect(
      sanitizeInquiryError(
        'duplicate key value violates unique constraint "uq_cbr_idempotency_key"',
      ),
    ).toBe(generic);
    expect(sanitizeInquiryError("permission denied for function submit_vendor_inquiry")).toBe(
      generic,
    );
  });

  it("returns the generic message for null / undefined / empty input", () => {
    const generic = "We couldn't send your inquiry. Please try again.";
    expect(sanitizeInquiryError(null)).toBe(generic);
    expect(sanitizeInquiryError(undefined)).toBe(generic);
    expect(sanitizeInquiryError("")).toBe(generic);
  });
});
