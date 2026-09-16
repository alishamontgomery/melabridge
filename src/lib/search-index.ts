import {
  Calendar,
  Users,
  Wallet,
  ClipboardList,
  HeartHandshake,
  FolderOpen,
  FileBarChart,
  Settings,
  GitBranch,
  Sparkles,
  Store,
  Image as ImageIcon,
  FileText,
  Lightbulb,
  Handshake,
  Boxes,
  Crown,
} from "lucide-react";

export type SearchKind =
  | "module"
  | "event"
  | "guest"
  | "vendor"
  | "file"
  | "contract"
  | "photo"
  | "task"
  | "message"
  | "budget"
  | "conversation"
  | "decision"
  | "note";

export type SearchItem = {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle?: string;
  to: string;
  keywords?: string;
  icon: React.ComponentType<{ className?: string }>;
};

// Planner / default search index
export const SEARCH_INDEX: SearchItem[] = [
  // Modules
  { id: "m-dash", kind: "module", title: "AI Command Center", subtitle: "Dashboard", to: "/dashboard", icon: Sparkles, keywords: "home dashboard overview intelligence" },
  { id: "m-workspace", kind: "module", title: "Event Workspace", subtitle: "All planning tools in one place", to: "/workspace", icon: GitBranch },
  { id: "m-guests", kind: "module", title: "Guests", subtitle: "Guest list, RSVPs, seating", to: "/guests", icon: Users },
  { id: "m-vendors", kind: "module", title: "Vendors", subtitle: "Sourcing and contacts", to: "/marketplace", icon: Store },
  { id: "m-budget", kind: "module", title: "Budget", subtitle: "Allocations & benchmarks", to: "/budget", icon: Wallet },
  { id: "m-tasks", kind: "module", title: "Tasks", subtitle: "Every action item", to: "/tasks", icon: ClipboardList },
  { id: "m-timeline", kind: "module", title: "Timeline", subtitle: "Roadmap to event day", to: "/timeline", icon: Calendar },
  { id: "m-collab", kind: "module", title: "Collaboration Workspace", subtitle: "Team + family activity", to: "/collaboration", icon: Handshake },
  { id: "m-decisions", kind: "module", title: "Decision Center™", subtitle: "Weigh options with AI", to: "/decisions", icon: Lightbulb },
  { id: "m-fund", kind: "module", title: "Fundraising", subtitle: "Campaigns + donors", to: "/fundraising", icon: HeartHandshake },
  { id: "m-files", kind: "module", title: "Files", subtitle: "Docs, media, contracts", to: "/files", icon: FolderOpen },
  { id: "m-reports", kind: "module", title: "Reports", subtitle: "Analytics by event", to: "/reports", icon: FileBarChart },
  { id: "m-settings", kind: "module", title: "Settings", subtitle: "Account, privacy, workspace", to: "/settings", icon: Settings },

  // Events
  { id: "e1", kind: "event", title: "Amara & Julien — Wedding", subtitle: "Lake Como · Oct 17, 2026", to: "/dashboard", icon: Calendar },
  { id: "e2", kind: "event", title: "Ade turns 40", subtitle: "Brooklyn · Aug 2, 2026", to: "/dashboard", icon: Calendar },
  { id: "e3", kind: "event", title: "Okafor Family Reunion", subtitle: "Houston · Dec 27, 2026", to: "/dashboard", icon: Calendar },

  // Guests
  { id: "g1", kind: "guest", title: "Priya Menon", subtitle: "RSVP: Yes · +1 · Vegetarian", to: "/guests", icon: Users },
  { id: "g2", kind: "guest", title: "Tunde Bakare", subtitle: "RSVP: Pending", to: "/guests", icon: Users },
  { id: "g3", kind: "guest", title: "Lauren & Marcus Chen", subtitle: "RSVP: Yes · Table 4", to: "/guests", icon: Users },

  // Vendors
  { id: "v1", kind: "vendor", title: "Bloomhaus Florals", subtitle: "Florist · Contact pending", to: "/marketplace", icon: Store },
  { id: "v2", kind: "vendor", title: "Studio Nero", subtitle: "Photography · Confirmed", to: "/marketplace", icon: Store },
  { id: "v3", kind: "vendor", title: "Onyema Catering", subtitle: "Catering · Confirmed", to: "/marketplace", icon: Store },
  { id: "v4", kind: "vendor", title: "DJ Kairo", subtitle: "Music · Confirmed", to: "/marketplace", icon: Store },

  // Files / Contracts / Photos
  { id: "f1", kind: "contract", title: "Bloomhaus_final_contract.pdf", subtitle: "Contract · 412 KB", to: "/files", icon: FileText },
  { id: "f2", kind: "file", title: "Reception playlist — v3.m3u", subtitle: "Playlist · 18 KB", to: "/files", icon: FileText },
  { id: "p1", kind: "photo", title: "Venue walkthrough — Villa d'Este", subtitle: "Photo · Sep 12", to: "/files", icon: ImageIcon },

  // Tasks
  { id: "t1", kind: "task", title: "Confirm florist contact — Bloomhaus", subtitle: "Due today", to: "/tasks", icon: ClipboardList },
  { id: "t2", kind: "task", title: "Send save-the-dates (batch 2)", subtitle: "Due today", to: "/tasks", icon: ClipboardList },
  { id: "t3", kind: "task", title: "Approve caterer tasting menu", subtitle: "Due tomorrow", to: "/tasks", icon: ClipboardList },

  // Budget items
  { id: "b1", kind: "budget", title: "Venue — $22,000 committed", subtitle: "32% of budget", to: "/budget", icon: Wallet },
  { id: "b2", kind: "budget", title: "Catering — $14,300 projected", subtitle: "21% of budget", to: "/budget", icon: Wallet },

  // Conversations & decisions
  { id: "c1", kind: "conversation", title: "AI · Rain contingency for Oct 17", subtitle: "MelaAssist™ chat", to: "/decisions", icon: Sparkles },
  { id: "d1", kind: "decision", title: "Ceremony music: string quartet vs solo violin", subtitle: "Awaiting your call", to: "/decisions", icon: Lightbulb },
  { id: "d2", kind: "decision", title: "Late-night snack: pizza truck vs suya station", subtitle: "3 options weighted", to: "/decisions", icon: Lightbulb },

  // Notes
  { id: "n1", kind: "note", title: "Julien's vow drafts", subtitle: "Note · updated last week", to: "/files", icon: FileText },
];

