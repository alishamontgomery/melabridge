import { describe, expect, it } from "vitest";
import { canRoleAccessPath } from "./role-access";

describe("canRoleAccessPath", () => {
  it("enforces role rules when a route includes a query string", () => {
    expect(canRoleAccessPath("personal", "/admin?tab=users")).toBe(false);
    expect(canRoleAccessPath("organization", "/vendor?step=profile")).toBe(false);
    expect(canRoleAccessPath("vendor", "/bookings?view=active")).toBe(false);
  });

  it("enforces role rules when a route includes a hash fragment", () => {
    expect(canRoleAccessPath("personal", "/admin#users")).toBe(false);
    expect(canRoleAccessPath("vendor", "/events#upcoming")).toBe(false);
  });

  it("preserves access for allowed roles with search parameters", () => {
    expect(canRoleAccessPath("admin", "/admin?tab=users")).toBe(true);
    expect(canRoleAccessPath("vendor", "/vendor?step=profile")).toBe(true);
    expect(canRoleAccessPath("personal", "/bookings?view=active")).toBe(true);
  });
});