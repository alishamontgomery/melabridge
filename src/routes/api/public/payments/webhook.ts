import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

// A verified Stripe event. `verifyWebhook` returns the parsed JSON body, which
// always carries `id`/`type`; we widen the type here so we can key idempotency
// off the event id without touching stripe.server.ts.
type StripeEvent = { id: string; type: string; data: { object: any } };

// Thrown to signal a *retryable* failure. The POST handler maps this to a
// non-2xx response so Stripe re-delivers the event. Duplicate/no-op outcomes
// must NOT throw this — they return normally so we answer 200.
export class RetryableWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableWebhookError";
  }
}

let _supabaseAdmin: any = null;
async function getSupabase(): Promise<any> {
  if (!_supabaseAdmin) {
    const mod = await import("@/integrations/supabase/client.server");
    _supabaseAdmin = mod.supabaseAdmin;
  }
  return _supabaseAdmin;
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    throw new RetryableWebhookError("subscription metadata is missing a user reference");
  }
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key
    // Retain legacy subscription records created before direct Stripe access.
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  const sb = await getSupabase();
  const { error } = await sb.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) throw new RetryableWebhookError(`subscription upsert failed: ${error.message}`);
}

async function handleDeleted(subscription: any, env: StripeEnv) {
  const sb = await getSupabase();
  const { error } = await sb
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
  if (error) throw new RetryableWebhookError(`subscription delete failed: ${error.message}`);
}

function invoiceSubscriptionId(invoice: any): string | null {
  const subscription = invoice?.parent?.subscription_details?.subscription ?? invoice?.subscription;
  if (typeof subscription === "string") return subscription;
  return typeof subscription?.id === "string" ? subscription.id : null;
}

export async function handleInvoicePaymentFailed(
  invoice: any,
  env: StripeEnv,
  sb: any = null,
) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const client = sb ?? await getSupabase();
  const { error } = await client
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId)
    .eq("environment", env);
  if (error) throw new RetryableWebhookError(`subscription payment failure update failed: ${error.message}`);
}

