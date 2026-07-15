import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

const uuid = z.string().uuid();

// ---------- Owner: list ticket types + counts ----------
export const listTicketTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string }) => ({ eventId: uuid.parse(d.eventId) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
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
  sales_start: z.string().nullable().optional(),
  sales_end: z.string().nullable().optional(),
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
        sales_start: data.sales_start || null,
        sales_end: data.sales_end || null,
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
  is_active: z.boolean().optional(),
  sales_start: z.string().nullable().optional(),
  sales_end: z.string().nullable().optional(),
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
      .limit(200);
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
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Owner: check in attendee ----------
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

// ---------- Public: fetch event + active ticket types ----------
export const getPublicEventTickets = createServerFn({ method: "GET" })
  .inputValidator((d: { eventId: string }) => ({ eventId: uuid.parse(d.eventId) }))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: event, error: e1 } = await sb
      .from("events")
      .select("id, name, event_type, event_date, event_time, location, tickets_enabled, banner_url")
      .eq("id", data.eventId)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!event || !event.tickets_enabled) return { event: null, types: [] as never[] };
    const { data: types, error: e2 } = await sb
      .from("ticket_types")
      .select("id, name, description, price_cents, currency, quantity, sold_count, sales_start, sales_end, is_active")
      .eq("event_id", data.eventId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (e2) throw new Error(e2.message);
    return { event, types: types ?? [] };
  });

// ---------- Public: create Stripe checkout ----------
type CheckoutResult = { clientSecret: string } | { error: string };
const CheckoutInput = z.object({
  ticketTypeId: uuid,
  quantity: z.number().int().min(1).max(20),
  buyerEmail: z.string().email(),
  buyerName: z.string().min(1).max(120),
  returnUrl: z.string().url(),
  environment: z.enum(["sandbox", "live"]),
});
export const createTicketCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CheckoutInput.parse(d))
  .handler(async ({ data }): Promise<CheckoutResult> => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Use admin for the atomic insert/reserve; only price + name come from public read
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: t, error: tErr } = await sb
        .from("ticket_types")
        .select("id, event_id, name, price_cents, currency, quantity, sold_count, is_active")
        .eq("id", data.ticketTypeId)
        .maybeSingle();
      if (tErr || !t) return { error: "Ticket type not found" };
      if (!t.is_active) return { error: "This ticket is no longer available." };
      if (t.quantity != null && (t.sold_count ?? 0) + data.quantity > t.quantity) {
        return { error: "Not enough tickets remaining." };
      }

      const stripe = createStripeClient(data.environment);
      const amount = t.price_cents * data.quantity;

      // Create a pending order first so we can attach its id to the session
      const { data: order, error: oErr } = await supabaseAdmin
        .from("ticket_orders")
        .insert({
          event_id: t.event_id,
          ticket_type_id: t.id,
          buyer_name: data.buyerName,
          buyer_email: data.buyerEmail,
          quantity: data.quantity,
          amount_cents: amount,
          currency: t.currency,
          status: "pending",
        })
        .select("id")
        .single();
      if (oErr || !order) return { error: oErr?.message ?? "Could not create order" };

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: t.currency,
              product_data: { name: t.name },
              unit_amount: t.price_cents,
            },
            quantity: data.quantity,
          },
        ],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer_email: data.buyerEmail,
        payment_intent_data: { description: `Ticket: ${t.name}` },
        metadata: { orderId: order.id, ticketTypeId: t.id, eventId: t.event_id },
      });

      await supabaseAdmin
        .from("ticket_orders")
        .update({ stripe_session_id: session.id })
        .eq("id", order.id);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

// ---------- Public: finalize order after checkout return ----------
const FinalizeInput = z.object({
  sessionId: z.string().min(1),
  environment: z.enum(["sandbox", "live"]),
});
export const finalizeTicketOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => FinalizeInput.parse(d))
  .handler(async ({ data }) => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId);
      const orderId = session.metadata?.orderId;
      if (!orderId) return { ok: false, error: "No order linked" };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existing } = await supabaseAdmin
        .from("ticket_orders")
        .select("id, status, quantity, event_id, ticket_type_id, buyer_email, buyer_name")
        .eq("id", orderId)
        .maybeSingle();
      if (!existing) return { ok: false, error: "Order not found" };

      const paid = session.payment_status === "paid";
      if (!paid) {
        return { ok: false, error: "Payment not completed" };
      }
      if (existing.status === "paid") {
        return { ok: true, alreadyProcessed: true };
      }

      // Mark paid + create attendees + bump sold_count
      await supabaseAdmin
        .from("ticket_orders")
        .update({
          status: "paid",
          stripe_payment_intent:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        })
        .eq("id", orderId);

      const attendees = Array.from({ length: existing.quantity }, (_, i) => ({
        order_id: orderId,
        event_id: existing.event_id,
        full_name: i === 0 ? existing.buyer_name : null,
        email: i === 0 ? existing.buyer_email : null,
      }));
      await supabaseAdmin.from("ticket_attendees").insert(attendees);

      // Atomic-ish increment via RPC-less update
      const { data: t } = await supabaseAdmin
        .from("ticket_types")
        .select("sold_count")
        .eq("id", existing.ticket_type_id)
        .single();
      await supabaseAdmin
        .from("ticket_types")
        .update({ sold_count: (t?.sold_count ?? 0) + existing.quantity })
        .eq("id", existing.ticket_type_id);

      return { ok: true };
    } catch (error) {
      return { ok: false, error: getStripeErrorMessage(error) };
    }
  });
