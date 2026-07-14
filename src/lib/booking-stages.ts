import {
  Bookmark, MessageCircle, CalendarClock, FileText, Eye, ThumbsUp,
  ScrollText, PenSquare, Wallet, CheckCircle2, PartyPopper, Star, Trophy, PlayCircle,
  XCircle, MailX, Slash,
  type LucideIcon,
} from "lucide-react";

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
  { key: "saved",                  label: "Saved",                 short: "Saved",       icon: Bookmark,       group: "discovery",  tone: "bg-muted text-muted-foreground" },
  { key: "contacted",              label: "Contacted",             short: "Contacted",   icon: MessageCircle,  group: "discovery",  tone: "bg-muted text-foreground" },
  { key: "consultation_scheduled", label: "Availability Requested",short: "Availability",icon: CalendarClock,  group: "negotiation",tone: "bg-primary/10 text-primary" },
  { key: "quote_sent",             label: "Quote Received",        short: "Quote",       icon: FileText,       group: "negotiation",tone: "bg-primary/10 text-primary" },
  { key: "quote_under_review",     label: "Negotiating",           short: "Negotiating", icon: Eye,            group: "negotiation",tone: "bg-primary/15 text-primary" },
  { key: "contract_sent",          label: "Contract Sent",         short: "Contract",    icon: ScrollText,     group: "contract",   tone: "bg-gold/15 text-gold-foreground" },
  { key: "contract_signed",        label: "Contract Signed",       short: "Signed",      icon: PenSquare,      group: "contract",   tone: "bg-gold/25 text-gold-foreground" },
  { key: "deposit_paid",           label: "Deposit Received",      short: "Deposit",     icon: Wallet,         group: "payment",    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { key: "booked",                 label: "Booked",                short: "Booked",      icon: CheckCircle2,   group: "payment",    tone: "bg-emerald-500 text-white" },
  { key: "in_progress",            label: "In Progress",           short: "In Progress", icon: PlayCircle,     group: "delivered",  tone: "bg-primary/20 text-primary" },
  { key: "completed",              label: "Completed",             short: "Completed",   icon: PartyPopper,    group: "delivered",  tone: "bg-primary text-primary-foreground" },
  { key: "review_requested",       label: "Review Requested",      short: "Review Req.", icon: Star,           group: "delivered",  tone: "bg-primary/10 text-primary" },
  { key: "reviewed",               label: "Reviewed",              short: "Reviewed",    icon: Trophy,         group: "delivered",  tone: "bg-primary/20 text-primary" },
  { key: "cancelled",              label: "Cancelled",             short: "Cancelled",   icon: XCircle,        group: "delivered",  tone: "bg-destructive/15 text-destructive" },
] as const;

export const STAGE_MAP: Record<BookingStage, StageMeta> =
  STAGES.reduce((acc, s) => ({ ...acc, [s.key]: s }), {} as Record<BookingStage, StageMeta>);

export const stageIndex = (s: BookingStage) => STAGES.findIndex((x) => x.key === s);
export const stageMeta = (s: BookingStage) => STAGE_MAP[s];
export const progressPct = (s: BookingStage) =>
  Math.round(((stageIndex(s) + 1) / STAGES.length) * 100);
export const isConfirmed = (s: BookingStage) =>
  ["booked", "completed", "review_requested", "reviewed"].includes(s);

export const CONFIRMATION_RULES: { key: ConfirmationRule; label: string; hint: string }[] = [
  { key: "contract_only",        label: "Contract Signed Only",              hint: "Booking is confirmed the moment the contract is signed." },
  { key: "deposit_only",         label: "Deposit Paid Only",                 hint: "Booking is confirmed once the deposit is received." },
  { key: "contract_and_deposit", label: "Contract Signed + Deposit Paid",    hint: "Default. Booking is confirmed only after both are complete." },
  { key: "manual",               label: "Manual Confirmation",               hint: "You confirm each booking yourself." },
];
