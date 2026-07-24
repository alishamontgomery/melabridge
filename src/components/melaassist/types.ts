export type MelaAssistRole = "personal" | "organization" | "vendor" | "admin" | "guest";

export type MelaAssistContextInfo = {
  userId: string | null;
  role: MelaAssistRole;
  pathname: string;
  eventId?: string | null;
  vendorId?: string | null;
  organizationId?: string | null;
};

/**
 * Action framework
 * ---------------------------------------------------------------------------
 * MelaAssist can propose structured actions that the user must explicitly
 * approve. Executors that map to real tables persist changes; everything else
 * is preview-only until we build the target feature.
 */
export type MelaAssistActionKind =
  | "create_package"
  | "create_faq"
  | "update_business_description"
  | "update_event_notes"
  | "create_budget_item"
  | "create_task"
  | "generate_timeline"
  | "generate_budget"
  | "recommend_vendors"
  | "draft_message";

export type MelaAssistActionStatus = "pending" | "editing" | "approved" | "cancelled" | "executed" | "failed";

export type MelaAssistAction = {
  id: string;
  kind: MelaAssistActionKind;
  title: string;
  summary?: string;
  /** Structured payload that the executor understands. Free-form by kind. */
  payload: Record<string, unknown>;
  /** True when there is no server-side executor yet — the card is preview-only. */
  previewOnly?: boolean;
  status: MelaAssistActionStatus;
  createdAt: number;
  error?: string;
};

export type MelaAssistMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  pending?: boolean;
  error?: boolean;
  /** Optional structured actions produced with this assistant message. */
  actions?: MelaAssistAction[];
  /** Optional next-step suggestions the assistant proposes after a turn. */
  nextSteps?: string[];
};

/**
 * Workspace memory — short-lived, session-scoped, per-user.
 * Cleared on sign-out or when the user explicitly resets the conversation.
 * Not intended as long-term memory.
 */
export type MelaAssistMemory = {
  currentTask?: string | null;
  currentDraft?: string | null;
  currentPackageId?: string | null;
  currentEventId?: string | null;
  currentVendorId?: string | null;
  currentPlannerId?: string | null;
  /** Arbitrary short-term facts collected during the session. */
  scratch?: Record<string, string | number | boolean | null>;
};

export type MelaAssistHistoryEntry = {
  id: string;
  kind: MelaAssistActionKind;
  title: string;
  at: number;
  status: "executed" | "cancelled" | "failed";
  note?: string;
};

export type MelaAssistPrompt = {
  label: string;
  prompt: string;
  hint?: string;
};
