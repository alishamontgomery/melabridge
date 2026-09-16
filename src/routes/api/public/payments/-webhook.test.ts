import { describe, it, expect, vi } from "vitest";
import { dispatch, handleInvoicePaymentFailed, processEvent, RetryableWebhookError } from "./webhook";

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
  it("routes invoice.payment_failed events through the webhook dispatcher", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const secondEq = vi.fn(() => ({ eq }));
    const update = vi.fn(() => ({ eq: secondEq }));
    const from = vi.fn(() => ({ update }));

    await dispatch(
      {
        id: "evt_invoice_failed",
        type: "invoice.payment_failed",
        data: { object: { parent: { subscription_details: { subscription: "sub_routed" } } } },
      },
      "sandbox",
      { from },
    );

    expect(secondEq).toHaveBeenCalledWith("stripe_subscription_id", "sub_routed");
    expect(eq).toHaveBeenCalledWith("environment", "sandbox");
  });

  it("marks the matching subscription past due for current Stripe invoice payloads", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const secondEq = vi.fn(() => ({ eq }));
    const update = vi.fn(() => ({ eq: secondEq }));
    const from = vi.fn(() => ({ update }));

    await handleInvoicePaymentFailed(
      { parent: { subscription_details: { subscription: "sub_failed" } } },
      "sandbox",
      { from },
    );

    expect(from).toHaveBeenCalledWith("subscriptions");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "past_due" }));
    expect(secondEq).toHaveBeenCalledWith("stripe_subscription_id", "sub_failed");
    expect(eq).toHaveBeenCalledWith("environment", "sandbox");
  });

  it("supports legacy invoice payloads and retries database failures", async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: "database unavailable" } });
    const client = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ eq })),
        })),
      })),
    };

    await expect(
      handleInvoicePaymentFailed({ subscription: "sub_legacy" }, "live", client),
    ).rejects.toBeInstanceOf(RetryableWebhookError);
  });
});
