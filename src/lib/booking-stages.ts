import {
  Bookmark, MessageCircle, TrendingUp,
  CheckCircle2, PartyPopper,
  XCircle, MailX, Slash,
  type LucideIcon,
} from "lucide-react";

/**
 * Simplified lead pipeline stages.
 * New → Contacted → Interested → Hired → Closed
 *
 * The underlying DB stores detailed stage values for backward compatibility,
 * but the UI presents only these 5 simplified steps.
 */
export type BookingStage =
  | "saved"
  | "contacted"
  | "consultation_scheduled"
  | "quote_sent"
  | "quote_viewed"
  | "quote_under_review"
  | "quote_accepted"
  | "contract_sent"
  | "contract_signed"
  | "deposit_paid"
  | "booked"
  | "in_progress"
  | "completed"
  | "review_requested"
  | "reviewed"
  | "cancelled"
  | "no_response"
  | "lost";

export type ConfirmationRule =
  | "contract_only"
  | "deposit_only"
  | "contract_and_deposit"
  | "manual";

export type StageMeta = {
  key: BookingStage;
  label: string;
  short: string;
  icon: LucideIcon;
  group: "discovery" | "negotiation" | "contract" | "payment" | "delivered";
  /** Tailwind classes based on semantic tokens */
  tone: string;
};

export const STAGES: readonly StageMeta[] = [
  // ── Simplified pipeline ────────────────────────────────────────────────────
  { key: "saved",                  label: "New Lead",           short: "New",         icon: Bookmark,       group: "discovery",  tone: "bg-muted text-muted-foreground" },
  { key: "contacted",              label: "Contacted",           short: "Contacted",   icon: MessageCircle,  group: "discovery",  tone: "bg-muted text-foreground" },
  // "Interested" group — any stage between initial contact and agreement
  { key: "consultation_scheduled", label: "In Discussion",       short: "In Discuss.", icon: MessageCircle,  group: "negotiation",tone: "bg-primary/10 text-primary" },
  { key: "quote_sent",             label: "Interested",          short: "Interested",  icon: TrendingUp,     group: "negotiation",tone: "bg-primary/15 text-primary" },
  { key: "quote_viewed",           label: "Interested",          short: "Interested",  icon: TrendingUp,     group: "negotiation",tone: "bg-primary/15 text-primary" },
  { key: "quote_under_review",     label: "Considering",         short: "Considering", icon: TrendingUp,     group: "negotiation",tone: "bg-primary/15 text-primary" },
  { key: "quote_accepted",         label: "Interested",          short: "Interested",  icon: TrendingUp,     group: "negotiation",tone: "bg-primary/20 text-primary" },
  { key: "contract_sent",          label: "Interested",          short: "Interested",  icon: TrendingUp,     group: "negotiation",tone: "bg-gold/15 text-gold-foreground" },
  { key: "contract_signed",        label: "Interested",          short: "Interested",  icon: TrendingUp,     group: "negotiation",tone: "bg-gold/25 text-gold-foreground" },
  // "Hired" group
  { key: "deposit_paid",           label: "Hired",               short: "Hired",       icon: CheckCircle2,   group: "negotiation",tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { key: "booked",                 label: "Hired",               short: "Hired",       icon: CheckCircle2,   group: "negotiation",tone: "bg-emerald-500 text-white" },
  // "Closed" group
  { key: "in_progress",            label: "Event Day",           short: "Event Day",   icon: PartyPopper,    group: "delivered",  tone: "bg-primary/20 text-primary" },
  { key: "completed",              label: "Closed",              short: "Closed",      icon: PartyPopper,    group: "delivered",  tone: "bg-primary text-primary-foreground" },
  { key: "review_requested",       label: "Closed",              short: "Closed",      icon: PartyPopper,    group: "delivered",  tone: "bg-primary/10 text-primary" },
  { key: "reviewed",               label: "Closed",              short: "Closed",      icon: PartyPopper,    group: "delivered",  tone: "bg-primary/20 text-primary" },
  // Exceptions
  { key: "cancelled",              label: "Archived",            short: "Archived",    icon: XCircle,        group: "delivered",  tone: "bg-destructive/15 text-destructive" },
  { key: "no_response",            label: "No Response",         short: "No Response", icon: MailX,          group: "delivered",  tone: "bg-muted text-muted-foreground" },
  { key: "lost",                   label: "Lost",                short: "Lost",        icon: Slash,          group: "delivered",  tone: "bg-destructive/10 text-destructive" },
] as const;

/**
 * The 5 stages shown in the simplified progress tracker.
 * New → Contacted → Interested → Hired → Closed
 */
export const TRACKER_STAGES: readonly BookingStage[] = [
  "saved",
  "contacted",
  "quote_sent",
  "booked",
  "completed",
] as const;

/** Stages that represent a terminal exception rather than normal progression. */
export const EXCEPTION_STAGES: readonly BookingStage[] = [
  "cancelled",
  "no_response",
  "lost",
] as const;

export const STAGE_MAP: Record<BookingStage, StageMeta> =
  STAGES.reduce((acc, s) => ({ ...acc, [s.key]: s }), {} as Record<BookingStage, StageMeta>);

export const stageIndex = (s: BookingStage) => STAGES.findIndex((x) => x.key === s);
export const stageMeta = (s: BookingStage) => STAGE_MAP[s];
export const progressPct = (s: BookingStage) =>
  Math.round(((stageIndex(s) + 1) / STAGES.length) * 100);
export const isConfirmed = (s: BookingStage) =>
  ["booked", "deposit_paid", "completed", "review_requested", "reviewed"].includes(s);

// Kept for backward compatibility — no longer used in active UI.
export const CONFIRMATION_RULES: { key: ConfirmationRule; label: string; hint: string }[] = [
  { key: "contract_only",        label: "Proposal Accepted",           hint: "Lead confirmed once the client accepts." },
  { key: "deposit_only",         label: "Payment Noted",               hint: "Lead confirmed once payment is noted." },
  { key: "contract_and_deposit", label: "Proposal + Payment",          hint: "Lead confirmed after both." },
  { key: "manual",               label: "Manual",                      hint: "You mark each lead as hired yourself." },
];
