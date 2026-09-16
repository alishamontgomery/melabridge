/**
 * MelaBridge — Centralized Billing Configuration
 *
 * Single source of truth for every plan, price, feature, and promise
 * shown across the marketing site, checkout, upgrade screens, billing
 * portal, and subscription management surfaces.
 *
 * Change a price or feature here and it propagates everywhere.
 *
 * In the future this file can be hydrated from a `billing_config` table
 * so admins can edit pricing from AdminOS™ without a deploy.
 */

export type BillingAudience = "host" | "vendor" | "planner";

export type PlanId =
  // Hosts
  | "host_free"
  // Vendors
  | "vendor_starter"
  | "vendor_professional"
  | "vendor_premium"
  | "vendor_enterprise"
  // Planners
  | "planner_professional"
  | "planner_professional_annual";

export type PlannerBillingCadence = "monthly" | "annual";

export type BillingInterval = "month" | "year";

export interface Plan {
  id: PlanId;
  audience: BillingAudience;
  name: string;
  tagline: string;
  price: number | null; // null = "Contact sales"
  currency: "USD";
  interval: BillingInterval;
  trialDays: number;
  visible: boolean;
  featured?: boolean;
  ctaLabel: string;
  ctaHref: string;
  features: string[];
  includesFromPlanId?: PlanId; // "Everything in X, plus..."
  /** Stripe price lookup_key. Present only for paid, self-serve plans. */
  priceId?: string;
}

export interface BillingPromise {
  title: string;
  body: string;
}

export interface BillingConfig {
  philosophy: {
    headline: string;
    body: string;
  };
  promises: BillingPromise[];
  /** Marketplace commission on vendor bookings. Off at launch. */
  marketplaceCommissionEnabled: boolean;
  marketplaceCommissionRate: number; // decimal, e.g. 0.05 = 5%
  /** Ticketing platform fee for paid subscribers. Zero at launch. */
  ticketingPlatformFeeRate: number;
  /** Donation / fundraising platform fee. Always zero. */
  donationPlatformFeeRate: number;
  processorNote: string;
  trialDaysDefault: number;
  currency: "USD";
  plans: Record<PlanId, Plan>;
}

const plannerProFeatures = [
  "Unlimited clients & events",
  "Team collaboration — unlimited members",
  "Client-specific guest & RSVP management",
  "MelaAssist AI for every client event",
  "Sell tickets — $0 MelaBridge platform fee",
  "QR code check-in & attendee management",
  "Vendor coordination per event",
  "Budget tracking & reporting per client",
  "Data exports & client reports",
  "Priority support",
];

