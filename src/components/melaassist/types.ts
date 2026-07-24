export type MelaAssistRole = "personal" | "organization" | "vendor" | "admin" | "guest";

export type MelaAssistContextInfo = {
  userId: string | null;
  role: MelaAssistRole;
  pathname: string;
  eventId?: string | null;
  vendorId?: string | null;
  organizationId?: string | null;
};

export type MelaAssistMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  pending?: boolean;
  error?: boolean;
};

export type MelaAssistPrompt = {
  label: string;
  prompt: string;
  hint?: string;
};
