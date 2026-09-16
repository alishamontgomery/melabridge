import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEmailProviderCacheForTests, sendTemplateEmail } from "./send-email";

const { proxy, listConnections } = vi.hoisted(() => ({
  proxy: vi.fn(),
  listConnections: vi.fn(),
}));

vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class {
    proxy = proxy;
    listConnections = listConnections;
  },
}));

describe("sendTemplateEmail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    proxy.mockReset();
    listConnections.mockReset();
    listConnections.mockResolvedValue([{ id: "resend-connection" }]);
    resetEmailProviderCacheForTests();
  });

  it("reports a confirmed provider send", async () => {
    proxy.mockResolvedValue(new Response(JSON.stringify({ id: "email-1" }), { status: 200 }));
    await expect(sendTemplateEmail("team-invite", "guest@example.com", {
      templateData: { eventName: "Launch Party", inviterName: "Avery", eventUrl: "https://example.com/events" },
      idempotencyKey: "invite-1",
    })).resolves.toEqual({ sent: true });
    expect(proxy).toHaveBeenCalledWith("resend", "/emails", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Idempotency-Key": "invite-1" }),
    }));
  });

  it("does not report delivery when the provider is unavailable", async () => {
    listConnections.mockResolvedValue([]);
    await expect(sendTemplateEmail("ticket-confirmation", "guest@example.com", {
      templateData: {},
    })).resolves.toEqual({ sent: false, reason: "provider_disabled" });
    expect(proxy).not.toHaveBeenCalled();
  });

  it.each([429, 500, 503])("rejects retryable provider status %s", async (status) => {
    proxy.mockResolvedValue(new Response("Try again", { status }));
    await expect(sendTemplateEmail("ticket-confirmation", "guest@example.com", {
      templateData: {},
    })).rejects.toThrow(`Email provider rejected the message (${status})`);
  });

  it("does not write recipient data from provider failures to logs", async () => {
    const email = "private.guest@example.com";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    proxy.mockResolvedValue(new Response(`Rejected recipient ${email}`, { status: 422 }));

    await expect(sendTemplateEmail("ticket-confirmation", email, {
      templateData: {},
    })).rejects.toThrow("Email provider rejected the message (422)");

    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(email);
  });

  it("rejects network failures so schedulers can retry", async () => {
    proxy.mockRejectedValue(new Error("Network unavailable"));
    await expect(sendTemplateEmail("ticket-confirmation", "guest@example.com", {
      templateData: {},
    })).rejects.toThrow("Network unavailable");
  });
});