import type { MelaAssistPrompt, MelaAssistRole } from "./types";

const EVENT_DETAIL_PATH = /^\/events\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/|$)/i;

export function eventIdFromPathname(pathname: string): string | null {
  return pathname.match(EVENT_DETAIL_PATH)?.[1] ?? null;
}

export type PageContextInfo = {
  /** Short surface label used in banners and greetings ("Vendor profile", "Event page"). */
  surface: string;
  /** Sentence describing what the assistant can help with on this page. */
  greeting: string;
  /** Suggested prompts for this surface + role. */
  suggestions: MelaAssistPrompt[];
  /** Single dismissible tip specific to this surface. */
  tip?: string;
  /** Stable key for sessionStorage dismissal of the tip. */
  tipKey?: string;
};

const VENDOR_PROFILE: MelaAssistPrompt[] = [
  { label: "Improve my profile", prompt: "Review my vendor profile and suggest specific improvements." },
  { label: "Create service packages", prompt: "Draft three service package tiers I can offer." },
  { label: "Generate FAQs", prompt: "Write 6 FAQs planners typically ask a vendor in my category." },
  { label: "Rewrite my description", prompt: "Rewrite my business description to sound more premium and specific." },
];

const VENDOR_DASH: MelaAssistPrompt[] = [
  { label: "Improve my profile", prompt: "Review my vendor profile and suggest specific improvements." },
  { label: "Write a clearer description", prompt: "Rewrite my vendor description to be specific, warm, and easy to scan." },
  { label: "Suggest service highlights", prompt: "Suggest concise service highlights for my vendor profile." },
  { label: "Create profile FAQs", prompt: "Write useful FAQs for my public vendor profile." },
];

const PLANNER_DASH: MelaAssistPrompt[] = [
  { label: "Continue where I left off", prompt: "What should I work on next for my event?" },
  { label: "Build my timeline", prompt: "Draft a runsheet timeline for my upcoming event." },
  { label: "Balance my budget", prompt: "Review my budget and suggest adjustments to keep me on track." },
  { label: "Find missing vendors", prompt: "Which vendor categories am I missing, and which should I book first?" },
];

const PLANNER_EVENT: MelaAssistPrompt[] = [
  { label: "Timeline for this event", prompt: "Draft the day-of timeline for this event." },
  { label: "Budget for this event", prompt: "Draft a starter budget for this event and flag anything risky." },
  { label: "Vendors I still need", prompt: "Which vendors should I book next for this event and why?" },
  { label: "Guest list next steps", prompt: "What guest-list actions should I take this week?" },
];

const PLANNER_EVENTS_INDEX: MelaAssistPrompt[] = [
  { label: "Plan a new event", prompt: "Help me plan a brand new event from scratch." },
  { label: "Turn an idea into an event", prompt: "I have an idea for an event — help me turn it into a real plan." },
  { label: "Compare two event ideas", prompt: "Compare two event ideas and help me pick which to plan first." },
];

const PLANNER_BUDGET: MelaAssistPrompt[] = [
  { label: "Draft my budget", prompt: "Suggest a starter budget breakdown for this event." },
  { label: "Where can I save?", prompt: "Where can I realistically cut costs without hurting quality?" },
  { label: "Add a missing line", prompt: "What common budget line items am I likely missing?" },
];

const PLANNER_TIMELINE: MelaAssistPrompt[] = [
  { label: "Draft my runsheet", prompt: "Draft a full day-of runsheet based on my event details." },
  { label: "Add key milestones", prompt: "Suggest planning milestones between now and the event." },
  { label: "Prep the day-before", prompt: "What should I do the day before the event?" },
];

const PLANNER_GUESTS: MelaAssistPrompt[] = [
  { label: "Draft my invite copy", prompt: "Write invitation copy for my event." },
  { label: "Review pending RSVPs", prompt: "Help me review the guests who haven't RSVP'd yet." },
  { label: "Suggest seating groups", prompt: "Suggest sensible seating groups given my guest list." },
];

const PLANNER_MARKETPLACE: MelaAssistPrompt[] = [
  { label: "Recommend vendors", prompt: "Recommend vendor categories to book for my event and what to ask them." },
  { label: "Compare vendors", prompt: "Give me a checklist to compare two vendors fairly." },
  { label: "Write an outreach message", prompt: "Draft an outreach message to a vendor I want to book." },
];

const ADMIN: MelaAssistPrompt[] = [
  { label: "Platform overview", prompt: "Summarise the current state of the MelaBridge platform." },
  { label: "Review new vendors", prompt: "Which vendor applications need my attention and why?" },
  { label: "Subscription metrics", prompt: "Give me a snapshot of subscription health and churn signals." },
  { label: "Health check", prompt: "Give me a quick admin health check across users, events, and vendors." },
];

const ADMIN_USERS: MelaAssistPrompt[] = [
  { label: "Who to review", prompt: "Which recent users should I review or verify first?" },
  { label: "Draft an admin note", prompt: "Draft a professional admin message to a suspended user." },
  { label: "Spot risky accounts", prompt: "What signals suggest an account might need extra review?" },
];

