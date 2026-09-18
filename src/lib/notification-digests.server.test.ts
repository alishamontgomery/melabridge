import { beforeEach, describe, expect, it, vi } from "vitest";

const sendTemplateEmail = vi.fn();
vi.mock("@/lib/email-templates/send-email", () => ({
  sendTemplateEmail: (...args: unknown[]) => sendTemplateEmail(...args),
}));

import { processWeeklyEventDigests } from "./notification-digests.server";

function client(preference?: {
  in_app_enabled: boolean;
  email_enabled: boolean;
  frequency: string;
}) {
  const notifications: unknown[] = [];
  const claims: Array<{ period_key: string }> = [];
  return {
    notifications,
    claims,
    from(table: string) {
      if (table === "profiles") {
        return {
          select: async () => ({
            data: [{ id: "user-1", email: "owner@example.com", display_name: "Owner" }],
            error: null,
          }),
        };
      }
      if (table === "notification_preferences") {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          then: (resolve: (value: unknown) => unknown) => Promise.resolve({
            data: preference ? [{ user_id: "user-1", ...preference }] : [],
            error: null,
          }).then(resolve),
        };
        return chain;
      }
      if (table === "events") {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          neq: async () => ({
            data: [{ id: "event-1", name: "Wedding", event_date: "2026-10-01" }],
            error: null,
          }),
        };
        return chain;
      }
      if (table === "notification_digest_deliveries") {
        const deleteChain: any = { eq: () => deleteChain, then: (resolve: any) => Promise.resolve({ error: null }).then(resolve) };
        return {
          insert: async (row: { period_key: string }) => {
            if (claims.some((claim) => claim.period_key === row.period_key)) {
              return { error: { code: "23505" } };
            }
            claims.push(row);
            return { error: null };
          },
          delete: () => deleteChain,
        };
      }
      if (table === "notifications") {
        return {
          insert: async (row: unknown) => {
            notifications.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("processWeeklyEventDigests", () => {
  beforeEach(() => sendTemplateEmail.mockReset().mockResolvedValue({ sent: true }));

  it("only runs on Monday", async () => {
    const result = await processWeeklyEventDigests(client(), new Date("2026-09-22T12:00:00Z"));
    expect(result).toEqual({ eligible: 0, sent: 0, failed: 0 });
  });

  it("honors the displayed defaults when no preference row exists", async () => {
    const sb = client();
    const result = await processWeeklyEventDigests(sb, new Date("2026-09-21T12:00:00Z"));
    expect(result).toEqual({ eligible: 1, sent: 2, failed: 0 });
    expect(sb.notifications).toHaveLength(1);
    expect(sendTemplateEmail).toHaveBeenCalledOnce();
    expect(sb.claims.map((claim) => claim.period_key).sort()).toEqual([
      "2026-W39:email",
      "2026-W39:in_app",
    ]);
  });

  it("respects independently disabled in-app and email channels", async () => {
    const emailOnly = client({ in_app_enabled: false, email_enabled: true, frequency: "weekly" });
    await expect(processWeeklyEventDigests(emailOnly, new Date("2026-09-21T12:00:00Z")))
      .resolves.toEqual({ eligible: 1, sent: 1, failed: 0 });
    expect(emailOnly.notifications).toHaveLength(0);
    expect(sendTemplateEmail).toHaveBeenCalledOnce();

    sendTemplateEmail.mockClear();
    const inAppOnly = client({ in_app_enabled: true, email_enabled: false, frequency: "weekly" });
    await expect(processWeeklyEventDigests(inAppOnly, new Date("2026-09-21T12:00:00Z")))
      .resolves.toEqual({ eligible: 1, sent: 1, failed: 0 });
    expect(inAppOnly.notifications).toHaveLength(1);
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });

  it("deduplicates both channels across repeated scheduler runs", async () => {
    const sb = client();
    await processWeeklyEventDigests(sb, new Date("2026-09-21T12:00:00Z"));
    const second = await processWeeklyEventDigests(sb, new Date("2026-09-21T12:05:00Z"));
    expect(second).toEqual({ eligible: 1, sent: 0, failed: 0 });
    expect(sb.notifications).toHaveLength(1);
    expect(sendTemplateEmail).toHaveBeenCalledOnce();
  });
});