export const billingConfig: BillingConfig = {
  philosophy: {
    headline: "Clear plans for every event team.",
    body:
      "MelaBridge offers a free starting point for hosts and vendors, with paid tools for professional planners. Eligible plans can sell tickets with no added MelaBridge platform fee.",
  },
  promises: [
    { title: "No fees on RSVPs", body: "Invite and manage every guest without paying per response." },
    { title: "No fees on event pages", body: "Create event pages and organize guest details without a per-guest charge." },
    { title: "No fees on guest management", body: "Seating, dietary, plus-ones — all included." },
    { title: "Fundraising is on the roadmap", body: "Campaign and donation processing are not yet available." },
    { title: "No marketplace commissions", body: "MelaBridge does not take a cut when planners and vendors connect." },
  ],
  marketplaceCommissionEnabled: false,
  marketplaceCommissionRate: 0,
  ticketingPlatformFeeRate: 0,
  donationPlatformFeeRate: 0,
  processorNote:
    "Standard payment processor fees (such as Stripe) may apply when money moves. MelaBridge adds no platform fee on top.",
  trialDaysDefault: 5,
  currency: "USD",
  plans: {
    /* ————— HOST ————— */
    host_free: {
      id: "host_free",
      audience: "host",
      name: "My Event",
      tagline: "Plan events for yourself, your family, or your community, free forever.",
      price: 0,
      currency: "USD",
      interval: "month",
      trialDays: 0,
      visible: true,
      ctaLabel: "Get started free",
      ctaHref: "/auth",
      features: [
        "Unlimited events",
        "Unlimited guests & RSVPs",
        "Budget tracking & line items",
        "Checklist & event timeline",
        "MelaAssist AI planning assistant",
        "Vendor discovery & marketplace",
        "Event pages & ticket sales",
        "Shared planning with family & team",
      ],
    },

    /* ————— VENDORS ————— */
    vendor_starter: {
      id: "vendor_starter",
      audience: "vendor",
      name: "Vendor Profile",
      tagline: "Get your business discovered in the marketplace.",
      price: 0,
      currency: "USD",
      interval: "month",
      trialDays: 0,
      visible: true,
      ctaLabel: "Create free listing",
      ctaHref: "/auth",
      features: [
        "Business profile in marketplace",
        "Up to 3 service categories",
        "5 portfolio photos",
        "Receive leads from planners & hosts",
        "Lead management dashboard",
      ],
    },
    vendor_professional: {
      id: "vendor_professional",
      audience: "vendor",
      name: "Business",
      tagline: "Everything your business needs to win more clients and grow.",
      price: 29,
      currency: "USD",
      interval: "month",
      trialDays: 0,
      // Hidden from the launch catalog. Existing subscribers remain honored.
      visible: false,
      featured: true,
      ctaLabel: "Unavailable at launch",
      ctaHref: "/auth",
      priceId: "vendor_professional_monthly",
      features: [
        "Full business profile + verified badge",
        "Unlimited service categories & packages",
        "Unlimited portfolio photos",
        "Shareable profile & inquiry link",
        "Full lead pipeline & CRM tools",
        "Business analytics & performance reporting",
        "Document management & file sharing",
        "Calendar sync (coming soon)",
      ],
    },
    vendor_premium: {
      id: "vendor_premium",
      audience: "vendor",
      name: "Premium",
      tagline: "Stand out and scale your business.",
      price: 59,
      currency: "USD",
      interval: "month",
      trialDays: 0,
      // Hidden from public pricing — existing subscribers still honoured
      visible: false,
      includesFromPlanId: "vendor_professional",
      ctaLabel: "Unavailable at launch",
      ctaHref: "/auth",
      priceId: "vendor_premium_monthly",
      features: [
        "Featured placement in search",
        "Priority leads",
        "Advanced analytics",
        "Team members",
        "Premium AI automation",
        "Marketing tools",
      ],
    },
    vendor_enterprise: {
      id: "vendor_enterprise",
      audience: "vendor",
      name: "Enterprise",
      tagline: "For venues, brands & vendor networks.",
      price: null,
      currency: "USD",
      interval: "month",
      trialDays: 0,
      // Hidden from public pricing — contact for legacy/custom arrangements
      visible: false,
      includesFromPlanId: "vendor_premium",
      ctaLabel: "Contact sales",
      ctaHref: "/contact",
      features: [
        "Custom onboarding",
        "Multiple locations & seats",
        "API integrations",
        "Dedicated account manager",
        "Custom SLAs",
      ],
    },

    /* ————— PROFESSIONAL PLANNERS ————— */
    planner_professional: {
      id: "planner_professional",
      audience: "planner",
      name: "Planner Pro",
      tagline: "Manage every client and every event from one workspace.",
      price: 29,
      currency: "USD",
      interval: "month",
      trialDays: 5,
      visible: true,
      featured: true,
      ctaLabel: "Start 5-day free trial",
      ctaHref: "/auth",
      priceId: "planner_professional_monthly",
      features: plannerProFeatures,
    },
    planner_professional_annual: {
      id: "planner_professional_annual",
      audience: "planner",
      name: "Planner Pro",
      tagline: "Save $58 with annual billing while managing every client and event.",
      price: 290,
      currency: "USD",
      interval: "year",
      trialDays: 5,
      visible: true,
      featured: true,
      ctaLabel: "Start 5-day free trial",
      ctaHref: "/auth",
      priceId: "planner_professional_annual",
      features: plannerProFeatures,
    },
  },
};

/* ————————————————— helpers ————————————————— */

export function getPlansFor(audience: BillingAudience): Plan[] {
  // Hosts start free but may upgrade to Pro Planner when they need
  // ticketing or other professional event tools. Keep one Stripe product and
  // feature entitlement for that paid tier instead of creating a duplicate.
  if (audience === "host") {
    return [
      billingConfig.plans.host_free,
      billingConfig.plans.planner_professional,
    ]
      .filter((p) => p.visible);
  }
  return Object.values(billingConfig.plans).filter(
    (p) => p.audience === audience && p.visible,
  );
}

export function getPublicCatalogPlans(): Plan[] {
  return [
    billingConfig.plans.host_free,
    billingConfig.plans.vendor_starter,
    billingConfig.plans.planner_professional,
  ].filter((p) => p.visible);
}

export function getPlannerPlan(cadence: PlannerBillingCadence): Plan {
  return cadence === "annual"
    ? billingConfig.plans.planner_professional_annual
    : billingConfig.plans.planner_professional;
}

export function getPlan(id: PlanId): Plan {
  return billingConfig.plans[id];
}

export function findPlanByPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  return Object.values(billingConfig.plans).find((p) => p.priceId === priceId) ?? null;
}

export function formatPrice(plan: Plan): { amount: string; period: string } {
  if (plan.price === null) return { amount: "Custom", period: "" };
  if (plan.price === 0) return { amount: "$0", period: `/${plan.interval}` };
  const rounded = Number.isInteger(plan.price) ? plan.price.toString() : plan.price.toFixed(2);
  return { amount: `$${rounded}`, period: `/${plan.interval}` };
}