// -------- Ticketing --------
async function finalizeTicketOrderFromSession(session: any) {
  const orderId = session?.metadata?.orderId;
  if (!orderId) return;
  const sb = await getSupabase();
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;

  // Single transactional claim + finalize. The RPC row-locks the order and,
  // on the winning claim, flips status->paid, inserts attendees and bumps
  // sold_count atomically — so paid/order/inventory state can never diverge.
  // A DB/RPC error here is retryable: nothing was committed, so we throw and
  // let Stripe redeliver.
  const { data, error } = await sb.rpc("finalize_paid_ticket_order", {
    _order_id: orderId,
    _payment_intent: pi,
  });
  if (error) {
    throw new RetryableWebhookError(`finalize_paid_ticket_order failed: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : data;
  // Order was already finalized (duplicate delivery / confirm-page race) — no-op.
  if (!result || result.claimed !== true) return;

  const eventId: string = result.event_id;

  // ---- Post-commit, non-critical side effects ----
  // The order is already paid and consistent. Email + milestone failures must be
  // logged (without PII) and must NOT corrupt paid/order/inventory state or cause
  // a Stripe retry, so they are swallowed here.
  try {
    const { sendOrderConfirmation } = await import("@/lib/tickets-emails.server");
    await sendOrderConfirmation({ orderId });
  } catch (e) {
    console.error("[webhook] order confirmation email failed for order (post-commit, non-critical):", errMsg(e));
  }

  try {
    const { checkAndFireTicketMilestones } = await import("@/lib/ticket-notifications.server");
    await checkAndFireTicketMilestones(eventId);
  } catch (e) {
    console.error("[webhook] milestone notification failed (post-commit, non-critical):", errMsg(e));
  }
}

async function expireTicketOrderFromSession(session: any) {
  const orderId = session?.metadata?.orderId;
  if (!orderId) return;
  const sb = await getSupabase();
  const { error } = await sb.from("ticket_orders")
    .update({ status: "expired", failure_reason: "Checkout expired" })
    .eq("id", orderId).eq("status", "pending");
  if (error) throw new RetryableWebhookError(`expire order failed: ${error.message}`);
}

async function failTicketOrderFromPI(pi: any) {
  const sb = await getSupabase();
  const reason = pi?.last_payment_error?.message ?? "Payment failed";
  const { data: updated, error } = await sb.from("ticket_orders")
    .update({ status: "failed", failure_reason: reason })
    .eq("stripe_payment_intent", pi.id)
    .eq("status", "pending")
    .select("id, event_id, buyer_name, amount_cents, currency");
  if (error) throw new RetryableWebhookError(`fail order update failed: ${error.message}`);
  if (!updated?.length) return;
  try {
    const { insertExceptionAlert } = await import("@/lib/ticket-notifications.server");
    await insertExceptionAlert({
      eventId: updated[0].event_id,
      type: "payment_failure",
      amountCents: updated[0].amount_cents ?? (pi.amount ?? 0),
      buyerName: updated[0].buyer_name ?? "buyer",
      currency: updated[0].currency ?? pi.currency ?? "usd",
    });
  } catch (e) {
    console.error("[webhook] payment_failed exception alert failed (post-commit, non-critical):", errMsg(e));
  }
}

async function refundTicketOrderFromCharge(charge: any) {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!pi) return;
  const sb = await getSupabase();
  const { data: order, error: readErr } = await sb
    .from("ticket_orders")
    .select("id, event_id, amount_cents, refund_amount_cents, buyer_name, currency, status")
    .eq("stripe_payment_intent", pi).maybeSingle();
  if (readErr) throw new RetryableWebhookError(`refund order read failed: ${readErr.message}`);
  if (!order) return;

  const refunded = charge.amount_refunded ?? 0;
  const already = order.refund_amount_cents ?? 0;
  // Idempotent: Stripe redelivers charge.refunded with the same cumulative total.
  if (refunded <= already) return;
  if (order.status !== "paid" && order.status !== "partially_refunded") return;

  const refundDelta = refunded - already;

  // Transactional refund apply: updates refund state and, on full refund,
  // decrements inventory + clears non-checked-in attendees in one transaction.
  const { error: rpcErr } = await sb.rpc("apply_ticket_refund", {
    _order_id: order.id,
    _refund_delta_cents: refundDelta,
    _reason: "Stripe refund",
  });
  if (rpcErr) throw new RetryableWebhookError(`apply_ticket_refund failed: ${rpcErr.message}`);

  // Exception alert — post-commit, non-critical.
  try {
    const { insertExceptionAlert } = await import("@/lib/ticket-notifications.server");
    await insertExceptionAlert({
      eventId: order.event_id,
      type: "refund",
      amountCents: refundDelta,
      buyerName: order.buyer_name ?? "buyer",
      currency: charge.currency ?? order.currency ?? "usd",
    });
  } catch (e) {
    console.error("[webhook] refund exception alert failed (post-commit, non-critical):", errMsg(e));
  }
}

async function handleDisputeCreated(dispute: any) {
  // dispute.payment_intent is populated when the underlying charge was created via PaymentIntent
  const pi = typeof dispute.payment_intent === "string" ? dispute.payment_intent : null;
  if (!pi) return;
  const sb = await getSupabase();
  const { data: order, error } = await sb
    .from("ticket_orders")
    .select("id, event_id, buyer_name, currency")
    .eq("stripe_payment_intent", pi)
    .maybeSingle();
  if (error) throw new RetryableWebhookError(`dispute order read failed: ${error.message}`);
  if (!order) return;
  try {
    const { insertExceptionAlert } = await import("@/lib/ticket-notifications.server");
    await insertExceptionAlert({
      eventId: order.event_id,
      type: "dispute",
      amountCents: dispute.amount ?? 0,
      buyerName: order.buyer_name ?? "buyer",
      currency: dispute.currency ?? order.currency ?? "usd",
    });
  } catch (e) {
    console.error("[webhook] dispute exception alert failed (post-commit, non-critical):", errMsg(e));
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function dispatch(event: StripeEvent, env: StripeEnv, sb: any = null) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleDeleted(event.data.object, env);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object, env, sb);
      break;
    case "checkout.session.completed":
      await finalizeTicketOrderFromSession(event.data.object);
      break;
    case "checkout.session.expired":
      await expireTicketOrderFromSession(event.data.object);
      break;
    case "payment_intent.payment_failed":
      await failTicketOrderFromPI(event.data.object);
      break;
    case "charge.refunded":
      await refundTicketOrderFromCharge(event.data.object);
      break;
    case "charge.dispute.created":
      await handleDisputeCreated(event.data.object);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

// Never log the raw Stripe event id/type together with, or near, customer PII.
// The event type alone is safe (no PII); the event id is a Stripe-internal
// opaque token but we keep logs minimal and omit it to avoid correlation risk.
function safeEventLabel(event: StripeEvent): string {
  return event.type;
}

/**
 * Core idempotency + processing pipeline, decoupled from the network/verify
 * boundary so it can be unit-tested with an injected Supabase client and a
 * pre-verified event. `handle` wires in the real client + verification.
 *
 * Idempotency uses an explicit processing/completed state machine with a lease
 * (see claim_stripe_event / complete_stripe_event / release_stripe_event):
 *   - completed  -> duplicate, respond 200.
 *   - processing (live lease elsewhere) -> retryable, respond non-2xx so Stripe
 *     keeps retrying (NEVER 200).
 *   - claimed    -> we own the lease; run side effects, then mark completed
 *     atomically. On retryable failure we release ONLY our own lease so the next
 *     redelivery re-processes. A crash before completion leaves a 'processing'
 *     row whose lease expires and is then reclaimed by a later delivery — no
 *     event can be permanently swallowed.
 *
 * @internal exported for tests only.
 */
export async function processEvent(
  event: StripeEvent,
  env: StripeEnv,
  sb: any,
  runDispatch: (event: StripeEvent, env: StripeEnv) => Promise<void> = dispatch,
): Promise<"duplicate" | "processed"> {
  // Acquire (or reclaim a stale) processing lease atomically in the DB.
  const { data: claimData, error: claimErr } = await sb.rpc("claim_stripe_event", {
    _event_id: event.id,
    _event_type: event.type,
    _environment: env,
  });
  if (claimErr) {
    // Could not evaluate the claim — retryable so we don't silently drop.
    throw new RetryableWebhookError(`idempotency claim failed: ${claimErr.message}`);
  }

  const claim = Array.isArray(claimData) ? claimData[0] : claimData;
  const outcome: string | undefined = claim?.outcome;

  if (outcome === "completed") {
    // Already finished by a prior delivery — safe no-op.
    console.log("[webhook] duplicate (completed) event ignored:", safeEventLabel(event));
    return "duplicate";
  }

  if (outcome === "processing") {
    // Another worker holds a live lease. Must NOT return 200 — force Stripe to
    // retry later, by which time the other worker has completed or its lease
    // expired (allowing reclaim).
    throw new RetryableWebhookError(`event processing in progress: ${safeEventLabel(event)}`);
  }

  if (outcome !== "claimed" || !claim?.lease_token) {
    // Unexpected claim result — treat as retryable rather than assume success.
    throw new RetryableWebhookError(`unexpected claim outcome: ${String(outcome)}`);
  }

  const leaseToken: string = claim.lease_token;

  // We own the lease. Process side effects.
  try {
    await runDispatch(event, env);
  } catch (e) {
    // The payload was already verified and this worker owns the claim. Every
    // dispatch failure is retryable: release only our lease, then return 5xx so
    // Stripe redelivers. Returning 400 here would permanently strand the event.
    const { data: released, error: releaseErr } = await sb.rpc("release_stripe_event", {
      _event_id: event.id,
      _lease_token: leaseToken,
    });
    if (releaseErr) {
      console.error("[webhook] Failed to release an event claim");
    } else if (released === false) {
      console.warn("[webhook] Event claim was already reclaimed or completed");
    }
    throw e instanceof RetryableWebhookError
      ? e
      : new RetryableWebhookError("Unexpected verified-event processing failure");
  }

  // Dispatch succeeded — atomically mark completed, guarded by our lease token.
  const { data: completed, error: completeErr } = await sb.rpc("complete_stripe_event", {
    _event_id: event.id,
    _lease_token: leaseToken,
  });
  if (completeErr) {
    // Side effects ran but we could not record completion. Retryable: the next
    // delivery re-runs, and downstream effects are idempotent (RPC status
    // guards / cumulative refund checks) so no double-apply occurs.
    throw new RetryableWebhookError(`failed to mark event completed: ${completeErr.message}`);
  }
  if (completed !== true) {
    // Our lease was reclaimed before we could complete (we ran slow past the
    // lease and another worker took over). Force a retry so ownership resolves.
    throw new RetryableWebhookError(`could not confirm completion (lease lost): ${safeEventLabel(event)}`);
  }

  return "processed";
}

/**
 * Verify, dedupe and process a webhook delivery. See processEvent for the full
 * processing/completed + lease state machine.
 *
 * Returns:
 *   "duplicate" — event already completed, respond 200.
 *   "processed" — handled and marked completed now, respond 200.
 * Throws RetryableWebhookError on retryable failures (claim in progress, DB
 * error, completion not confirmed) -> caller responds non-2xx so Stripe retries.
 */
async function handle(req: Request, env: StripeEnv): Promise<"duplicate" | "processed"> {
  const event = (await verifyWebhook(req, env)) as StripeEvent;
  const sb = await getSupabase();
  return processEvent(event, env, sb);
}


export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("[webhook] Missing or invalid environment");
          return new Response("Invalid webhook environment", { status: 400 });
        }
        try {
          const outcome = await handle(request, rawEnv);
          return Response.json({ received: true, outcome });
        } catch (e) {
          if (e instanceof RetryableWebhookError) {
            // Retryable DB/processing failure: nothing was durably committed for
            // this delivery (or effects are idempotent). Return non-2xx so Stripe
            // redelivers. Log server-side without PII.
            console.error("[webhook] retryable processing error:", e.message);
            return new Response("Webhook processing error (retry)", { status: 503 });
          }
          // Signature/verification or other errors: reject as a bad request.
          console.error("[webhook] processing error:", errMsg(e));
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
