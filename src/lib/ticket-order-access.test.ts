import { describe, expect, it } from "vitest";
import {
  buildTicketCheckoutUrls,
  getCanonicalTicketSiteUrl,
  TicketCheckoutInput,
} from "./ticket-order-access";

const eventId = "34aa928d-75db-40ef-bbda-e02698128178";
const accessToken = "5e7606d2-8101-4241-8d93-7f07cc6358f4";

describe("ticket checkout return URL security", () => {
  it("rejects the former client-controlled redirect fields", () => {
    expect(() => TicketCheckoutInput.parse({
      ticketTypeId: eventId,
      quantity: 1,
      buyerEmail: "buyer@example.com",
      buyerName: "Buyer",
      environment: "sandbox",
      successUrl: "https://attacker.example/steal",
      cancelUrl: "https://attacker.example/cancel",
    })).toThrow();
  });

  it("uses only the canonical site origin and fixed event routes", () => {
    const urls = buildTicketCheckoutUrls(
      "https://tickets.example/configured/path?next=https://attacker.example",
      eventId,
      accessToken,
    );

    expect(urls.cancelUrl).toBe(`https://tickets.example/t/${eventId}`);
    expect(urls.successUrl).not.toContain("attacker.example");
    expect(urls.successUrl).toContain(`/t/${eventId}/confirm?`);
  });

  it("preserves Stripe's literal checkout-session placeholder", () => {
    const { successUrl } = buildTicketCheckoutUrls(
      "https://tickets.example",
      eventId,
      accessToken,
    );

    expect(successUrl).toContain("session_id={CHECKOUT_SESSION_ID}");
    expect(successUrl).not.toContain("%7BCHECKOUT_SESSION_ID%7D");
    expect(successUrl).toContain(`access_token=${accessToken}`);
  });

  it("never derives the canonical site from an incoming request host", () => {
    expect(getCanonicalTicketSiteUrl({
      SITE_URL: "https://melabridge.com",
      REPLIT_DEV_DOMAIN: "trusted-preview.replit.dev",
      NODE_ENV: "production",
    })).toBe("https://melabridge.com");
    expect(getCanonicalTicketSiteUrl({
      REPLIT_DEV_DOMAIN: "trusted-preview.replit.dev",
      NODE_ENV: "development",
    })).toBe("https://trusted-preview.replit.dev");
  });
});