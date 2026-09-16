import type { MelaAssistActionKind } from "./types";

export type ActionMeta = {
  label: string;
  /** Executor exists on the server (safe to persist on approval). */
  executable: boolean;
  /** Short user-facing description of what "Approve" will do. */
  approvalCopy: string;
};

/**
 * Central registry of MelaAssist action kinds.
 *
 * `executable: true` maps to a server-side executor in
 * `src/lib/melaassist-actions.functions.ts` (`executeMelaAction`).
 * Everything else is preview-only until we build the target feature —
 * the user can still copy / edit the draft manually.
 */
export const ACTION_REGISTRY: Record<MelaAssistActionKind, ActionMeta> = {
  update_business_description: {
    label: "Update business description",
    executable: true,
    approvalCopy: "Save this description to your vendor profile.",
  },
  update_event_notes: {
    label: "Update event notes",
    executable: true,
    approvalCopy: "Save these notes on the current event.",
  },
  create_budget_item: {
    label: "Create budget item",
    executable: true,
    approvalCopy: "Add this line to your event budget.",
  },
  create_task: {
    label: "Create task",
    executable: true,
    approvalCopy: "Add this task to your event.",
  },
  create_package: {
    label: "Create service package",
    executable: false,
    approvalCopy: "Preview only — copy this draft to reuse in your profile.",
  },
  create_faq: {
    label: "Create FAQ",
    executable: false,
    approvalCopy: "Preview only — copy this FAQ to your profile.",
  },
  generate_timeline: {
    label: "Draft timeline",
    executable: false,
    approvalCopy: "Preview only — copy this timeline draft.",
  },
  generate_budget: {
    label: "Draft budget",
    executable: false,
    approvalCopy: "Preview only — copy this budget draft.",
  },
  recommend_vendors: {
    label: "Vendor recommendations",
    executable: false,
    approvalCopy: "Preview only — review these vendor ideas.",
  },
  create_event_draft: {
    label: "Create event",
    executable: true,
    approvalCopy: "Create this event in your workspace. You can edit anything after.",
  },
  add_timeline_milestone: {
    label: "Add timeline milestone",
    executable: true,
    approvalCopy: "Add this milestone as a task on your event timeline.",
  },
};

export function getActionMeta(kind: MelaAssistActionKind): ActionMeta {
  return ACTION_REGISTRY[kind] ?? { label: kind, executable: false, approvalCopy: "Preview only." };
}
