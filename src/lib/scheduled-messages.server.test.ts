/**
 * Targeted tests for the scheduled-message processor.
 *
 * Focus areas (the blockers this change fixes):
 *   1. A communication must NOT be marked 'sent' when a required recipient
 *      email delivery fails (false-sent). It must go 'retryable' instead.
 *   2. Overlapping / stale cron runs must never double-send: every status
 *      transition is guarded by BOTH id AND locked_at (the lease token), so a
 *      stale worker whose lease expired cannot overwrite a reclaimed row.
 *   3. 'sent' is committed immediately after all required emails succeed and
 *      BEFORE the optional in-app notifications, so a notification failure is
 *      non-critical and a retry can never duplicate already-delivered work.
 *
 * Run: npx vitest run \
 *        --config src/lib/scheduled-messages.server.vitest.config.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock the email module (server-only, network) ---------------------------
const sendTemplateEmail = vi.fn();
vi.mock("@/lib/email-templates/send-email", () => ({
  sendTemplateEmail: (...args: any[]) => sendTemplateEmail(...args),
}));

// --- Fake Supabase admin client --------------------------------------------
// Records update() payloads + filters and the relative order of key DB writes
// so tests can assert final status, lock-token guards, and ordering.

type UpdateCall = { patch: Record<string, any>; filters: Record<string, any> };

function makeFakeClient(opts: {
  recipients: Array<{ email: string; name: string | null }>;
  claimed: any[];
  /** profiles matched by email for the in-app notification step. */
  notifyProfiles?: Array<{ id: string }>;
  /** Force the notification-profile lookup to error. */
  notifyLookupError?: boolean;
  /** Force the notifications.insert to error. */
  notifyInsertError?: boolean;
  /** Force the event_communications.update (mark-sent / record-failure) to error. */
  commUpdateError?: boolean;
}) {
  const updates: Record<string, UpdateCall[]> = {};
  const order: string[] = []; // sequence of significant writes

  function tableUpdate(table: string) {
    return (patch: Record<string, any>) => {
      const call: UpdateCall = { patch, filters: {} };
      const chain: any = {
        eq(col: string, val: any) {
          call.filters[col] = val;
          return chain;
        },
        then(resolve: any) {
          (updates[table] ??= []).push(call);
          order.push(`update:${table}:${patch.status}`);
          return Promise.resolve({
            error: opts.commUpdateError ? { message: "db down" } : null,
          }).then(resolve);
        },
      };
      return chain;
    };
  }

  const sb: any = {
    rpc: vi.fn(async () => ({ data: opts.claimed, error: null })),
    from(table: string) {
      if (table === "events") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "ev1", name: "Test Event", owner_id: "org1" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            // organizer display-name lookup
            eq: () => ({
              maybeSingle: async () => ({
                data: { display_name: "Alice", email: "alice@example.com" },
                error: null,
              }),
            }),
            // notification recipient lookup (by email list)
            in: async () => {
              order.push("select:notify-profiles");
              return opts.notifyLookupError
                ? { data: null, error: { message: "lookup fail" } }
                : { data: opts.notifyProfiles ?? [], error: null };
            },
          }),
        };
      }
      if (table === "guests") {
        const q: any = {
          select: () => q,
          eq: () => q,
          is: () => q,
          not: () => q,
          then: (resolve: any) =>
            Promise.resolve({ data: opts.recipients, error: null }).then(resolve),
        };
        return q;
      }
      if (table === "notifications") {
        return {
          insert: async () => {
            order.push("insert:notifications");
            return { error: opts.notifyInsertError ? { message: "insert fail" } : null };
          },
        };
      }
      if (table === "event_communications") {
        return { update: tableUpdate("event_communications") };
      }
      return { select: () => ({}) };
    },
    __updates: updates,
    __order: order,
  };
  return sb;
}

// Stub the service client module the processor dynamically imports.
let fakeClient: any;
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return fakeClient;
  },
}));

