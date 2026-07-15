import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

const uuid = z.string().uuid();

// ---------- Owner: list ticket types ----------
export const listTicketTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string }) => ({ eventId: uuid.parse(d.eventId) }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ticket_types")
      .select("*")
      .eq("event_id", data.eventId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Owner: create ticket type ----------
const CreateType = z.object({
  eventId: uuid,
  name: z.string().min(1).max(120),
  description: z.string().max(600).optional().nullable(),
  price_cents: z.number().int().min(0).max(10_000_000),
  quantity: z.number().int().min(1).max(1_000_000).nullable().optional(),
  max_per_order: z.number().int().min(1).max(100).optional(),
  sales_start: z.string().nullable().optional(),
  sales_end: z.string().nullable().optional(),
  visibility: z.enum(["public", "unlisted"]).optional(),
  promo_code: z.string().max(60).nullable().optional(),
});
export const createTicketType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateType.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("ticket_types")
      .insert({
        event_id: data.eventId,
        name: data.name,
        description: data.description ?? null,
        price_cents: data.price_cents,
        quantity: data.quantity ?? null,
        max_per_order: data.max_per_order ?? 10,
        sales_start: data.sales_start || null,
        sales_end: data.sales_end || null,
        visibility: data.visibility ?? "public",
        promo_code: data.promo_code?.trim() || null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- Owner: update ticket type ----------
const UpdateType = z.object({
  id: uuid,
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(600).nullable().optional(),
  price_cents: z.number().int().min(0).max(10_000_000).optional(),
  quantity: z.number().int().min(1).max(1_000_000).nullable().optional(),
  max_per_order: z.number().int().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
  sales_start: z.string().nullable().optional(),
  sales_end: z.string().nullable().optional(),
  visibility: z.enum(["public", "unlisted"]).optional(),
  promo_code: z.string().max(60).nullable().optional(),
});
export const updateTicketType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateType.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("ticket_types").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Owner: duplicate ticket type ----------
export const duplicateTicketType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: uuid.parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: src, error } = await supabase
      .from("ticket_types").select("*").eq("id", data.id).single();
    if (error || !src) throw new Error(error?.message ?? "Not found");
    const { data: row, error: e2 } = await supabase
      .from("ticket_types")
      .insert({
        event_id: src.event_id,
        name: `${src.name} (copy)`,
        description: src.description,
        price_cents: src.price_cents,
        currency: src.currency,
        quantity: src.quantity,
        max_per_order: src.max_per_order,
        sales_start: src.sales_start,
        sales_end: src.sales_end,
        visibility: src.visibility,
        promo_code: src.promo_code,
        is_active: false,
        created_by: userId,
      })
      .select().single();
    if (e2) throw new Error(e2.message);
    return row;
  });

// ---------- Owner: delete ticket type ----------
export const deleteTicketType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: uuid.parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ticket_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Owner: list orders ----------
export const listTicketOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string }) => ({ eventId: uuid.parse(d.eventId) }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ticket_orders")
      .select("*, ticket_types(name)")
      .eq("event_id", data.eventId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Owner: list attendees ----------
export const listAttendees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string }) => ({ eventId: uuid.parse(d.eventId) }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ticket_attendees")
      .select("*")
      .eq("event_id", data.eventId)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Owner: check-in / undo ----------
export const checkInAttendee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: uuid.parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ticket_attendees")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const undoCheckInAttendee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: uuid.parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ticket_attendees")
      .update({ checked_in_at: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Owner: resend confirmation email ----------
export const resendOrderConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string; siteUrl?: string }) => ({
    orderId: uuid.parse(d.orderId),
    siteUrl: d.siteUrl?.slice(0, 400),
  }))
  .handler(async ({ data }) => {
    const { sendOrderConfirmation } = await import("@/lib/tickets-emails.server");
    return sendOrderConfirmation({ orderId: data.orderId, siteUrl: data.siteUrl });
  });

