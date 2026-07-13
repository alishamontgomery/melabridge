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
  | "planner_professional";


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

export const billingConfig: BillingConfig = {
  philosophy: {
    headline: "Transparent pricing. No surprise fees.",
    body:
      "We believe event organizers should keep the money they raise and the memories they create. That's why MelaBridge doesn't charge per RSVP or take a percentage of donations. Our pricing is simple, predictable, and built around helping people plan with confidence.",
  },
  promises: [
    { title: "No fees on RSVPs", body: "Invite and manage every guest without paying per response." },
    { title: "No fees on invitations", body: "Send unlimited beautiful invitations at no extra cost." },
    { title: "No fees on guest management", body: "Seating, dietary, plus-ones — all included." },
    { title: "0% on donations", body: "Every dollar raised for your cause goes to your cause." },
    { title: "0% on fundraising", body: "Community fundraising with no MelaBridge cut." },
    { title: "No booking commissions", body: "Vendors keep 100% of what they earn at launch." },
  ],
  marketplaceCommissionEnabled: false,
  marketplaceCommissionRate: 0,
  ticketingPlatformFeeRate: 0,
  donationPlatformFeeRate: 0,
  processorNote:
    "Standard payment processor fees (such as Stripe) may apply when money moves. MelaBridge adds no platform fee on top.",
  trialDaysDefault: 14,
  currency: "USD",
  plans: {
    /* ————— HOSTS ————— */
    host_free: {
      id: "host_free",
      audience: "host",
      name: "Free",
      tagline: "For your first celebration.",
      price: 0,
      currency: "USD",
      interval: "month",
      trialDays: 0,
      visible: true,
      ctaLabel: "Start free",
      ctaHref: "/auth",
      features: [
        "1 active event",
        "AI Starter Planning",
        "Budget tracker",
        "Checklist",
        "Guest list",
        "Basic vendor search",
      ],
    },
    host_plus: {
      id: "host_plus",
      audience: "host",
      name: "Plus",
      tagline: "For life's memorable moments.",
      price: 9.99,
      currency: "USD",
      interval: "month",
      trialDays: 14,
      visible: true,
      featured: true,
      ctaLabel: "Start 14-day free trial",
      ctaHref: "/auth",
      priceId: "host_plus_monthly",
      features: [
        "Unlimited events",
        "Unlimited AI planning",
        "Guest portal",
        "Messaging",
        "Budget tracking",
        "Travel planning",
        "Shared planning",
        "Calendar integration",
        "Vendor messaging",
      ],
    },
    host_pro: {
      id: "host_pro",
      audience: "host",
      name: "Pro",
      tagline: "For serious hosts and growing families.",
      price: 19.99,
      currency: "USD",
      interval: "month",
      trialDays: 14,
      visible: true,
      includesFromPlanId: "host_plus",
      ctaLabel: "Start 14-day free trial",
      ctaHref: "/auth",
      priceId: "host_pro_monthly",
      features: [
        "Team collaboration",
        "Ticketing (no platform fee)",
        "Fundraising (0% on donations)",
        "Advanced AI",
        "Premium templates",
        "Automation",
        "Priority support",
        "Digital keepsakes",
        "Advanced reports",
      ],
    },

    /* ————— VENDORS ————— */
    vendor_free: {
      id: "vendor_free",
      audience: "vendor",
      name: "Free Listing",
      tagline: "Get discovered in the marketplace.",
      price: 0,
      currency: "USD",
      interval: "month",
      trialDays: 0,
      visible: true,
      ctaLabel: "Create free listing",
      ctaHref: "/auth",
      features: [
        "Public business listing",
        "Basic profile & contact info",
        "Appear in marketplace search",
        "1 portfolio image",
      ],
    },
    vendor_growth: {
      id: "vendor_growth",
      audience: "vendor",
      name: "Growth",
      tagline: "Start booking more events.",
      price: 29,
      currency: "USD",
      interval: "month",
      trialDays: 14,
      visible: true,
      ctaLabel: "Start 14-day free trial",
      ctaHref: "/auth",
      priceId: "vendor_growth_monthly",
      features: [
        "Enhanced business profile",
        "Portfolio gallery (up to 20)",
        "Reviews & ratings",
        "Direct messaging with hosts",
        "Calendar management",
        "Basic analytics",
      ],
    },
    vendor_professional: {
      id: "vendor_professional",
      audience: "vendor",
      name: "Professional",
      tagline: "For established vendors ready to scale.",
      price: 59,
      currency: "USD",
      interval: "month",
      trialDays: 14,
      visible: true,
      featured: true,
      includesFromPlanId: "vendor_growth",
      ctaLabel: "Start 14-day free trial",
      ctaHref: "/auth",
      priceId: "vendor_professional_monthly",
      features: [
        "Higher marketplace visibility",
        "AI recommendations to matching hosts",
        "Verified vendor badge",
        "Unlimited portfolio",
        "Advanced analytics & insights",
        "Marketing opportunities",
        "Priority support",
      ],
    },
    vendor_enterprise: {
      id: "vendor_enterprise",
      audience: "vendor",
      name: "Enterprise",
      tagline: "For multi-location brands and vendor networks.",
      price: null,
      currency: "USD",
      interval: "month",
      trialDays: 0,
      visible: true,
      includesFromPlanId: "vendor_professional",
      ctaLabel: "Contact sales",
      ctaHref: "/contact",
      features: [
        "Custom onboarding",
        "Multiple users & seats",
        "Multiple locations",
        "API integrations",
        "Dedicated account manager",
        "Custom SLAs",
      ],
    },

    /* ————— PLANNERS ————— */
    planner_business: {
      id: "planner_business",
      audience: "planner",
      name: "Business",
      tagline: "The professional planner's cockpit.",
      price: 49,
      currency: "USD",
      interval: "month",
      trialDays: 14,
      visible: true,
      featured: true,
      ctaLabel: "Start 14-day free trial",
      ctaHref: "/auth",
      priceId: "planner_business_monthly",
      features: [
        "Unlimited clients",
        "Unlimited events",
        "AI planning across every event",
        "Client dashboards",
        "Team collaboration",
        "Vendor management",
        "Budget management",
        "Reporting",
        "Priority support",
      ],
    },
  },
};

/* ————————————————— helpers ————————————————— */

export function getPlansFor(audience: BillingAudience): Plan[] {
  return Object.values(billingConfig.plans).filter(
    (p) => p.audience === audience && p.visible,
  );
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
    blurb: "Plan any celebration with an AI-powered workspace.",
  },
  vendor: {
    label: "Vendors & Businesses",
    blurb: "Get discovered, book more events, grow your business.",
  },
  planner: {
    label: "Professional Planners",
    blurb: "Run every client and every event from one cockpit.",
  },
};
