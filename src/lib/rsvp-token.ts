/**
 * Signed RSVP token helpers.
 *
 * Tokens are URL-safe base64 strings containing a payload + HMAC-SHA256 signature.
 * The secret is SESSION_SECRET (already a Replit Secret).
 *
 * Payload: { guestId, email, eventId, status, exp (unix seconds) }
 *
 * Security properties:
 *  - Tamper-evident: HMAC signature covers the entire payload.
 *  - Time-limited: exp is 30 days from issue.
 *  - Status-specific: separate tokens for "yes" and "no" — prevents a
 *    "confirmed" link being reused to decline.
 *  - One-click: the guest visits the link and the RSVP is applied immediately.
 *    The existing `submitGuestRsvp` server fn enforces email-match before writing.
 */

export type RsvpTokenPayload = {
  guestId: string;
  email: string;
  eventId: string;
  status: "yes" | "no" | "maybe";
  exp: number; // unix seconds
};

const ALGO = "SHA-256";
const EXP_DAYS = 30;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not configured");
  return s;
}

async function hmac(secret: string, data: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    // Web Crypto (edge / modern Node)
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: ALGO },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
    return Buffer.from(sig).toString("base64url");
  }
  // Fallback: Node built-in crypto
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(data).digest("base64url");
}

async function hmacVerify(secret: string, data: string, sig: string): Promise<boolean> {
  const expected = await hmac(secret, data);
  // Constant-time compare via XOR
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

/** Sign a payload and return a compact URL-safe token string. */
export async function signRsvpToken(payload: Omit<RsvpTokenPayload, "exp">): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + EXP_DAYS * 86400;
  const full: RsvpTokenPayload = { ...payload, exp };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = await hmac(getSecret(), body);
  return `${body}.${sig}`;
}

/** Verify a token. Returns the payload or null if invalid / expired. */
export async function verifyRsvpToken(token: string): Promise<RsvpTokenPayload | null> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 0) return null;
    const body = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const ok = await hmacVerify(getSecret(), body, sig);
    if (!ok) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as RsvpTokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null; // expired
    return payload;
  } catch {
    return null;
  }
}
