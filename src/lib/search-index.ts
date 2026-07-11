import {
  Calendar,
  Users,
  Wallet,
  ClipboardList,
  Vault,
  Dna,
  Globe2,
  BarChart3,
  Ticket,
  HeartHandshake,
  MessageSquare,
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

// A curated catalog that powers Universal Search + Cmd+K.
export const SEARCH_INDEX: SearchItem[] = [
  // Modules
  { id: "m-dash", kind: "module", title: "AI Command Center", subtitle: "Dashboard", to: "/dashboard", icon: Sparkles, keywords: "home dashboard overview intelligence" },
  { id: "m-workspace", kind: "module", title: "Event Workspace", subtitle: "All planning tools in one place", to: "/workspace", icon: GitBranch },
  { id: "m-guests", kind: "module", title: "Guests", subtitle: "Guest list, RSVPs, seating", to: "/guests", icon: Users },
  { id: "m-vendors", kind: "module", title: "Vendors", subtitle: "Sourcing, contracts, payments", to: "/vendors", icon: Store },
  { id: "m-budget", kind: "module", title: "Budget", subtitle: "Allocations & benchmarks", to: "/budget", icon: Wallet },
  { id: "m-tasks", kind: "module", title: "Tasks", subtitle: "Every action item", to: "/tasks", icon: ClipboardList },
  { id: "m-timeline", kind: "module", title: "Timeline", subtitle: "Roadmap to event day", to: "/timeline", icon: Calendar },
  { id: "m-collab", kind: "module", title: "Collaboration Workspace", subtitle: "Team + family activity", to: "/collaboration", icon: Handshake },
  { id: "m-decisions", kind: "module", title: "Decision Center™", subtitle: "Weigh options with AI", to: "/decisions", icon: Lightbulb },
  { id: "m-vault", kind: "module", title: "BridgeVault™", subtitle: "Permanent archive", to: "/bridgevault", icon: Vault },
  { id: "m-dna", kind: "module", title: "BridgeDNA™", subtitle: "Personalization engine", to: "/bridgedna", icon: Dna },
  { id: "m-world", kind: "module", title: "BridgeWorld™", subtitle: "Life journey timeline", to: "/bridgeworld", icon: Globe2 },
  { id: "m-intel", kind: "module", title: "Bridge Intelligence™", subtitle: "Community benchmarks", to: "/bridge-intelligence", icon: BarChart3 },
  { id: "m-tickets", kind: "module", title: "Tickets", subtitle: "Sell + track admissions", to: "/tickets", icon: Ticket },
  { id: "m-fund", kind: "module", title: "Fundraising", subtitle: "Campaigns + donors", to: "/fundraising", icon: HeartHandshake },
  { id: "m-msg", kind: "module", title: "Messaging", subtitle: "Guests, vendors, team", to: "/messaging", icon: MessageSquare },
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
  { id: "v1", kind: "vendor", title: "Bloomhaus Florals", subtitle: "Florist · Contract pending", to: "/vendors", icon: Store },
  { id: "v2", kind: "vendor", title: "Studio Nero", subtitle: "Photography · Confirmed", to: "/vendors", icon: Store },
  { id: "v3", kind: "vendor", title: "Onyema Catering", subtitle: "Catering · Confirmed", to: "/vendors", icon: Store },
  { id: "v4", kind: "vendor", title: "DJ Kairo", subtitle: "Music · Confirmed", to: "/vendors", icon: Store },

  // Files / Contracts / Photos
  { id: "f1", kind: "contract", title: "Bloomhaus_final_contract.pdf", subtitle: "Contract · 412 KB", to: "/files", icon: FileText },
  { id: "f2", kind: "file", title: "Reception playlist — v3.m3u", subtitle: "Playlist · 18 KB", to: "/files", icon: FileText },
  { id: "p1", kind: "photo", title: "Venue walkthrough — Villa d'Este", subtitle: "Photo · Sep 12", to: "/bridgevault", icon: ImageIcon },

  // Tasks
  { id: "t1", kind: "task", title: "Confirm florist contract — Bloomhaus", subtitle: "Due today", to: "/tasks", icon: ClipboardList },
  { id: "t2", kind: "task", title: "Send save-the-dates (batch 2)", subtitle: "Due today", to: "/tasks", icon: ClipboardList },
  { id: "t3", kind: "task", title: "Approve caterer tasting menu", subtitle: "Due tomorrow", to: "/tasks", icon: ClipboardList },

  // Messages
  { id: "msg1", kind: "message", title: "Priya: 'Is a vegan option possible?'", subtitle: "Guest thread · 2h ago", to: "/messaging", icon: MessageSquare },
  { id: "msg2", kind: "message", title: "Studio Nero sent the shot list", subtitle: "Vendor thread · Yesterday", to: "/messaging", icon: MessageSquare },

  // Budget items
  { id: "b1", kind: "budget", title: "Venue — $22,000 committed", subtitle: "32% of budget", to: "/budget", icon: Wallet },
  { id: "b2", kind: "budget", title: "Catering — $14,300 projected", subtitle: "21% of budget", to: "/budget", icon: Wallet },

  // Conversations & decisions
  { id: "c1", kind: "conversation", title: "AI · Rain contingency for Oct 17", subtitle: "BridgeMind™ chat", to: "/decisions", icon: Sparkles },
  { id: "d1", kind: "decision", title: "Ceremony music: string quartet vs solo violin", subtitle: "Awaiting your call", to: "/decisions", icon: Lightbulb },
  { id: "d2", kind: "decision", title: "Late-night snack: pizza truck vs suya station", subtitle: "3 options weighted", to: "/decisions", icon: Lightbulb },

  // Notes
  { id: "n1", kind: "note", title: "Julien's vow drafts", subtitle: "Note · updated last week", to: "/bridgevault", icon: FileText },
];

export function searchIndex(query: string, limit = 40): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SEARCH_INDEX.slice(0, limit);
  return SEARCH_INDEX.filter((item) => {
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
