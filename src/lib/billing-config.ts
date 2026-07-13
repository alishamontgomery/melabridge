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
    /* ————— HOST / PERSONAL PLANNER ————— */
    host_free: {
      id: "host_free",
      audience: "host",
      name: "Free",
      tagline: "Plan every celebration, free forever.",
      price: 0,
      currency: "USD",
      interval: "month",
      trialDays: 0,
      visible: true,
      featured: true,
      ctaLabel: "Get started free",
      ctaHref: "/auth",
      features: [
        "Unlimited personal events",
        "Unlimited guests & RSVPs",
        "Budget, checklist & timeline",
        "MelaAssist AI planning",
        "Marketplace access",
        "Shared planning with family",
      ],
    },

    /* ————— VENDORS ————— */
    vendor_starter: {
      id: "vendor_starter",
      audience: "vendor",
      name: "Starter",
      tagline: "Get discovered in the marketplace.",
      price: 0,
      currency: "USD",
      interval: "month",
      trialDays: 0,
      visible: true,
      ctaLabel: "Create free listing",
      ctaHref: "/auth",
      features: [
        "Basic business profile",
        "Receive inquiries from hosts",
        "Limited portfolio photos",
        "Limited AI assistance",
      ],
    },
    vendor_professional: {
      id: "vendor_professional",
      audience: "vendor",
      name: "Professional",
      tagline: "Everything you need to book more events.",
      price: 29,
      currency: "USD",
      interval: "month",
      trialDays: 14,
      visible: true,
      featured: true,
      ctaLabel: "Start 14-day free trial",
      ctaHref: "/auth",
      priceId: "vendor_professional_monthly",
      features: [
        "Full business profile",
        "Unlimited portfolio",
        "MelaAssist AI messaging",
        "Quotes & contracts",
        "Calendar sync",
        "Analytics",
        "Verified badge",
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
      trialDays: 14,
      visible: true,
      includesFromPlanId: "vendor_professional",
      ctaLabel: "Start 14-day free trial",
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
      visible: true,
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
      name: "Professional Planner",
      tagline: "For wedding, event & corporate planners.",
      price: 39,
      currency: "USD",
      interval: "month",
      trialDays: 14,
      visible: true,
      featured: true,
      ctaLabel: "Start 14-day free trial",
      ctaHref: "/auth",
      priceId: "planner_professional_monthly",
      features: [
        "Unlimited clients & events",
        "Team collaboration (unlimited members)",
        "White-label client portal",
        "Advanced automations",
        "Premium AI planning (MelaAssist Plus)",
        "Vendor & budget management",
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
    blurb: "Plan any celebration, free forever.",
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

