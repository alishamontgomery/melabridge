import type { AppRole } from "@/lib/use-role";

export const ROLE_EXCLUSIVE: ReadonlyArray<{
  prefix: string;
  allow: ReadonlyArray<AppRole>;
}> = [
  { prefix: "/admin", allow: ["admin"] },
  { prefix: "/vendor-packages", allow: ["vendor"] },
  { prefix: "/vendor-settings", allow: ["vendor"] },
  { prefix: "/vendor-profile-builder", allow: ["vendor"] },
  { prefix: "/vendor", allow: ["vendor"] },
  { prefix: "/dashboard", allow: ["personal", "organization"] },
  { prefix: "/bookings", allow: ["personal", "organization", "admin"] },
  { prefix: "/guests", allow: ["personal", "organization", "admin"] },
  { prefix: "/budget", allow: ["personal", "organization", "admin"] },
  { prefix: "/timeline", allow: ["personal", "organization", "admin"] },
  { prefix: "/team", allow: ["personal", "organization", "admin"] },
  { prefix: "/marketplace", allow: ["personal", "organization", "admin"] },
  { prefix: "/events", allow: ["personal", "organization", "admin"] },
  { prefix: "/tasks", allow: ["personal", "organization", "admin"] },
  { prefix: "/calendar/requests", allow: ["vendor", "admin"] },
  { prefix: "/calendar/dashboard", allow: ["vendor", "admin"] },
  { prefix: "/calendar/settings", allow: ["vendor", "admin"] },
  { prefix: "/analytics", allow: ["admin"] },
  { prefix: "/reports", allow: ["personal", "organization", "admin"] },
  { prefix: "/ecosystem", allow: ["personal", "organization", "admin"] },
  { prefix: "/ai-memory", allow: ["admin"] },
  { prefix: "/workspace", allow: ["admin"] },
  { prefix: "/collaboration", allow: ["admin"] },
  { prefix: "/guest-portal", allow: ["admin"] },
  { prefix: "/share", allow: ["admin"] },
  { prefix: "/digital-twin", allow: ["personal", "organization", "admin"] },
  { prefix: "/decisions", allow: ["personal", "organization", "admin"] },
  { prefix: "/concierge", allow: ["personal", "organization", "admin"] },
  { prefix: "/fundraising", allow: ["personal", "organization", "admin"] },
  { prefix: "/travel", allow: ["personal", "organization", "admin"] },
];

export function canRoleAccessPath(role: AppRole, path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0];
  const match = ROLE_EXCLUSIVE.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`),
  );
  return !match || match.allow.includes(role);
}

export function roleHome(role: AppRole): "/dashboard" | "/vendor" | "/admin" {
  if (role === "admin") return "/admin";
  if (role === "vendor") return "/vendor";
  return "/dashboard";
}