import { describe, expect, it } from "vitest";
import { metaToDbAccountType, metaToDbRole } from "./auth-helpers";

describe("account role mapping", () => {
  it("routes personal hosts to the personal workspace", () => {
    expect(metaToDbAccountType("host")).toBe("personal");
    expect(metaToDbRole("host")).toBe("personal");
  });

  it("routes professional planners and vendors to their intended workspaces", () => {
    expect(metaToDbAccountType("pro_planner")).toBe("organization");
    expect(metaToDbRole("pro_planner")).toBe("organization");
    expect(metaToDbAccountType("vendor")).toBe("vendor");
    expect(metaToDbRole("vendor")).toBe("vendor");
  });
});