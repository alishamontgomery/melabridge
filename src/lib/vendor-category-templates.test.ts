import { describe, expect, it } from "vitest";
import { getCategoryTemplate } from "./vendor-category-templates";

describe("vendor package category templates", () => {
  it("returns category-specific inclusions and durations", () => {
    const photographer = getCategoryTemplate("Photographer");
    const venue = getCategoryTemplate("Venue");

    expect(photographer.featureGroups.flatMap((group) => group.items)).toContain("Edited digital photos");
    expect(venue.featureGroups.flatMap((group) => group.items)).toContain("Reception hall");
    expect(photographer.durationOptions).not.toEqual(venue.durationOptions);
  });

  it("falls back safely for a custom service category", () => {
    const template = getCategoryTemplate("Ice Sculpting");

    expect(template.featureGroups.length).toBeGreaterThan(0);
    expect(template.durationOptions).toContain("Custom");
  });
});