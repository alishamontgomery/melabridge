import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { billingConfig, findPlanByPriceId } from "@/lib/billing-config";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    priceId: string;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const { userId, claims } = context;
      const email = (claims as { email?: string })?.email;

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";
      const plan = findPlanByPriceId(data.priceId);
      if (!plan?.priceId || !plan.visible || !isRecurring) {
        throw new Error("This plan is not available for checkout.");
      }

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      // A Planner Pro trial is a one-time account benefit. Subscription history
      // remains the source of truth, so switching monthly/annual cannot reset it.
      const plannerPriceIds = [
        billingConfig.plans.planner_professional.priceId,
        billingConfig.plans.planner_professional_annual.priceId,
      ].filter((value): value is string => !!value);
      let trialDays = 0;
      if (plan.audience === "planner" && plan.trialDays > 0) {
        const { data: previousPlannerSubscriptions, error: historyError } = await context.supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .in("price_id", plannerPriceIds)
          .limit(1);
        if (historyError) throw new Error("Unable to verify Planner Pro trial eligibility.");
        if (previousPlannerSubscriptions?.length) {
          throw new Error(
            "Your Planner Pro trial has already been used. You can continue with paid billing from the Stripe billing portal.",
          );
        }
        // Also inspect Stripe history so a delayed webhook, an imported
        // subscription, or a customer shared across sessions cannot reset
        // eligibility by switching between monthly and annual prices.
        const customerSubscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 100,
        });
        const plannerProductId =
          typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product?.id;
        const previouslyTrialed = customerSubscriptions.data.some((subscription) =>
          subscription.items.data.some((item) => {
            const lookupKey = item.price.lookup_key;
            return !!lookupKey &&
              (plannerPriceIds.includes(lookupKey) ||
                (plannerProductId && item.price.product === plannerProductId)) &&
              (!!subscription.trial_start || !!subscription.trial_end);
          }),
        );
        if (previouslyTrialed) {
          throw new Error(
            "Your Planner Pro trial has already been used. You can continue with paid billing from the Stripe billing portal.",
          );
        }
        trialDays = 5;
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        metadata: { userId },
        ...(trialDays > 0 && { payment_method_collection: "always" as const }),
        ...(isRecurring && {
          subscription_data: {
            metadata: { userId },
            ...(trialDays > 0 && { trial_period_days: trialDays }),
            ...(trialDays > 0 && {
              trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } },
            }),
          },
        }),
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, cancel_at_period_end, current_period_end")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !sub?.stripe_subscription_id) {
      return { error: "No active subscription found." } as { error: string };
    }
    if (sub.cancel_at_period_end) {
      return { error: "Subscription is already scheduled for cancellation." } as { error: string };
    }
    try {
      const stripe = createStripeClient(data.environment);
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      // Eagerly update the local row — service_role required for writes.
      const { supabaseAdmin: adminCancel } = await import("@/integrations/supabase/client.server");
      await adminCancel
        .from("subscriptions")
        .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", sub.stripe_subscription_id);
      return { ok: true, accessEnds: sub.current_period_end };
    } catch (err) {
      return { error: getStripeErrorMessage(err) } as { error: string };
    }
  });

export const reactivateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, cancel_at_period_end")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !sub?.stripe_subscription_id) {
      return { error: "No subscription found." } as { error: string };
    }
    if (!sub.cancel_at_period_end) {
      return { error: "Subscription is not scheduled for cancellation." } as { error: string };
    }
    try {
      const stripe = createStripeClient(data.environment);
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: false,
      });
      // Eagerly update the local row — service_role required for writes.
      const { supabaseAdmin: adminReactivate } = await import("@/integrations/supabase/client.server");
      await adminReactivate
        .from("subscriptions")
        .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", sub.stripe_subscription_id);
      return { ok: true };
    } catch (err) {
      return { error: getStripeErrorMessage(err) } as { error: string };
    }
  });

/**
 * verifyCheckoutSession — webhook-free fulfillment.
 *
 * Called from the checkout return page immediately after Stripe redirects back.
 * Retrieves the session + subscription directly from Stripe and upserts the
 * subscription row into Supabase, so the subscription activates even when no
 * webhook is configured.  Safe to call multiple times (upsert is idempotent).
 */
export const verifyCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!data.sessionId || typeof data.sessionId !== "string") throw new Error("sessionId required");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { supabase, userId } = context;
    try {
      const stripe = createStripeClient(data.environment);

      // Retrieve session with subscription expanded so we have all needed fields in one call
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["subscription", "subscription.items.data.price"],
      });

      // Only process completed sessions
      if (session.payment_status !== "paid" && session.status !== "complete") {
        return { error: "Payment not yet completed." };
      }

      const rawSub = session.subscription as any;
      if (!rawSub || typeof rawSub !== "object") {
        // One-time payment with no subscription — nothing to upsert
        return { ok: true };
      }

      const metadataUserId = rawSub.metadata?.userId;
      if (metadataUserId !== userId) {
        return { error: "This checkout session does not belong to the signed-in account." };
      }
      const subUserId = metadataUserId;

      const item = rawSub.items?.data?.[0];
      const priceId =
        item?.price?.lookup_key ??
        // Retain this legacy metadata fallback for subscriptions created before
        // the direct Stripe integration. It is data compatibility, not a
        // provider dependency.
        item?.price?.metadata?.lovable_external_id ??
        item?.price?.id ??
        null;
      const productId = item?.price?.product ?? null;
      const periodStart = item?.current_period_start ?? rawSub.current_period_start;
      const periodEnd   = item?.current_period_end   ?? rawSub.current_period_end;

      // Subscription writes require service_role (RLS denies user-JWT writes).
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: upsertErr } = await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: subUserId,
          stripe_subscription_id: rawSub.id,
          stripe_customer_id: typeof rawSub.customer === "string" ? rawSub.customer : rawSub.customer?.id,
          product_id: productId,
          price_id: priceId,
          status: rawSub.status,
          current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
          current_period_end:   periodEnd   ? new Date(periodEnd   * 1000).toISOString() : null,
          cancel_at_period_end: rawSub.cancel_at_period_end ?? false,
          environment: data.environment,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" },
      );

      if (upsertErr) {
        console.error("verifyCheckoutSession upsert error:", upsertErr.message);
        return { error: upsertErr.message };
      }

      return { ok: true };
    } catch (err) {
      return { error: getStripeErrorMessage(err) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    const { supabase, userId } = context;

    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError || !sub?.stripe_customer_id) {
      return { error: "No subscription found. Start a plan first." };
    }

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
