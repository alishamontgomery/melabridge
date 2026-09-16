import { describe, expect, it } from "vitest";
import {
  loadAllMarketplacePackages,
  getPackageSpecChips,
  matchesCategoryFilters,
  shouldShowExternalFallback,
} from "./marketplace-category-filtering";

describe("matchesCategoryFilters", () => {
  it("requires every selected chip option on the same package", () => {
    expect(
      matchesCategoryFilters(
        { dietary_options: ["Halal", "Vegan", "Nut-free"] },
        { dietary_options: ["Halal", "Vegan"] },
      ),
    ).toBe(true);
    expect(
      matchesCategoryFilters(
        { dietary_options: ["Halal"] },
        { dietary_options: ["Halal", "Vegan"] },
      ),
    ).toBe(false);
  });

  it("matches a requested guest count inside a package range", () => {
    const fields = { min_guests: 50, max_guests: 300 };
    expect(matchesCategoryFilters(fields, { min_guests: 100, max_guests: 100 })).toBe(true);
    expect(matchesCategoryFilters(fields, { min_guests: 25, max_guests: 25 })).toBe(false);
    expect(matchesCategoryFilters(fields, { min_guests: 350, max_guests: 350 })).toBe(false);
  });

  it("requires enabled toggle details", () => {
    expect(matchesCategoryFilters({ bar_service: true }, { bar_service: true })).toBe(true);
    expect(matchesCategoryFilters({ bar_service: false }, { bar_service: true })).toBe(false);
  });
});

describe("getPackageSpecChips", () => {
  it("uses the first structured package in the supplied featured-first order", () => {
    expect(
      getPackageSpecChips(
        [
          { service_category: "Venue", category_fields: { max_guests: 300 } },
          { service_category: "Venue", category_fields: { max_guests: 100 } },
        ],
        "Venue",
      ),
    ).toEqual(["Up to 300 guests"]);
  });

  it("skips empty packages and falls back to the vendor category", () => {
    expect(
      getPackageSpecChips(
        [
          { service_category: null, category_fields: {} },
          {
            service_category: null,
            category_fields: { hours_included: 3, booth_style: ["Open air"] },
          },
        ],
        "Photo Booth",
      ),
    ).toEqual(["3 hrs", "Open air"]);
  });

  it("returns no chips when no package has structured fields", () => {
    expect(
      getPackageSpecChips(
        [{ service_category: "Venue", category_fields: null }],
        "Venue",
      ),
    ).toEqual([]);
  });
});

describe("marketplace category result integrity", () => {
  it("never mixes unverified external results into a package-detail search", () => {
    expect(shouldShowExternalFallback("all", 2, 8, true)).toBe(false);
    expect(shouldShowExternalFallback("all", 2, 8, false)).toBe(true);
  });

  it("loads every package page instead of truncating the catalog", async () => {
    const source = Array.from({ length: 1_205 }, (_, id) => ({ id }));
    const calls: Array<[number, number]> = [];
    const result = await loadAllMarketplacePackages(async (from, to) => {
      calls.push([from, to]);
      return source.slice(from, to + 1);
    }, 500);

    expect(result).toHaveLength(1_205);
    expect(calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it("surfaces package page failures", async () => {
    await expect(
      loadAllMarketplacePackages(async () => {
        throw new Error("package query failed");
      }),
    ).rejects.toThrow("package query failed");
  });
});