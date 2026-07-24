import type { MelaAssistPrompt, MelaAssistRole } from "./types";

const PLANNER: MelaAssistPrompt[] = [
  { label: "Plan my event", prompt: "Help me plan my event from scratch — what should I do first?" },
  { label: "Build my timeline", prompt: "Draft a runsheet timeline for my upcoming event." },
  { label: "Create my budget", prompt: "Suggest a starter budget breakdown for my event." },
  { label: "Find vendors", prompt: "Which vendor categories should I book first, and why?" },
];

const VENDOR: MelaAssistPrompt[] = [
  { label: "Improve my profile", prompt: "Review my vendor profile and suggest specific improvements." },
  { label: "Create service packages", prompt: "Draft three service package tiers I can offer." },
  { label: "Write FAQs", prompt: "Write 6 FAQs planners typically ask a vendor in my category." },
  { label: "Improve business description", prompt: "Rewrite my business description to sound more premium and specific." },
];

const ADMIN: MelaAssistPrompt[] = [
  { label: "Platform overview", prompt: "Summarise the current state of the MelaBridge platform." },
  { label: "Incomplete vendor profiles", prompt: "Which vendor profiles look incomplete and what's missing?" },
  { label: "Recent registrations", prompt: "Summarise recent user registrations and highlight anything unusual." },
  { label: "Health check", prompt: "Give me a quick admin health check across users, events, and vendors." },
];

const GUEST: MelaAssistPrompt[] = [
  { label: "What is MelaBridge?", prompt: "What is MelaBridge and who is it for?" },
  { label: "How pricing works", prompt: "Explain MelaBridge pricing in plain language." },
];

export function getSuggestionsForRole(role: MelaAssistRole): MelaAssistPrompt[] {
  switch (role) {
    case "vendor":
      return VENDOR;
    case "admin":
      return ADMIN;
    case "personal":
    case "organization":
      return PLANNER;
    default:
      return GUEST;
  }
}

export function greetingForRole(role: MelaAssistRole): string {
  switch (role) {
    case "vendor":
      return "I can help you sharpen your profile, draft packages, and win more bookings.";
    case "admin":
      return "I can help you monitor the platform and spot anything that needs attention.";
    case "personal":
    case "organization":
      return "I can help you plan, budget, and run your event — start with a quick prompt below.";
    default:
      return "Ask me anything about MelaBridge.";
  }
}
