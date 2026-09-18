import { describe, it, expect, vi } from "vitest";
import {
  dispatch,
  handleDeleted,
  handleInvoicePaymentFailed,
  processEvent,
  RetryableWebhookError,
  upsertSubscription,
} from "./webhook";

// ---------------------------------------------------------------------------
// The idempotency ledger is a state machine driven by three RPCs:
//   claim_stripe_event    -> { outcome: 'claimed'|'completed'|'processing', lease_token }
//   complete_stripe_event -> boolean (true only if caller still holds the lease)
//   release_stripe_event  -> boolean (true only if caller released its own claim)
//
// These tests inject a fake Supabase whose `.rpc()` is programmable per call, so
// we can exercise the completed-duplicate, active-claim, stale-reclaim, failed
// completion, and retryable-release paths in isolation from real dispatch.
// ---------------------------------------------------------------------------
type RpcResult = { data?: any; error?: { message: string } | null };

function makeSupabase(handlers: Record<string, (args: any) => RpcResult>) {
  const calls: Array<{ fn: string; args: any }> = [];
  const client = {
    rpc(fn: string, args: any) {
      calls.push({ fn, args });
      const h = handlers[fn];
      if (!h) throw new Error(`unexpected rpc: ${fn}`);
      const { data = null, error = null } = h(args);
      return Promise.resolve({ data, error });
    },
  };
  return { client, calls };
}

const LEASE = "11111111-1111-1111-1111-111111111111";

const EVENT = {
  id: "evt_test_123",
  type: "checkout.session.completed",
  data: { object: { metadata: { orderId: "ord_1" } } },
};