// ---------- Owner: refund an order ----------
const RefundInput = z.object({
  orderId: uuid,
  amountCents: z.number().int().min(1).optional(), // omit for full refund
  reason: z.string().max(400).optional(),
  environment: z.enum(["sandbox", "live"]),
});
export const refundTicketOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RefundInput.parse(d))
  .handler(async ({ data, context }) => {
    // Verify caller owns the event
    const { data: order, error } = await context.supabase
      .from("ticket_orders")
      .select("id, event_id, ticket_type_id, quantity, amount_cents, refund_amount_cents, status, stripe_payment_intent")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");
    if (order.status !== "paid" && order.status !== "partially_refunded") {
      throw new Error("Only paid orders can be refunded");
    }
    const alreadyRefunded = order.refund_amount_cents ?? 0;
    const maxRefundable = (order.amount_cents ?? 0) - alreadyRefunded;
    const requested = data.amountCents ?? maxRefundable;
    if (requested <= 0 || requested > maxRefundable) {
      throw new Error(`Refundable amount is ${maxRefundable / 100}`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Free orders (no PI) skip Stripe.
    if (order.stripe_payment_intent) {
      try {
        const stripe = createStripeClient(data.environment);
        await stripe.refunds.create({
          payment_intent: order.stripe_payment_intent,
          amount: requested,
          reason: "requested_by_customer",
          metadata: { orderId: order.id, note: data.reason ?? "" },
        });
      } catch (e) {
        throw new Error(getStripeErrorMessage(e));
      }
    }

    // Atomic: lock order + type, apply refund state, release inventory on full refund.
    const { data: applied, error: rpcErr } = await supabaseAdmin.rpc("apply_ticket_refund", {
      _order_id: order.id,
      _refund_delta_cents: requested,
      _reason: data.reason ?? undefined,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    const row = Array.isArray(applied) ? applied[0] : applied;
    return {
      ok: true,
      refunded_cents: row?.refund_amount_cents ?? (alreadyRefunded + requested),
      status: row?.status ?? (alreadyRefunded + requested >= (order.amount_cents ?? 0) ? "refunded" : "partially_refunded"),
    };
  });


// ---------- Owner/attendee: build PDF for order (returns base64 bytes) ----------
export const getOrderTicketsPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string }) => ({ orderId: uuid.parse(d.orderId) }))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("ticket_orders")
      .select("id, event_id, ticket_type_id, buyer_name")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");

    const [{ data: ev }, { data: type }, { data: attendees }] = await Promise.all([
      context.supabase.from("events").select("name, event_date, event_time, location").eq("id", order.event_id).maybeSingle(),
      context.supabase.from("ticket_types").select("name").eq("id", order.ticket_type_id).maybeSingle(),
      context.supabase.from("ticket_attendees").select("qr_code, full_name").eq("order_id", order.id).order("created_at", { ascending: true }),
    ]);
    if (!attendees?.length) throw new Error("No attendees for this order yet.");

    const { buildTicketPdf } = await import("@/lib/tickets-emails.server");
    const when = ev?.event_date
      ? new Date(`${ev.event_date}T${(ev.event_time as string) ?? "00:00"}`).toLocaleString(undefined, { dateStyle: "full", timeStyle: ev.event_time ? "short" : undefined })
      : null;
    const bytes = await buildTicketPdf({
      eventName: ev?.name ?? "Event",
      eventWhen: when,
      eventLocation: ev?.location ?? null,
      ticketName: type?.name ?? "Admission",
      attendeeName: order.buyer_name,
      orderId: order.id,
      attendees: attendees as { qr_code: string; full_name: string | null }[],
    });
    // Base64 so it round-trips through JSON.
    const base64 = Buffer.from(bytes).toString("base64");
    return { base64, filename: `tickets-${order.id.slice(0, 8)}.pdf` };
  });


// ---------- Public: fetch event + active ticket types ----------
export const getPublicEventTickets = createServerFn({ method: "GET" })
  .inputValidator((d: { eventId: string }) => ({ eventId: uuid.parse(d.eventId) }))
  .handler(async ({ data }) => {
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: event, error: e1 } = await sb
      .from("events")
      .select("id, name, event_type, event_date, event_time, end_time, location, description, tickets_enabled, banner_url, owner_id")
      .eq("id", data.eventId)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!event || !event.tickets_enabled) return { event: null, types: [] as never[], organizer: null };

    const { data: types, error: e2 } = await sb
      .from("ticket_types")
      .select("id, name, description, price_cents, currency, quantity, sold_count, sales_start, sales_end, is_active, max_per_order, visibility")
      .eq("event_id", data.eventId)
      .eq("is_active", true)
      .eq("visibility", "public")
      .order("sort_order", { ascending: true });
    if (e2) throw new Error(e2.message);

    let organizer: { display_name: string | null } | null = null;
    if (event.owner_id) {
      const { data: prof } = await sb
        .from("profiles").select("display_name").eq("id", event.owner_id).maybeSingle();
      organizer = prof ?? null;
    }
    return { event, types: types ?? [], organizer };
  });

