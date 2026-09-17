import { describe, expect, it } from "vitest";
import {
  normalizeDateInput,
  normalizeEmailInput,
  normalizeTimeInput,
  isValidTimeInput,
  trimOrNull,
} from "./event-input-normalization";

describe("event input normalization", () => {
  it("removes boundary whitespace without changing meaningful text", () => {
    expect(trimOrNull("  Birthday party  ")).toBe("Birthday party");
    expect(trimOrNull("   ")).toBeNull();
  });

  it("normalizes database time values to the form/API format", () => {
    expect(normalizeTimeInput(" 09:30:00 ")).toBe("09:30");
    expect(normalizeTimeInput("17:45")).toBe("17:45");
    expect(normalizeTimeInput("")).toBeNull();
  });

  it("leaves malformed time values visible for validation", () => {
    expect(normalizeTimeInput(" 9:30 ")).toBe("9:30");
    expect(normalizeTimeInput("25:00")).toBe("25:00");
    expect(isValidTimeInput("23:59")).toBe(true);
    expect(isValidTimeInput("24:00")).toBe(false);
  });

  it("normalizes date and email boundaries", () => {
    expect(normalizeDateInput(" 2026-09-17 ")).toBe("2026-09-17");
    expect(normalizeEmailInput(" Guest@Example.COM ")).toBe("guest@example.com");
  });
});