export const audienceMeta: Record<BillingAudience, { label: string; blurb: string }> = {
  host: {
    label: "Hosts & Families",
    blurb: "Start free, then upgrade when you need ticketing and professional tools.",
  },
  vendor: {
    label: "Vendors & Businesses",
    blurb: "Get discovered, connect with planners and hosts, and grow your business.",
  },
  planner: {
    label: "Professional Planners",
    blurb: "Run every client and every event from one cockpit.",
  },
};

/* ————————————————— feature gates ————————————————— */

export type FeatureKey =
  | "ticketing"
  | "advanced_ai"
  | "advanced_analytics"
  | "document_storage_expanded"
  | "advanced_rsvp"
  | "advanced_timeline"
  | "communication_tools"
  | "exports"
  | "multi_event";

export interface FeatureGateConfig {
  label: string;
  description: string;
  benefits: string[];
  /** Ordered list of plan IDs that unlock this feature (first = minimum). */
  requiredPlans: PlanId[];
}

/**
 * Central map of every premium feature and the plans that unlock it.
 * Change a required plan here and it propagates everywhere on the platform.
 */
export const featureGates: Record<FeatureKey, FeatureGateConfig> = {
  ticketing: {
    label: "Sell Tickets",
    description: "Create ticket types, process payments, and manage attendees for your events.",
    benefits: [
      "Multiple ticket types & pricing tiers",
      "Stripe-powered secure checkout",
      "QR code check-in for event staff",
      "Attendee management & CSV exports",
    ],
    requiredPlans: ["planner_professional", "vendor_professional", "vendor_premium", "vendor_enterprise"],
  },
  advanced_ai: {
    label: "MelaAssist AI",
    description: "AI-powered planning tools that draft timelines, suggest vendors, and help you build a complete event plan.",
    benefits: [
      "Natural-language event planning",
      "AI-drafted timelines & task breakdowns",
      "Vendor shortlist suggestions",
      "AI-generated event-planning drafts",
    ],
    requiredPlans: ["planner_professional", "vendor_professional", "vendor_premium", "vendor_enterprise"],
  },
  advanced_analytics: {
    label: "Advanced Analytics",
    description: "Deep insights into event performance, guest engagement, and budget efficiency.",
    benefits: [
      "Real-time RSVP & engagement analytics",
      "Budget variance reports",
      "Export to PDF & spreadsheet",
    ],
    requiredPlans: ["planner_professional", "vendor_premium", "vendor_enterprise"],
  },
  document_storage_expanded: {
    label: "Expanded Document Storage",
    description: "Store unlimited photos and event documents in one secure place.",
    benefits: [
      "Unlimited file storage",
      "File versioning & history",
      "Shared folder access for collaborators",
      "Vendor document requests",
    ],
    requiredPlans: ["planner_professional", "vendor_professional", "vendor_premium", "vendor_enterprise"],
  },
  advanced_rsvp: {
    label: "Advanced RSVP & Guest Forms",
    description: "Custom RSVP forms, meal choices, plus-ones, and guest-list organization.",
    benefits: [
      "Custom RSVP questions",
      "Meal preference & dietary collection",
      "Plus-one management",
      "Guest-list exports",
    ],
    requiredPlans: ["planner_professional"],
  },
  advanced_timeline: {
    label: "Advanced Timeline & Runsheet",
    description: "AI-generated day-of runsheets, vendor assignments, and real-time sharing.",
    benefits: [
      "AI runsheet generation",
      "Vendor task assignments",
      "Live day-of sharing with staff",
      "Timeline collaboration",
    ],
    requiredPlans: ["planner_professional"],
  },
  communication_tools: {
    label: "Guest List Tools",
    description: "Organize guest details, RSVP status, and dietary preferences in one place.",
    benefits: [
      "Guest-list organization",
      "RSVP and dietary tracking",
      "Recipient segmentation (confirmed, pending, declined)",
      "CSV guest-list exports",
    ],
    requiredPlans: ["planner_professional"],
  },
  exports: {
    label: "Data Exports",
    description: "Export your guest list, budget, and event data to CSV, PDF, or spreadsheets.",
    benefits: [
      "Guest list & RSVP CSV export",
      "Budget & spend PDF reports",
      "Attendee data exports",
    ],
    requiredPlans: ["planner_professional", "vendor_professional", "vendor_premium", "vendor_enterprise"],
  },
  multi_event: {
    label: "Unlimited Events",
    description: "Manage multiple events simultaneously with a shared guest database and budget overview.",
    benefits: [
      "Unlimited active events",
      "Cross-event guest database",
      "Portfolio dashboard view",
    ],
    requiredPlans: ["planner_professional"],
  },
};

/**
 * Returns true if the given plan unlocks the requested feature.
 * Pass null / undefined for a user on the free (no subscription) tier.
 */
export function planIncludes(planId: PlanId | null | undefined, feature: FeatureKey): boolean {
  if (!planId) return false;
  const normalizedPlanId = planId === "planner_professional_annual"
    ? "planner_professional"
    : planId;
  return featureGates[feature]?.requiredPlans.includes(normalizedPlanId) ?? false;
}
