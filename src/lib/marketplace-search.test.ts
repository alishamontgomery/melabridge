import { describe, expect, it } from "vitest";
import {
  matchesMarketplaceKeywords,
  normalizeMarketplaceSearchText,
} from "./marketplace-search";

describe("marketplace keyword search", () => {
  it("normalizes punctuation and accents consistently", () => {
    expect(normalizeMarketplaceSearchText("  Café & Co.  ")).toBe("cafe co");
  });

  it("matches multi-word searches across profile fields", () => {
    expect(
      matchesMarketplaceKeywords("Madison photography", [
        "Oak & Fable",
        "Photography",
        "Madison",
        "AL",
      ]),
    ).toBe(true);
  });

  it("matches a phrase stored as one service field", () => {
    expect(matchesMarketplaceKeywords("photo booth", ["Photo Booth"])).toBe(true);
  });

  it("does not return a vendor missing one of the requested keywords", () => {
    expect(matchesMarketplaceKeywords("Madison catering", ["Madison", "Photography"])).toBe(false);
  });
});