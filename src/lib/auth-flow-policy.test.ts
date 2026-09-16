import { describe, expect, it } from "vitest";
import { postAuthDestination } from "./auth-flow-policy";

describe("post-auth destination", () => {
  it("sends a server-verified admin to AdminOS regardless of onboarding state", () => {
    expect(postAuthDestination("admin", false)).toEqual({
      kind: "admin",
      route: "/admin",
    });
  });

  it("keeps vendor accounts in the vendor portal", () => {
    expect(postAuthDestination("vendor", true)).toEqual({
      kind: "vendor",
      route: "/vendor",
    });
  });

  it("uses the correct onboarding audience for incomplete accounts", () => {
    expect(postAuthDestination("organization", false)).toEqual({
      kind: "onboarding",
      type: "planner",
    });
    expect(postAuthDestination("personal", false)).toEqual({
      kind: "onboarding",
      type: "host",
    });
  });

  it("sends completed personal and organization accounts to the workspace", () => {
    expect(postAuthDestination("personal", true)).toEqual({
      kind: "workspace",
      route: "/dashboard",
      role: "personal",
    });
    expect(postAuthDestination("organization", true)).toEqual({
      kind: "workspace",
      route: "/dashboard",
      role: "organization",
    });
  });
});