// Vendor-specific search index
export const VENDOR_SEARCH_INDEX: SearchItem[] = [
  { id: "vm-dash", kind: "module", title: "Dashboard", subtitle: "Business overview & stats", to: "/vendor", icon: Sparkles, keywords: "home overview stats analytics" },
  { id: "vm-packages", kind: "module", title: "Packages", subtitle: "Service packages & pricing", to: "/vendor-packages", icon: Boxes, keywords: "pricing services offers create" },
  { id: "vm-profile", kind: "module", title: "My Profile", subtitle: "Public listing & portfolio", to: "/vendor-profile-builder", icon: Store, keywords: "listing bio photos portfolio branding" },
  { id: "vm-availability", kind: "module", title: "Availability", subtitle: "Block dates & hours", to: "/vendor-settings", icon: Settings, keywords: "blocks dates hours schedule unavailable" },
  { id: "vm-files", kind: "module", title: "Files", subtitle: "Docs, photos, media", to: "/files", icon: FolderOpen, keywords: "documents photos uploads media" },
  { id: "vm-subscription", kind: "module", title: "Subscription", subtitle: "Plan & billing", to: "/subscription", icon: Crown, keywords: "billing plan upgrade premium" },
  { id: "vm-settings", kind: "module", title: "Settings", subtitle: "Account & preferences", to: "/settings", icon: Settings, keywords: "account profile preferences notifications" },
];

export function searchIndex(query: string, limit = 40, role?: string): SearchItem[] {
  const index = role === "vendor" ? VENDOR_SEARCH_INDEX : SEARCH_INDEX;
  const q = query.trim().toLowerCase();
  if (!q) return index.slice(0, limit);
  return index.filter((item) => {
    const hay = `${item.title} ${item.subtitle ?? ""} ${item.keywords ?? ""} ${item.kind}`.toLowerCase();
    return hay.includes(q);
  }).slice(0, limit);
}

export const KIND_LABEL: Record<SearchKind, string> = {
  module: "Module",
  event: "Event",
  guest: "Guest",
  vendor: "Vendor",
  file: "File",
  contract: "Contract",
  photo: "Photo",
  task: "Task",
  message: "Message",
  budget: "Budget",
  conversation: "AI conversation",
  decision: "Decision",
  note: "Note",
};
