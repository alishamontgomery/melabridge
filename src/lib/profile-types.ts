export type PublicProfileType = "host" | "planner" | "vendor";

export type LegacyProfileType = "personal" | "organization" | "vendor";

export type ProfileTypeOption = {
  value: PublicProfileType;
  title: string;
  description: string;
  icon: "host" | "planner" | "vendor";
  recommended?: boolean;
};

export const PROFILE_TYPE_OPTIONS: readonly ProfileTypeOption[] = [
  {
    value: "host",
    title: "I’m organizing my own event",
    description: "For a wedding, birthday, shower, reunion, celebration, or community event you’re planning yourself.",
    icon: "host",
    recommended: true,
  },
  {
    value: "planner",
    title: "I’m a professional event planner",
    description: "For professionals who manage events for paying clients.",
    icon: "planner",
  },
  {
    value: "vendor",
    title: "I provide event services",
    description: "For venues, caterers, DJs, photographers, decorators, photo booths, and other event businesses.",
    icon: "vendor",
  },
];

export function legacyToPublicProfileType(value: string | null | undefined): PublicProfileType {
  if (value === "vendor") return "vendor";
  if (value === "organization" || value === "planner" || value === "pro_planner") return "planner";
  return "host";
}

export function publicToLegacyProfileType(value: PublicProfileType): LegacyProfileType {
  if (value === "vendor") return "vendor";
  if (value === "planner") return "organization";
  return "personal";
}

export function publicToClerkAccountType(value: PublicProfileType): "host" | "pro_planner" | "vendor" {
  if (value === "vendor") return "vendor";
  if (value === "planner") return "pro_planner";
  return "host";
}

export function profileTypeLabel(value: string | null | undefined): "Host" | "Planner" | "Vendor" | "Admin" {
  if (value === "admin") return "Admin";
  const publicType = legacyToPublicProfileType(value);
  return publicType === "planner" ? "Planner" : publicType === "vendor" ? "Vendor" : "Host";
}