const LOCK = "2026-08-19T03:00:00.000Z"; // the lease token stamped at claim time

const baseComm = {
  id: "comm1",
  event_id: "ev1",
  organizer_id: "org1",
  subject: "Hi",
  body: "Body",
  recipient_group: "all_guests",
  scheduled_for: new Date().toISOString(),
  attempts: 1,
  locked_at: LOCK,
};

describe("processScheduledMessages", () => {
  beforeEach(() => {
    sendTemplateEmail.mockReset();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.service_role = "svc";
  });

  it("marks 'sent' only when all deliveries succeed or are suppressed, guarded by (id, locked_at)", async () => {
    fakeClient = makeFakeClient({
      recipients: [
        { email: "a@example.com", name: "A" },
        { email: "b@example.com", name: "B" },
      ],
      claimed: [{ ...baseComm }],
    });
    // One delivered, one suppressed — both are acceptable outcomes.
    sendTemplateEmail
      .mockResolvedValueOnce({ sent: true })
      .mockResolvedValueOnce({ sent: false, reason: "recipient_suppressed" });

    const { processScheduledMessages } = await import("./scheduled-messages.server");
    const res = await processScheduledMessages();

    expect(res).toEqual({ processed: 1, sent: 1, failed: 0 });
    const upd = fakeClient.__updates.event_communications;
    expect(upd).toHaveLength(1);
    expect(upd[0].patch.status).toBe("sent");
    // Guard: keyed by BOTH id and the lease token, never by status.
    expect(upd[0].filters.id).toBe("comm1");
    expect(upd[0].filters.locked_at).toBe(LOCK);
    expect(upd[0].filters.status).toBeUndefined();
  });

  it("commits 'sent' BEFORE the optional in-app notifications", async () => {
    fakeClient = makeFakeClient({
      recipients: [{ email: "a@example.com", name: "A" }],
      claimed: [{ ...baseComm }],
      notifyProfiles: [{ id: "user1" }],
    });
    sendTemplateEmail.mockResolvedValue({ sent: true });

    const { processScheduledMessages } = await import("./scheduled-messages.server");
    await processScheduledMessages();

    const order: string[] = fakeClient.__order;
    const sentIdx = order.indexOf("update:event_communications:sent");
    const lookupIdx = order.indexOf("select:notify-profiles");
    const insertIdx = order.indexOf("insert:notifications");
    expect(sentIdx).toBeGreaterThanOrEqual(0);
    expect(insertIdx).toBeGreaterThanOrEqual(0);
    expect(sentIdx).toBeLessThan(lookupIdx);
    expect(sentIdx).toBeLessThan(insertIdx);
  });

  it("treats optional notification failures as non-critical (still 'sent', still succeeds)", async () => {
    fakeClient = makeFakeClient({
      recipients: [{ email: "a@example.com", name: "A" }],
      claimed: [{ ...baseComm }],
      notifyProfiles: [{ id: "user1" }],
      notifyInsertError: true, // notification insert blows up AFTER emails/sent
    });
    sendTemplateEmail.mockResolvedValue({ sent: true });

    const { processScheduledMessages } = await import("./scheduled-messages.server");
    const res = await processScheduledMessages();

    // Emails delivered + row committed 'sent' => success despite notify failure.
    expect(res).toEqual({ processed: 1, sent: 1, failed: 0 });
    const upd = fakeClient.__updates.event_communications;
    expect(upd).toHaveLength(1); // exactly one transition — no retryable/failed follow-up
    expect(upd[0].patch.status).toBe("sent");
  });

  it("treats a notification-lookup failure as non-critical too", async () => {
    fakeClient = makeFakeClient({
      recipients: [{ email: "a@example.com", name: "A" }],
      claimed: [{ ...baseComm }],
      notifyLookupError: true,
    });
    sendTemplateEmail.mockResolvedValue({ sent: true });

    const { processScheduledMessages } = await import("./scheduled-messages.server");
    const res = await processScheduledMessages();

    expect(res).toEqual({ processed: 1, sent: 1, failed: 0 });
    expect(fakeClient.__updates.event_communications[0].patch.status).toBe("sent");
  });

  it("does NOT mark 'sent' when a required email delivery fails (retryable, guarded by lock token)", async () => {
    fakeClient = makeFakeClient({
      recipients: [
        { email: "a@example.com", name: "A" },
        { email: "b@example.com", name: "B" },
      ],
      claimed: [{ ...baseComm, attempts: 1 }],
    });
    sendTemplateEmail
      .mockResolvedValueOnce({ sent: true })
      .mockRejectedValueOnce(new Error("SMTP 500")); // real delivery failure

    const { processScheduledMessages } = await import("./scheduled-messages.server");
    const res = await processScheduledMessages();

    expect(res).toEqual({ processed: 1, sent: 0, failed: 1 });
    const upd = fakeClient.__updates.event_communications;
    expect(upd).toHaveLength(1);
    // Must be retryable, NOT sent, guarded by lock token, PII-free error + backoff.
    expect(upd[0].patch.status).toBe("retryable");
    expect(upd[0].filters.id).toBe("comm1");
    expect(upd[0].filters.locked_at).toBe(LOCK);
    expect(String(upd[0].patch.last_error)).toMatch(/^email_delivery_failed:/);
    expect(String(upd[0].patch.last_error)).not.toContain("@");
    expect(upd[0].patch.next_attempt_at).toBeTruthy();
  });

  it("parks the row as 'failed' once attempts are exhausted (still lock-guarded)", async () => {
    fakeClient = makeFakeClient({
      recipients: [{ email: "a@example.com", name: "A" }],
      claimed: [{ ...baseComm, attempts: 5 }], // == MAX_ATTEMPTS
    });
    sendTemplateEmail.mockRejectedValueOnce(new Error("SMTP 500"));

    const { processScheduledMessages } = await import("./scheduled-messages.server");
    const res = await processScheduledMessages();

    expect(res.failed).toBe(1);
    const upd = fakeClient.__updates.event_communications;
    expect(upd[0].patch.status).toBe("failed");
    expect(upd[0].filters.locked_at).toBe(LOCK);
    expect(upd[0].patch.next_attempt_at).toBeNull();
  });

  it("does NOT retry when the mark-sent write fails after emails already delivered", async () => {
    // A DB failure on the 'sent' write must not throw/retry, or emails duplicate.
    fakeClient = makeFakeClient({
      recipients: [{ email: "a@example.com", name: "A" }],
      claimed: [{ ...baseComm }],
      commUpdateError: true,
    });
    sendTemplateEmail.mockResolvedValue({ sent: true });

    const { processScheduledMessages } = await import("./scheduled-messages.server");
    const res = await processScheduledMessages();

    // Worker still reports success (emails delivered); no retryable/failed write.
    expect(res).toEqual({ processed: 1, sent: 1, failed: 0 });
    const upd = fakeClient.__updates.event_communications;
    expect(upd).toHaveLength(1); // only the (failing) sent write, no retry follow-up
    expect(upd[0].patch.status).toBe("sent");
  });

  it("preserves zero-pending behavior when nothing is claimed", async () => {
    fakeClient = makeFakeClient({ recipients: [], claimed: [] });

    const { processScheduledMessages } = await import("./scheduled-messages.server");
    const res = await processScheduledMessages();

    expect(res).toEqual({ processed: 0, sent: 0, failed: 0 });
    expect(fakeClient.__updates.event_communications).toBeUndefined();
  });

  it("passes a bounded batch size and lease to the claim RPC", async () => {
    fakeClient = makeFakeClient({ recipients: [], claimed: [] });

    const { processScheduledMessages } = await import("./scheduled-messages.server");
    await processScheduledMessages();

    expect(fakeClient.rpc).toHaveBeenCalledWith(
      "claim_scheduled_communications",
      expect.objectContaining({ _batch_size: 50, _lease_seconds: 600 }),
    );
  });
});
