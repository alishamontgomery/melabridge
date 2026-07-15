import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await getSupabase().from("subscriptions").upsert(
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
}

async function handleDeleted(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

// -------- Ticketing --------
async function finalizeTicketOrderFromSession(session: any) {
  const orderId = session?.metadata?.orderId;
  if (!orderId) return;
  const sb = getSupabase();
  const { data: order } = await sb
    .from("ticket_orders")
    .select("id, status, quantity, event_id, ticket_type_id, buyer_email, buyer_name")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status === "paid") return;

  const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
  await sb.from("ticket_orders").update({
    status: "paid",
    finalized_at: new Date().toISOString(),
    stripe_payment_intent: pi,
  }).eq("id", orderId);

  const attendees = Array.from({ length: order.quantity }, (_, i) => ({
    order_id: orderId, event_id: order.event_id,
    full_name: i === 0 ? order.buyer_name : null,
    email: i === 0 ? order.buyer_email : null,
  }));
  await sb.from("ticket_attendees").insert(attendees);

  const { data: t } = await sb.from("ticket_types").select("sold_count").eq("id", order.ticket_type_id).single();
  await sb.from("ticket_types")
    .update({ sold_count: (t?.sold_count ?? 0) + order.quantity })
    .eq("id", order.ticket_type_id);

  try {
    const { sendOrderConfirmation } = await import("@/lib/tickets-emails.server");
    await sendOrderConfirmation({ orderId });
  } catch (e) { console.error("webhook email failed", e); }
}

async function expireTicketOrderFromSession(session: any) {
  const orderId = session?.metadata?.orderId;
  if (!orderId) return;
  await getSupabase().from("ticket_orders")
    .update({ status: "expired", failure_reason: "Checkout expired" })
    .eq("id", orderId).eq("status", "pending");
}

async function failTicketOrderFromPI(pi: any) {
  const sb = getSupabase();
  const reason = pi?.last_payment_error?.message ?? "Payment failed";
  await sb.from("ticket_orders")
    .update({ status: "failed", failure_reason: reason })
    .eq("stripe_payment_intent", pi.id).eq("status", "pending");
}

async function refundTicketOrderFromCharge(charge: any) {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!pi) return;
  const sb = getSupabase();
  const { data: order } = await sb
    .from("ticket_orders")
    .select("id, amount_cents, quantity, ticket_type_id, refund_amount_cents")
    .eq("stripe_payment_intent", pi).maybeSingle();
  if (!order) return;
  const refunded = charge.amount_refunded ?? 0;
  if (refunded <= (order.refund_amount_cents ?? 0)) return;
  const isFull = refunded >= (order.amount_cents ?? 0);
  await sb.from("ticket_orders").update({
    refund_amount_cents: refunded,
    refunded_at: new Date().toISOString(),
    status: isFull ? "refunded" : "partially_refunded",
  }).eq("id", order.id);
  if (isFull) {
    const { data: t } = await sb.from("ticket_types").select("sold_count").eq("id", order.ticket_type_id).single();
    await sb.from("ticket_types")
      .update({ sold_count: Math.max(0, (t?.sold_count ?? 0) - order.quantity) })
      .eq("id", order.ticket_type_id);
    await sb.from("ticket_attendees").delete().eq("order_id", order.id).is("checked_in_at", null);
  }
}

async function handle(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleDeleted(event.data.object, env);
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
    default:
      console.log("Unhandled event:", event.type);
  }
}


export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook missing/invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handle(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
