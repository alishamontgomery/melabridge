import { z } from "zod";

const uuid = z.string().uuid();

export const TicketCheckoutInput = z.object({
  ticketTypeId: uuid,
  quantity: z.number().int().min(1).max(100),
  buyerEmail: z.string().email(),
  buyerName: z.string().min(1).max(120),
  promoCode: z.string().max(60).optional().nullable(),
  environment: z.enum(["sandbox", "live"]),
}).strict();

export function buildTicketCheckoutUrls(
  siteUrl: string,
  eventId: string,
  accessToken: string,
) {
  const canonicalUrl = new URL(siteUrl);
  if (canonicalUrl.protocol !== "https:" && canonicalUrl.protocol !== "http:") {
    throw new Error("Could not determine a safe checkout return URL");
  }
  const eventPath = `/t/${encodeURIComponent(eventId)}`;
  return {
    successUrl: `${canonicalUrl.origin}${eventPath}/confirm?session_id={CHECKOUT_SESSION_ID}&access_token=${encodeURIComponent(accessToken)}`,
    cancelUrl: `${canonicalUrl.origin}${eventPath}`,
  };
}

export function getCanonicalTicketSiteUrl(env: {
  SITE_URL?: string;
  REPLIT_DEV_DOMAIN?: string;
  NODE_ENV?: string;
}) {
  if (env.SITE_URL) return new URL(env.SITE_URL).origin;
  if (env.NODE_ENV === "production") return "https://melabridge.com";
  if (env.REPLIT_DEV_DOMAIN) return `https://${env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:5000";
}