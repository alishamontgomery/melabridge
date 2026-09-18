import { beforeEach, describe, expect, it, vi } from "vitest";

const sendTemplateEmail = vi.fn();
vi.mock("@/lib/email-templates/send-email", () => ({
  sendTemplateEmail: (...args: unknown[]) => sendTemplateEmail(...args),
}));

import { dispatchNotification } from "./notification-delivery.server";

let serviceClient: ReturnType<typeof client>;
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() { return serviceClient; },
}));

function client(pref: { in_app_enabled: boolean; email_enabled: boolean; frequency: string } | null) {
  const inserted: unknown[] = [];
  return {
    inserted,
    from(table: string) {
      if (table === "notification_preferences") {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({ data: pref, error: null }),
        };
        return chain;
      }
      if (table === "notifications") {
        return { insert: async (row: unknown) => { inserted.push(row); return { error: null }; } };
      }
      if (table === "profiles") {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({ data: { email: "owner@example.com", display_name: "Owner" }, error: null }),
        };
        return chain;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("dispatchNotification", () => {
  beforeEach(() => sendTemplateEmail.mockReset().mockResolvedValue({ sent: true }));

  it("does not deliver through disabled channels", async () => {
    serviceClient = client({ in_app_enabled: false, email_enabled: false, frequency: "instant" });
    await expect(dispatchNotification({
      userId: "user-1", category: "booking", title: "New inquiry", body: "Details",
    })).resolves.toEqual({ inApp: false, email: false, errors: [] });
    expect(serviceClient.inserted).toHaveLength(0);
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });

  it("delivers enabled instant in-app and email notifications", async () => {
    serviceClient = client({ in_app_enabled: true, email_enabled: true, frequency: "instant" });
    await expect(dispatchNotification({
      userId: "user-1", category: "calendar", title: "Booking approved", body: "Confirmed",
      href: "/calendar", idempotencyKey: "calendar:1",
    })).resolves.toEqual({ inApp: true, email: true, errors: [] });
    expect(serviceClient.inserted).toHaveLength(1);
    expect(sendTemplateEmail).toHaveBeenCalledWith(
      "account-notification",
      "owner@example.com",
      expect.objectContaining({ idempotencyKey: "calendar:1" }),
    );
  });

  it("does not send scheduled-frequency email immediately", async () => {
    serviceClient = client({ in_app_enabled: true, email_enabled: true, frequency: "weekly" });
    await dispatchNotification({
      userId: "user-1", category: "event_updates", title: "Update", body: "Details",
    });
    expect(serviceClient.inserted).toHaveLength(1);
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });

  it("still sends email when the in-app channel fails", async () => {
    serviceClient = client({ in_app_enabled: true, email_enabled: true, frequency: "instant" });
    serviceClient.from = ((original) => (table: string) => {
      if (table === "notifications") {
        return { insert: async () => ({ error: { message: "RLS" } }) };
      }
      return original(table);
    })(serviceClient.from.bind(serviceClient));
    await expect(dispatchNotification({
      userId: "recipient-other-than-caller",
      category: "booking",
      title: "New inquiry",
      body: "Details",
    })).resolves.toEqual({ inApp: false, email: true, errors: ["in_app_failed"] });
    expect(sendTemplateEmail).toHaveBeenCalledOnce();
  });
});