const GUEST: MelaAssistPrompt[] = [
  { label: "What is MelaBridge?", prompt: "What is MelaBridge and who is it for?" },
  { label: "How pricing works", prompt: "Explain MelaBridge pricing in plain language." },
];

function matches(pathname: string, patterns: (string | RegExp)[]): boolean {
  return patterns.some((p) => {
    if (typeof p !== "string") return p.test(pathname);
    if (p === "/") return pathname === "/";
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}

export function getPageContext(pathname: string, role: MelaAssistRole): PageContextInfo {
  // Vendor surfaces first (role-scoped)
  if (role === "vendor") {
    if (matches(pathname, ["/vendor-profile-builder", "/vendor-settings", "/vendor-profile"])) {
      return {
        surface: "Vendor profile",
        greeting: "I can help improve your profile, create packages, write FAQs, or optimize your business listing.",
        suggestions: VENDOR_PROFILE,
      tip: "A consistent gallery and complete service list make your public profile easier to understand.",
        tipKey: "vendor-profile-photos",
      };
    }
    return {
      surface: "Vendor dashboard",
      greeting: "I can help you improve your public profile, services, packages, and FAQs.",
      suggestions: VENDOR_DASH,
      tip: "Complete your profile details and keep your packages current so your listing stays useful.",
      tipKey: "vendor-profile-current",
    };
  }

  if (role === "admin") {
    if (matches(pathname, ["/admin/users"])) {
      return {
        surface: "Admin • Users",
        greeting: "I can help you review new users, spot risky accounts, and draft admin messages.",
        suggestions: ADMIN_USERS,
        tip: "Use the Suspend action instead of Delete when you may need to reinstate an account later.",
        tipKey: "admin-suspend-vs-delete",
      };
    }
    return {
      surface: "AdminOS",
      greeting: "I can help review platform activity, vendors, users, and subscription health.",
      suggestions: ADMIN,
      tip: "Keep an eye on vendor applications weekly — approvals compound faster than you'd think.",
      tipKey: "admin-vendor-cadence",
    };
  }

  // Planner / organization / personal surfaces
  if (matches(pathname, [/^\/events\/[^/]+/])) {
    return {
      surface: "Event page",
      greeting: "I can build your timeline, budget, checklist, or recommend vendors for this event.",
      suggestions: PLANNER_EVENT,
      tip: "Locking your top 3 vendor categories early usually saves 10–15% on total spend.",
      tipKey: "planner-vendor-lock-early",
    };
  }
  if (matches(pathname, ["/events"])) {
    return {
      surface: "Events",
      greeting: "I can help you plan a new event or refine an existing one — try describing it in one sentence.",
      suggestions: PLANNER_EVENTS_INDEX,
      tip: "Try the AI Event Builder — describe your event in one line and I'll draft the plan.",
      tipKey: "planner-ai-builder",
    };
  }
  if (matches(pathname, ["/budget"])) {
    return {
      surface: "Budget",
      greeting: "I can draft your budget, flag missing lines, or find realistic places to save.",
      suggestions: PLANNER_BUDGET,
      tip: "Add a 10% contingency line early — it prevents last-minute stress.",
      tipKey: "planner-budget-contingency",
    };
  }
  if (matches(pathname, ["/timeline"])) {
    return {
      surface: "Timeline",
      greeting: "I can draft your runsheet and fill in the milestones between now and the event.",
      suggestions: PLANNER_TIMELINE,
      tip: "A shared runsheet with your vendors reduces day-of confusion by a huge margin.",
      tipKey: "planner-timeline-share",
    };
  }
  if (matches(pathname, ["/guests", "/guest-portal"])) {
    return {
      surface: "Guests",
      greeting: "I can help review RSVPs, organize guest details, and suggest seating groups.",
      suggestions: PLANNER_GUESTS,
      tip: "Reviewing pending RSVPs early keeps your guest list accurate.",
      tipKey: "planner-rsvp-nudge",
    };
  }
  if (matches(pathname, ["/marketplace"])) {
    return {
      surface: "Marketplace",
      greeting: "I can recommend vendors, compare shortlists, and draft outreach messages.",
      suggestions: PLANNER_MARKETPLACE,
      tip: "Always ask a vendor for two references before committing to a deposit.",
      tipKey: "planner-vendor-references",
    };
  }
  if (matches(pathname, ["/dashboard", "/"]) && (role === "personal" || role === "organization")) {
    return {
      surface: "Dashboard",
      greeting: "I can help you continue where you left off — timeline, budget, vendors, or guests.",
      suggestions: PLANNER_DASH,
      tip: "Ten minutes of planning today saves an hour of scrambling next week.",
      tipKey: "planner-dashboard-cadence",
    };
  }

  if (role === "personal" || role === "organization") {
    return {
      surface: "MelaBridge",
      greeting: "What would you like help with? I can help you plan, budget, find vendors, or organize event details.",
      suggestions: PLANNER_DASH,
    };
  }

  return {
    surface: "MelaBridge",
    greeting: "What would you like help with? Ask me anything about MelaBridge.",
    suggestions: GUEST,
  };
}