// ---------- Public: join waitlist for a sold-out ticket type ----------
const WaitlistInput = z.object({
  ticketTypeId: uuid,
  eventId: uuid,
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  quantity: z.number().int().min(1).max(20).default(1),
  note: z.string().trim().max(400).optional().nullable(),
});
export const joinTicketWaitlist = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => WaitlistInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { error } = await sb.from("ticket_waitlist").insert({
      ticket_type_id: data.ticketTypeId,
      event_id: data.eventId,
      full_name: data.fullName,
      email: data.email.toLowerCase(),
      quantity: data.quantity,
      note: data.note ?? null,
    });
    if (error) {
      // Duplicate = already on the list. Treat as success.
      if (error.code === "23505") return { ok: true, alreadyOnList: true };
      throw new Error(error.message);
    }
    return { ok: true, alreadyOnList: false };
  });


// ---------- Public: create Stripe checkout ----------
type CheckoutResult = { clientSecret: string } | { error: string };
const CheckoutInput = z.object({
  ticketTypeId: uuid,
  quantity: z.number().int().min(1).max(100),
  buyerEmail: z.string().email(),
  buyerName: z.string().min(1).max(120),
  promoCode: z.string().max(60).optional().nullable(),
  returnUrl: z.string().url(),
  environment: z.enum(["sandbox", "live"]),
});
export const createTicketCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CheckoutInput.parse(d))
  .handler(async ({ data }): Promise<CheckoutResult> => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: t, error: tErr } = await sb
        .from("ticket_types")
        .select("id, event_id, name, price_cents, currency, quantity, sold_count, is_active, max_per_order, promo_code, visibility, sales_start, sales_end")
        .eq("id", data.ticketTypeId)
        .maybeSingle();
      if (tErr || !t) return { error: "Ticket type not found" };
      if (!t.is_active) return { error: "This ticket is no longer available." };
      const now = Date.now();
      if (t.sales_start && new Date(t.sales_start).getTime() > now) return { error: "Sales haven't started yet." };
      if (t.sales_end && new Date(t.sales_end).getTime() < now) return { error: "Sales have ended." };
      if (data.quantity > (t.max_per_order ?? 10)) return { error: `Limit ${t.max_per_order} per order.` };
      if (t.quantity != null && (t.sold_count ?? 0) + data.quantity > t.quantity) {
        return { error: "Not enough tickets remaining." };
      }
      if (t.promo_code && (data.promoCode ?? "").trim().toUpperCase() !== t.promo_code.toUpperCase()) {
        return { error: "Promo code required." };
      }
      // Unlisted tickets can be bought via direct link; no extra check here.

      // Free tickets: skip Stripe entirely
      if (t.price_cents === 0) {
        const { data: order, error: oErr } = await supabaseAdmin
          .from("ticket_orders")
          .insert({
            event_id: t.event_id, ticket_type_id: t.id,
            buyer_name: data.buyerName, buyer_email: data.buyerEmail,
            quantity: data.quantity, amount_cents: 0, currency: t.currency, status: "paid",
          }).select("id").single();
        if (oErr || !order) return { error: oErr?.message ?? "Could not reserve free tickets" };
        const attendees = Array.from({ length: data.quantity }, (_, i) => ({
          order_id: order.id, event_id: t.event_id,
          full_name: i === 0 ? data.buyerName : null,
          email: i === 0 ? data.buyerEmail : null,
        }));
        await supabaseAdmin.from("ticket_attendees").insert(attendees);
        await supabaseAdmin.from("ticket_types")
          .update({ sold_count: (t.sold_count ?? 0) + data.quantity })
          .eq("id", t.id);
        try {
          const { sendOrderConfirmation } = await import("@/lib/tickets-emails.server");
          await sendOrderConfirmation({ orderId: order.id });
        } catch (e) { console.error("free ticket email failed", e); }
        return { clientSecret: `free_${order.id}` };
      }


      const stripe = createStripeClient(data.environment);
      const amount = t.price_cents * data.quantity;

      const { data: order, error: oErr } = await supabaseAdmin
        .from("ticket_orders")
        .insert({
          event_id: t.event_id, ticket_type_id: t.id,
          buyer_name: data.buyerName, buyer_email: data.buyerEmail,
          quantity: data.quantity, amount_cents: amount, currency: t.currency, status: "pending",
        }).select("id").single();
      if (oErr || !order) return { error: oErr?.message ?? "Could not create order" };

      const session = await stripe.checkout.sessions.create({
        line_items: [{
          price_data: { currency: t.currency, product_data: { name: t.name }, unit_amount: t.price_cents },
          quantity: data.quantity,
        }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer_email: data.buyerEmail,
        payment_intent_data: { description: `Ticket: ${t.name}` },
        metadata: { orderId: order.id, ticketTypeId: t.id, eventId: t.event_id },
      });

      await supabaseAdmin.from("ticket_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

// ---------- Public: finalize order ----------
const FinalizeInput = z.object({
  sessionId: z.string().min(1),
  environment: z.enum(["sandbox", "live"]),
});
export const finalizeTicketOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => FinalizeInput.parse(d))
  .handler(async ({ data }) => {
    try {
      // Free-ticket shortcut
      if (data.sessionId.startsWith("free_")) return { ok: true };

      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId);
      const orderId = session.metadata?.orderId;
      if (!orderId) return { ok: false, error: "No order linked" };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existing } = await supabaseAdmin
        .from("ticket_orders")
        .select("id, status, quantity, event_id, ticket_type_id, buyer_email, buyer_name")
        .eq("id", orderId).maybeSingle();
      if (!existing) return { ok: false, error: "Order not found" };

      const paid = session.payment_status === "paid";
      if (!paid) return { ok: false, error: "Payment not completed" };
      if (existing.status === "paid") return { ok: true, alreadyProcessed: true };

      await supabaseAdmin.from("ticket_orders").update({
        status: "paid",
        finalized_at: new Date().toISOString(),
        stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
      }).eq("id", orderId);

      const attendees = Array.from({ length: existing.quantity }, (_, i) => ({
        order_id: orderId, event_id: existing.event_id,
        full_name: i === 0 ? existing.buyer_name : null,
        email: i === 0 ? existing.buyer_email : null,
      }));
      await supabaseAdmin.from("ticket_attendees").insert(attendees);

      const { data: t } = await supabaseAdmin
        .from("ticket_types").select("sold_count").eq("id", existing.ticket_type_id).single();
      await supabaseAdmin.from("ticket_types")
        .update({ sold_count: (t?.sold_count ?? 0) + existing.quantity })
        .eq("id", existing.ticket_type_id);

      try {
        const { sendOrderConfirmation } = await import("@/lib/tickets-emails.server");
        await sendOrderConfirmation({ orderId });
      } catch (e) { console.error("ticket confirmation email failed", e); }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: getStripeErrorMessage(error) };
    }
  });


