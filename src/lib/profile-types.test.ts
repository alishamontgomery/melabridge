import { describe, expect, it } from "vitest";
import {
  PROFILE_TYPE_OPTIONS,
  legacyToPublicProfileType,
  publicToClerkAccountType,
  publicToLegacyProfileType,
} from "./profile-types";

describe("public profile types", () => {
  it("keeps exactly the three action-led signup choices", () => {
    expect(PROFILE_TYPE_OPTIONS.map((option) => option.title)).toEqual([
      "I’m organizing my own event",
      "I’m a professional event planner",
      "I provide event services",
    ]);
    expect(PROFILE_TYPE_OPTIONS).toHaveLength(3);
  });

  it("maps legacy stored roles without exposing Personal as a public type", () => {
    expect(legacyToPublicProfileType("personal")).toBe("host");
    expect(legacyToPublicProfileType("organization")).toBe("planner");
    expect(publicToLegacyProfileType("host")).toBe("personal");
    expect(publicToLegacyProfileType("planner")).toBe("organization");
    expect(publicToClerkAccountType("host")).toBe("host");
    expect(publicToClerkAccountType("planner")).toBe("pro_planner");
    expect(publicToClerkAccountType("vendor")).toBe("vendor");
  });
});