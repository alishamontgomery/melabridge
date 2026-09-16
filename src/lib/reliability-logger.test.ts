import { describe, expect, it } from "vitest";
import { safeErrorRecord, safeRoute } from "./reliability-logger";

describe("reliability redaction", () => {
  it("removes credentials, email addresses, and long identifiers", () => {
    const record = safeErrorRecord(
      new Error("Bearer abc123 sk_test_secret person@example.com"),
      { route: "/events/12345678-1234-1234-1234-123456789012" },
    );
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain("abc123");
    expect(serialized).not.toContain("sk_test_secret");
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("12345678-1234-1234-1234-123456789012");
    expect(record.route).toBe("/events/:id");
  });

  it("drops query strings before recording a route", () => {
    expect(safeRoute("/pricing?billing=annual&email=person@example.com")).toBe("/pricing");
  });
});