// ---------- AI: quick create from natural language ----------
export function parseTicketPrompt(input: string): { name: string; quantity: number | null; price_cents: number } | null {
  const s = input.trim();
  if (!s) return null;
  const qtyMatch = s.match(/(\d{1,6})\s*(tickets?|admissions?|seats?|spots?)/i);
  const priceMatch = s.match(/\$\s*(\d+(?:\.\d{1,2})?)/) ?? s.match(/(?:for|at)\s+(\d+(?:\.\d{1,2})?)\s*(?:dollars|usd|bucks)/i);
  const free = /\bfree\b/i.test(s);
  const nameMatch = s.match(/(?:create|make|add)\s+\d+\s+([a-z][\w\s-]{2,60}?)\s+tickets?/i)
    ?? s.match(/([a-z][\w\s-]{2,60}?)\s+tickets?/i);
  const name = (nameMatch?.[1] ?? "General Admission").replace(/\s+/g, " ").trim();
  const qty = qtyMatch ? Math.max(1, Number(qtyMatch[1])) : null;
  const priceCents = free ? 0 : priceMatch ? Math.round(Number(priceMatch[1]) * 100) : NaN;
  if (Number.isNaN(priceCents)) return null;
  return { name: name.charAt(0).toUpperCase() + name.slice(1), quantity: qty, price_cents: priceCents };
}
