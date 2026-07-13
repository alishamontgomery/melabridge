export type NLCommand = { label: string; to: string; hint?: string };

// Very small keyword router. Returns 0-3 suggestions for a natural-language query.
export function parseNLCommand(input: string): NLCommand[] {
  const q = input.trim().toLowerCase();
  if (q.length < 3) return [];
  const has = (...words: string[]) => words.some((w) => q.includes(w));
  const out: NLCommand[] = [];

  if (has("create", "new", "start", "plan") && has("event", "wedding", "party", "sangeet", "gala")) {
    out.push({ label: "Create a new event", to: "/events/new", hint: "Wizard" });
  }
  if (has("upload") && has("contract", "file", "doc", "pdf")) {
    out.push({ label: "Upload to BridgeVault™", to: "/bridgevault" });
  }
  if (has("add", "invite") && has("guest")) {
    out.push({ label: "Add a guest", to: "/guests" });
  }
  if (has("invite") && has("collab", "team", "family", "planner")) {
    out.push({ label: "Invite collaborators", to: "/collaboration" });
  }
  if (has("show", "open", "view", "see")) {
    if (has("budget")) out.push({ label: "Open Budget", to: "/budget" });
    if (has("analytic")) out.push({ label: "Open Analytics", to: "/analytics" });
    if (has("invoice", "unpaid", "payment")) out.push({ label: "Open Payments", to: "/bridgepay" });
    if (has("upcoming", "event")) out.push({ label: "Open Events", to: "/events" });
    if (has("vendor application", "applications")) out.push({ label: "Open Admin", to: "/admin" });
    if (has("report")) out.push({ label: "Open Reports", to: "/reports" });
    if (has("timeline")) out.push({ label: "Open Timeline", to: "/timeline" });
  }
  if (has("find", "search")) {
    if (has("dj", "photograph", "florist", "caterer", "vendor")) {
      out.push({ label: "Browse Marketplace", to: "/marketplace", hint: "Search vendors" });
    }
  }
  if (has("draft", "write") && has("message", "email", "invite", "note")) {
    out.push({ label: "Draft with AI", to: "/messaging" });
  }
  if (has("ask", "help", "assist") || q.startsWith("how ") || q.startsWith("why ") || q.startsWith("what ")) {
    out.push({ label: "Ask MelaAssist™", to: "/concierge" });
  }
  if (has("create") && has("proposal", "quote")) {
    out.push({ label: "Open Vendor Portal", to: "/vendor-portal" });
  }

  // De-dupe by `to`
  const seen = new Set<string>();
  return out.filter((c) => (seen.has(c.to) ? false : seen.add(c.to)));
}
