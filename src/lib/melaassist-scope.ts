/**
 * MelaAssist is intentionally limited to MelaBridge event planning and
 * vendor-profile work. This guard handles clearly unrelated requests before
 * they consume provider time; the model still handles nuanced planning
 * questions normally.
 */
const OUT_OF_SCOPE_PATTERNS = [
  /\b(?:write|debug|build|fix|compile)\s+(?:code|software|javascript|typescript|python|sql)\b/i,
  /\b(?:javascript|typescript|python|java|rust|c\+\+|sql)\b/i,
  /\b(?:politic|election|campaign|medical|diagnos|prescription|legal advice|lawsuit)\b/i,
  /\b(?:stock|crypto|bitcoin|investment advice|tax advice)\b/i,
  /\b(?:weather forecast|flight booking|hotel booking|travel itinerary|recipe)\b/i,
];

export function isClearlyOutsideMelaAssistScope(question: string): boolean {
  return OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(question));
}

export const OUT_OF_SCOPE_MELAASSIST_ANSWER =
  "I can help with event planning, guests and RSVPs, budgets, timelines, vendor discovery, and vendor-profile work. Ask me a planning question and I’ll keep it grounded in your MelaBridge workspace.";