export type ProvisionedRole = "personal" | "organization" | "vendor" | "admin";

export type PostAuthDestination =
  | { kind: "admin"; route: "/admin" }
  | { kind: "vendor"; route: "/vendor" }
  | { kind: "onboarding"; type: "host" | "planner" }
  | { kind: "workspace"; route: "/dashboard"; role: "personal" | "organization" };

/**
 * Decides the first application destination from the server-verified
 * provisioning result. The browser never chooses an admin destination.
 */
export function postAuthDestination(
  role: ProvisionedRole,
  onboardingCompleted: boolean,
): PostAuthDestination {
  if (role === "admin") return { kind: "admin", route: "/admin" };
  if (role === "vendor") return { kind: "vendor", route: "/vendor" };
  if (!onboardingCompleted) {
    return { kind: "onboarding", type: role === "organization" ? "planner" : "host" };
  }
  return { kind: "workspace", route: "/dashboard", role };
}