describe("processEvent idempotency state machine", () => {
  it("completed event is a duplicate 200 no-op (no dispatch)", async () => {
    const { client, calls } = makeSupabase({
      claim_stripe_event: () => ({ data: [{ outcome: "completed", lease_token: null }] }),
    });
    const dispatch = vi.fn();

    const outcome = await processEvent(EVENT as any, "sandbox", client, dispatch);

    expect(outcome).toBe("duplicate");
    expect(dispatch).not.toHaveBeenCalled();
    // Only the claim ran — no complete/release.
    expect(calls.map((c) => c.fn)).toEqual(["claim_stripe_event"]);
  });

  it("active processing claim is retryable non-2xx (never 200)", async () => {
    const { client, calls } = makeSupabase({
      claim_stripe_event: () => ({ data: [{ outcome: "processing", lease_token: null }] }),
    });
    const dispatch = vi.fn();

    await expect(processEvent(EVENT as any, "live", client, dispatch)).rejects.toBeInstanceOf(
      RetryableWebhookError,
    );
    expect(dispatch).not.toHaveBeenCalled();
    expect(calls.map((c) => c.fn)).toEqual(["claim_stripe_event"]);
  });

  it("claimed (fresh or reclaimed) dispatches once and marks completed with its lease", async () => {
    const { client, calls } = makeSupabase({
      claim_stripe_event: () => ({ data: [{ outcome: "claimed", lease_token: LEASE }] }),
      complete_stripe_event: (args) => {
        expect(args._lease_token).toBe(LEASE);
        return { data: true };
      },
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const outcome = await processEvent(EVENT as any, "sandbox", client, dispatch);

    expect(outcome).toBe("processed");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.fn)).toEqual(["claim_stripe_event", "complete_stripe_event"]);
  });

  it("stale reclaim race: only the lease holder completes; the loser gets 'processing' and never dispatches", async () => {
    // Model two concurrent workers hitting claim_stripe_event: the DB grants the
    // lease to exactly one (worker A -> 'claimed'); the other observes the live
    // (reclaimed) lease (worker B -> 'processing').
    let grants = 0;
    const claim = () => {
      grants += 1;
      return grants === 1
        ? ({ data: [{ outcome: "claimed", lease_token: LEASE }] } as RpcResult)
        : ({ data: [{ outcome: "processing", lease_token: null }] } as RpcResult);
    };
    const { client } = makeSupabase({
      claim_stripe_event: claim,
      complete_stripe_event: () => ({ data: true }),
    });

    const dispatchA = vi.fn().mockResolvedValue(undefined);
    const dispatchB = vi.fn().mockResolvedValue(undefined);

    const [rA, rB] = await Promise.allSettled([
      processEvent(EVENT as any, "sandbox", client, dispatchA),
      processEvent(EVENT as any, "sandbox", client, dispatchB),
    ]);

    // Exactly one worker processed; the other was rejected as retryable.
    const fulfilled = [rA, rB].filter((r) => r.status === "fulfilled");
    const rejected = [rA, rB].filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((fulfilled[0] as PromiseFulfilledResult<string>).value).toBe("processed");
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(RetryableWebhookError);
    // Total dispatch invocations across both workers is exactly one.
    expect(dispatchA.mock.calls.length + dispatchB.mock.calls.length).toBe(1);
  });

  it("completion failure (lease lost / rpc error) is retryable so Stripe retries", async () => {
    // complete returns false => our lease was reclaimed before we recorded it.
    const { client, calls } = makeSupabase({
      claim_stripe_event: () => ({ data: [{ outcome: "claimed", lease_token: LEASE }] }),
      complete_stripe_event: () => ({ data: false }),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    await expect(processEvent(EVENT as any, "sandbox", client, dispatch)).rejects.toBeInstanceOf(
      RetryableWebhookError,
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.fn)).toEqual(["claim_stripe_event", "complete_stripe_event"]);
  });

  it("retryable dispatch failure releases only the current claim and rethrows", async () => {
    const { client, calls } = makeSupabase({
      claim_stripe_event: () => ({ data: [{ outcome: "claimed", lease_token: LEASE }] }),
      release_stripe_event: (args) => {
        expect(args._lease_token).toBe(LEASE);
        return { data: true };
      },
    });
    const dispatch = vi.fn().mockRejectedValue(new RetryableWebhookError("finalize RPC failed"));

    await expect(processEvent(EVENT as any, "sandbox", client, dispatch)).rejects.toBeInstanceOf(
      RetryableWebhookError,
    );
    // Released via lease-guarded RPC; never completed.
    expect(calls.map((c) => c.fn)).toEqual(["claim_stripe_event", "release_stripe_event"]);
  });

  it("unexpected dispatch error releases the claim and becomes retryable", async () => {
    const { client, calls } = makeSupabase({
      claim_stripe_event: () => ({ data: [{ outcome: "claimed", lease_token: LEASE }] }),
      release_stripe_event: () => ({ data: true }),
    });
    const dispatch = vi.fn().mockRejectedValue(new Error("programmer bug"));

    await expect(processEvent(EVENT as any, "sandbox", client, dispatch)).rejects.toBeInstanceOf(
      RetryableWebhookError,
    );
    expect(calls.map((c) => c.fn)).toEqual(["claim_stripe_event", "release_stripe_event"]);
  });

  it("claim rpc error is retryable and skips dispatch", async () => {
    const { client } = makeSupabase({
      claim_stripe_event: () => ({ error: { message: "deadlock detected" } }),
    });
    const dispatch = vi.fn();

    await expect(processEvent(EVENT as any, "sandbox", client, dispatch)).rejects.toBeInstanceOf(
      RetryableWebhookError,
    );
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("subscription payment failures", () => {
  function query(result: any) {
    const builder: any = {};
    for (const method of ["select", "update", "upsert", "eq", "neq", "in", "is"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.maybeSingle = vi.fn().mockResolvedValue(result);
    builder.then = (resolve: (value: any) => void, reject: (reason: any) => void) =>
      Promise.resolve(result).then(resolve, reject);
    return builder;
  }

  it("routes invoice.payment_failed events through the webhook dispatcher", async () => {
    const existing = query({ data: { status: "past_due" }, error: null });
    const from = vi.fn(() => existing);
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await dispatch(
      {
        id: "evt_invoice_failed",
        type: "invoice.payment_failed",
        data: { object: { parent: { subscription_details: { subscription: "sub_routed" } } } },
      },
      "sandbox",
      { from, rpc },
    );

    expect(existing.eq).toHaveBeenCalledWith("stripe_subscription_id", "sub_routed");
    expect(existing.eq).toHaveBeenCalledWith("environment", "sandbox");
  });

  it("stores past-due status before enqueueing one admin alert", async () => {
    const existing = query({ data: { status: "active" }, error: null });
    const from = vi.fn(() => existing);
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const client = { from, rpc };

    await handleInvoicePaymentFailed(
      { parent: { subscription_details: { subscription: "sub_failed" } } },
      "sandbox",
      client,
      "evt_failed",
      200,
    );

    expect(rpc).toHaveBeenCalledWith("sync_subscription_status_event", expect.objectContaining({
      _status: "past_due",
      _event_created_at: 200,
      _event_priority: 1,
    }));
  });

  it("retries the idempotent alert enqueue when status is already past due", async () => {
    const existing = query({ data: { status: "past_due" }, error: null });
    const from = vi.fn(() => existing);
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await handleInvoicePaymentFailed(
      { subscription: "sub_existing" },
      "live",
      { from, rpc },
      "evt_duplicate",
      200,
    );

    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("retries when the atomic state-and-alert transaction fails", async () => {
    const existing = query({ data: { user_id: "user_1", status: "active" }, error: null });
    const from = vi.fn(() => existing);
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "transaction rolled back" } });

    await expect(handleInvoicePaymentFailed(
      { subscription: "sub_failed" },
      "live",
      { from, rpc },
      "evt_failed",
      200,
    )).rejects.toBeInstanceOf(RetryableWebhookError);

    expect(rpc).toHaveBeenCalledWith("sync_subscription_status_event", expect.objectContaining({
      _status: "past_due",
    }));
  });

  it("supports legacy invoice payloads and retries database failures", async () => {
    const failedRead = query({ data: null, error: { message: "database unavailable" } });
    const client = { from: vi.fn(() => failedRead) };

    await expect(
      handleInvoicePaymentFailed({ subscription: "sub_legacy" }, "live", client),
    ).rejects.toBeInstanceOf(RetryableWebhookError);
  });

  it("stores and enqueues a customer.subscription.updated past-due transition", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const profile = query({ data: { email: "user@example.com" }, error: null });
    const from = vi.fn(() => profile);

    await upsertSubscription({
      id: "sub_updated",
      customer: "cus_updated",
      status: "past_due",
      metadata: { userId: "user_updated" },
      items: { data: [{ price: { lookup_key: "planner_professional", product: "prod_1" } }] },
    }, "live", "evt_updated", { rpc, from }, 200);

    expect(rpc).toHaveBeenCalledWith("sync_subscription_stripe_event", expect.objectContaining({
      _status: "past_due",
      _event_created_at: 200,
      _event_priority: 2,
      _user_email: "user@example.com",
    }));
  });

  it("retries when an atomic subscription update and alert transaction fails", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "transaction rolled back" } });
    const profile = query({ data: null, error: null });

    await expect(upsertSubscription({
      id: "sub_updated",
      customer: "cus_updated",
      status: "past_due",
      metadata: { userId: "user_updated" },
      items: { data: [{ price: { lookup_key: "planner_professional", product: "prod_1" } }] },
    }, "live", "evt_updated", { rpc, from: vi.fn(() => profile) }, 200))
      .rejects.toBeInstanceOf(RetryableWebhookError);

    expect(rpc).toHaveBeenCalledWith("sync_subscription_stripe_event", expect.objectContaining({
      _status: "past_due",
    }));
  });

  it("resolves an open alert when Stripe deletes the subscription", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await handleDeleted({ id: "sub_canceled" }, "live", { rpc }, 300, "evt_deleted");

    expect(rpc).toHaveBeenCalledWith("sync_subscription_status_event", expect.objectContaining({
      _status: "canceled",
      _event_created_at: 300,
      _event_priority: 3,
      _event_id: "evt_deleted",
    }));
  });

  it("does not reopen past due after a newer recovery event", async () => {
    const existing = query({ data: { user_id: "user_1", status: "active" }, error: null });
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });

    await handleInvoicePaymentFailed(
      { subscription: "sub_recovered" },
      "live",
      { from: vi.fn(() => existing), rpc },
      "evt_old_failure",
      100,
    );

    expect(rpc).toHaveBeenCalledWith("sync_subscription_status_event", expect.objectContaining({
      _event_created_at: 100,
    }));
  });
});
