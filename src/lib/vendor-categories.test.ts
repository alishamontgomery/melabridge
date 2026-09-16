import { describe, expect, it } from "vitest";
import { getVendorServiceTypes, vendorOffersCategory } from "./vendor-categories";

describe("custom vendor service discovery", () => {
  const unusualVendor = {
    business_category: "Other",
    business_categories: ["Other"],
    custom_service_types: ["Ice Sculpting", "Live Painting"],
  };

  it("keeps one profile's preset and custom services searchable", () => {
    expect(getVendorServiceTypes(unusualVendor)).toEqual([
      "Other",
      "Ice Sculpting",
      "Live Painting",
    ]);
  });

  it("matches a custom service query without requiring a preset category", () => {
    expect(vendorOffersCategory(unusualVendor, "ice sculpting")).toBe(true);
    expect(vendorOffersCategory(unusualVendor, "artist")).toBe(false);
  });

  it("supports a different custom specialty on the same profile shape", () => {
    expect(
      vendorOffersCategory(
        { ...unusualVendor, custom_service_types: ["Artist", "Portrait Design"] },
        "artist",
      ),
    ).toBe(true);
  });
});