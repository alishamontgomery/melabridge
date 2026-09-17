import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import {
  buildTicketCheckoutUrls,
  getCanonicalTicketSiteUrl,
  TicketCheckoutInput,
} from "@/lib/ticket-order-access";
import { isCheckInEligibleOrderStatus } from "@/lib/ticket-checkin-policy";
import { isValidTimeInput, normalizeDateInput, normalizeTimeInput, trimOrNull } from "@/lib/event-input-normalization";

const uuid = z.string().uuid();
const StripeEnvironment = z.enum(["sandbox", "live"]);
type TicketStripeEnvironment = z.infer<typeof StripeEnvironment>;

type PublicTicketRecord = {
  attendee: {
    id: string;
    full_name: string | null;
    checked_in_at: string | null;
  };
  order: {
    id: string;
  };
  event: {
    id: string;
    name: string;
    event_date: string | null;
    event_time: string | null;
    end_time: string | null;
    location: string | null;
    description: string | null;
  };
  type: {
    id: string;
    name: string;
    description: string | null;
  } | null;
};

export function buildPublicTicketRecord(
  attendee: {
    id: string;
    full_name: string | null;
    checked_in_at: string | null;
  },
  order: { id: string },
  event: PublicTicketRecord["event"],
  type: PublicTicketRecord["type"],
): PublicTicketRecord {
  return {
    attendee: {
      id: attendee.id,
      full_name: attendee.full_name,
      checked_in_at: attendee.checked_in_at,
    },
    order: { id: order.id },
    event,
    type: type
      ? {
          id: type.id,
          name: type.name,
          description: type.description,
        }
      : null,
  };
}

function defaultTicketStripeEnvironment(): TicketStripeEnvironment {
  return process.env.NODE_ENV === "production" ? "live" : "sandbox";
}

type ConnectAccountState = {
  user_id: string;
  environment: TicketStripeEnvironment;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  currently_due: string[];
  disabled_reason: string | null;
  last_synced_at: string | null;
};

type TicketPayoutStatus = ConnectAccountState & {
  ready: boolean;
  state: "not_started" | "pending" | "action_required" | "ready" | "disabled";
};

type StripeConnectedAccount = {
  id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  requirements?: {
    currently_due?: string[];
    disabled_reason?: string | null;
  } | null;
};

function payoutState(account: {
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  currently_due?: string[];
  disabled_reason?: string | null;
} | null): TicketPayoutStatus["state"] {
  if (!account) return "not_started";
  if (account.disabled_reason) return "disabled";
  if (account.charges_enabled && account.payouts_enabled) return "ready";
  if ((account.currently_due?.length ?? 0) > 0) return "action_required";
  return "pending";
}

function readConnectAccount(row: any): TicketPayoutStatus {
  const account = row as ConnectAccountState;
  const state = payoutState(account);
  return { ...account, ready: state === "ready", state };
}

async function getConnectAccountRow(userId: string, environment: TicketStripeEnvironment): Promise<ConnectAccountState | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("stripe_connect_accounts")
    .select("user_id, environment, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, currently_due, disabled_reason, last_synced_at")
    .eq("user_id", userId)
    .eq("environment", environment)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ConnectAccountState | null;
}

async function requireTicketPayoutsReady(userId: string, environment: TicketStripeEnvironment) {
  const account = await getConnectAccountRow(userId, environment);
  if (!account || payoutState(account) !== "ready") {
    throw new Error("Complete Stripe payout setup before publishing or selling paid tickets.");
  }
  return account;
}

function connectAccountStatus(account: StripeConnectedAccount): Pick<ConnectAccountState, "charges_enabled" | "payouts_enabled" | "details_submitted" | "currently_due" | "disabled_reason"> {
  return {
    charges_enabled: account.charges_enabled === true,
    payouts_enabled: account.payouts_enabled === true,
    details_submitted: account.details_submitted === true,
    currently_due: account.requirements?.currently_due ?? [],
    disabled_reason: account.requirements?.disabled_reason ?? null,
  };
}

// ---------- Owner: Stripe Connect payout setup ----------
const PayoutEnvironmentInput = z.object({ environment: StripeEnvironment.optional() });

export const getTicketPayoutStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => PayoutEnvironmentInput.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<TicketPayoutStatus> => {
    const environment = data.environment ?? defaultTicketStripeEnvironment();
    const existing = await getConnectAccountRow(context.userId, environment);
    if (!existing) {
      return {
        user_id: context.userId,
        environment,
        stripe_account_id: "",
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        currently_due: [],
        disabled_reason: null,
        last_synced_at: null,
        ready: false,
        state: "not_started",
      };
    }

    const stripe = createStripeClient(environment);
    try {
      const account = (await stripe.accounts.retrieve(existing.stripe_account_id)) as unknown as StripeConnectedAccount;
      const synced = connectAccountStatus(account);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await (supabaseAdmin as any)
        .from("stripe_connect_accounts")
        .update({ ...synced, last_synced_at: new Date().toISOString() })
        .eq("user_id", context.userId)
        .eq("environment", environment);
      if (error) throw new Error(error.message);
      return readConnectAccount({ ...existing, ...synced, last_synced_at: new Date().toISOString() });
    } catch (error) {
      throw new Error(getStripeErrorMessage(error));
    }
  });

export const createTicketPayoutOnboardingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => PayoutEnvironmentInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const environment = data.environment ?? defaultTicketStripeEnvironment();
    const stripe = createStripeClient(environment);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("email, display_name")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile?.email) throw new Error("Add an email address to your profile before setting up payouts.");

    let existing = await getConnectAccountRow(context.userId, environment);
    let account: StripeConnectedAccount;
    if (existing) {
      account = (await stripe.accounts.retrieve(existing.stripe_account_id)) as unknown as StripeConnectedAccount;
    } else {
      account = (await stripe.accounts.create({
        type: "express",
        country: "US",
        email: profile.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: { name: profile.display_name || undefined },
        metadata: { melaUserId: context.userId },
      })) as unknown as StripeConnectedAccount;
      const { error: insertError } = await db.from("stripe_connect_accounts").insert({
        user_id: context.userId,
        environment,
        stripe_account_id: account.id,
        ...connectAccountStatus(account),
        last_synced_at: new Date().toISOString(),
      });
      if (insertError) {
        // A retry after a network race can discover the row and continue.
        existing = await getConnectAccountRow(context.userId, environment);
        if (!existing) throw new Error(insertError.message);
        account = (await stripe.accounts.retrieve(existing.stripe_account_id)) as unknown as StripeConnectedAccount;
      }
    }

    const siteUrl = getCanonicalTicketSiteUrl(process.env);
    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${siteUrl}/settings?payments=refresh`,
      return_url: `${siteUrl}/settings?payments=return`,
      type: "account_onboarding",
    });
    return { url: link.url };
  });

export const createTicketPayoutDashboardLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => PayoutEnvironmentInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const environment = data.environment ?? defaultTicketStripeEnvironment();
    const existing = await getConnectAccountRow(context.userId, environment);
    if (!existing) throw new Error("Complete payout setup first.");
    const stripe = createStripeClient(environment);
    const link = await stripe.accounts.createLoginLink(existing.stripe_account_id);
    return { url: link.url };
  });

// ---------- Owner: list ticket types ----------
export const listTicketTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { eventId: string }) => ({ eventId: uuid.parse(d.eventId) }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ticket_types")
      .select("*")
      .eq("event_id", data.eventId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Owner: update the details shown on the ticket storefront ----------
const UpdateTicketPageDetails = z.object({
  eventId: uuid,
  event_date: z.preprocess((value) => typeof value === "string" ? normalizeDateInput(value) : value, z.string().date().nullable()),
  start_time: z.preprocess((value) => typeof value === "string" ? normalizeTimeInput(value) : value, z.string().refine(isValidTimeInput, "Enter a valid start time").nullable()),
  end_time: z.preprocess((value) => typeof value === "string" ? normalizeTimeInput(value) : value, z.string().refine(isValidTimeInput, "Enter a valid end time").nullable()),
  location: z.preprocess((value) => typeof value === "string" ? trimOrNull(value) : value, z.string().max(300).nullable()),
  cover_image_url: z.preprocess((value) => typeof value === "string" ? trimOrNull(value) : value, z.string().url().max(2_000).nullable()),
  ticket_primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  ticket_accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  ticket_contact_name: z.preprocess((value) => typeof value === "string" ? trimOrNull(value) : value, z.string().max(120).nullable()),
  ticket_contact_email: z.preprocess((value) => typeof value === "string" ? trimOrNull(value) : value, z.string().email().max(255).nullable()),
  ticket_cancellation_policy: z.enum(["no_cancellations", "case_by_case", "allowed_until"]),
  ticket_cancellation_window_hours: z.number().int().min(1).max(8760).nullable(),
  ticket_cancellation_terms: z.preprocess((value) => typeof value === "string" ? trimOrNull(value) : value, z.string().max(2000).nullable()),
});
export const updateTicketPageDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => UpdateTicketPageDetails.parse(d))
  .handler(async ({ data, context }) => {
    const { eventId, start_time, ...details } = data;
    if (start_time && data.end_time && data.end_time <= start_time) {
      throw new Error("Event end time must be after the start time");
    }
    const { data: updated, error } = await context.supabase
      .from("events")
      .update({
        ...details,
        event_time: start_time,
        start_time,
        banner_url: data.cover_image_url,
      })
      .eq("id", eventId)
      .eq("owner_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Only the event owner can update the ticket page");
    return { ok: true };
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
  promo_discount_percent: z.number().int().min(1).max(100).nullable().optional(),
  early_bird_price_cents: z.number().int().min(0).max(10_000_000).nullable().optional(),
  early_bird_ends_at: z.string().datetime().nullable().optional(),
  environment: StripeEnvironment.optional(),
});
export const createTicketType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => CreateType.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", data.eventId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (eventError) {
      console.error("[tickets] event ownership check failed", eventError.message);
      throw new Error("Could not verify access to this event");
    }
    if (!event) throw new Error("Only the event owner can publish tickets");
    if (data.price_cents > 0) {
      await requireTicketPayoutsReady(userId, data.environment ?? defaultTicketStripeEnvironment());
    }

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
        promo_discount_percent: data.promo_discount_percent ?? null,
        early_bird_price_cents: data.early_bird_price_cents ?? null,
        early_bird_ends_at: data.early_bird_ends_at ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) {
      console.error("[tickets] create ticket type failed", error.message);
      throw new Error("Ticket could not be published. Check the details and try again");
    }
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
  promo_discount_percent: z.number().int().min(1).max(100).nullable().optional(),
  early_bird_price_cents: z.number().int().min(0).max(10_000_000).nullable().optional(),
  early_bird_ends_at: z.string().datetime().nullable().optional(),
  environment: StripeEnvironment.optional(),
});
export const updateTicketType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => UpdateType.parse(d))
  .handler(async ({ data, context }) => {
    const { id, environment, ...patch } = data;
    if (patch.price_cents !== undefined || patch.is_active === true) {
      const { data: current, error: currentError } = await context.supabase
        .from("ticket_types")
        .select("price_cents, event_id")
        .eq("id", id)
        .maybeSingle();
      if (currentError) throw new Error(currentError.message);
      const willBePaid = (patch.price_cents ?? current?.price_cents ?? 0) > 0;
      if (willBePaid && (patch.is_active !== false)) {
        await requireTicketPayoutsReady(context.userId, environment ?? defaultTicketStripeEnvironment());
      }
    }
    const { data: updated, error } = await context.supabase
      .from("ticket_types")
      .update(patch)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Only the event owner can update this ticket type");
    return { ok: true };
  });

// ---------- Owner: duplicate ticket type ----------
export const duplicateTicketType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => ({ id: uuid.parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: src, error } = await supabase
      .from("ticket_types").select("*").eq("id", data.id).single();
    if (error || !src) throw new Error(error?.message ?? "Not found");
    if (src.price_cents > 0) {
      await requireTicketPayoutsReady(userId, defaultTicketStripeEnvironment());
    }
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
        promo_discount_percent: src.promo_discount_percent,
        early_bird_price_cents: src.early_bird_price_cents,
        early_bird_ends_at: src.early_bird_ends_at,
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
  .validator((d: { id: string }) => ({ id: uuid.parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { data: ticket, error: ticketError } = await context.supabase
      .from("ticket_types")
      .select("id,event_id,name")
      .eq("id", data.id)
      .maybeSingle();
    if (ticketError) throw new Error(ticketError.message);
    if (!ticket) throw new Error("Ticket type not found");

    const { data: event, error: eventError } = await context.supabase
      .from("events")
      .select("id")
      .eq("id", ticket.event_id)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (eventError) throw new Error(eventError.message);
    if (!event) throw new Error("Only the event owner can delete this ticket type");

    const { count, error: orderError } = await context.supabase
      .from("ticket_orders")
      .select("id", { count: "exact", head: true })
      .eq("ticket_type_id", data.id);
    if (orderError) throw new Error(orderError.message);
    if ((count ?? 0) > 0) {
      throw new Error("This ticket has order history and cannot be permanently deleted. Archive it instead.");
    }

    const { error } = await context.supabase.from("ticket_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Owner: list orders ----------
export const listTicketOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { eventId: string }) => ({ eventId: uuid.parse(d.eventId) }))
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
  .validator((d: { eventId: string }) => ({ eventId: uuid.parse(d.eventId) }))
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

const ComplimentaryGuestInput = z.object({
  eventId: uuid,
  ticketTypeId: uuid,
  fullName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(255),
});
export const addComplimentaryGuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => ComplimentaryGuestInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: orderId, error } = await context.supabase.rpc("create_complimentary_ticket", {
      _event_id: data.eventId,
      _ticket_type_id: data.ticketTypeId,
      _guest_name: data.fullName,
      _guest_email: data.email,
    });
    if (error || !orderId) throw new Error(error?.message ?? "Could not add guest");
    try {
      const { sendOrderConfirmation } = await import("@/lib/tickets-emails.server");
      await sendOrderConfirmation({ orderId: orderId as string });
    } catch (emailError) {
      console.error("complimentary ticket email failed", emailError);
    }
    return { ok: true, orderId: orderId as string };
  });

// ---------- Owner: check-in / undo ----------

export const checkInAttendee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => ({ id: uuid.parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Ownership guard: resolve attendee → event and verify caller is the event owner.
    const { data: a } = await supabase.from("ticket_attendees").select("event_id, order_id").eq("id", data.id).maybeSingle();
    if (!a) throw new Error("Attendee not found");
    const { data: ev } = await supabase.from("events").select("owner_id").eq("id", a.event_id).maybeSingle();
    if (!ev || ev.owner_id !== userId) throw new Error("Not authorized to check in attendees for this event");
    const { data: order } = await supabase.from("ticket_orders").select("status").eq("id", a.order_id).maybeSingle();
    if (!isCheckInEligibleOrderStatus(order?.status)) {
      throw new Error("This ticket is no longer valid");
    }
    const now = new Date().toISOString();
    const { data: checkedIn, error } = await supabase
      .from("ticket_attendees")
      .update({ checked_in_at: now })
      .eq("id", data.id)
      .is("checked_in_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: !!checkedIn, alreadyCheckedIn: !checkedIn, checkedInAt: now };
  });

export const undoCheckInAttendee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => ({ id: uuid.parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Ownership guard: resolve attendee → event and verify caller is the event owner.
    const { data: a } = await supabase.from("ticket_attendees").select("event_id").eq("id", data.id).maybeSingle();
    if (!a) throw new Error("Attendee not found");
    const { data: ev } = await supabase.from("events").select("owner_id").eq("id", a.event_id).maybeSingle();
    if (!ev || ev.owner_id !== userId) throw new Error("Not authorized to undo check-in for this event");
    const { error } = await supabase
      .from("ticket_attendees")
      .update({ checked_in_at: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Owner: resend confirmation email ----------
export const resendOrderConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { orderId: string; siteUrl?: string }) => ({
    orderId: uuid.parse(d.orderId),
    siteUrl: d.siteUrl?.slice(0, 400),
  }))
  .handler(async ({ data, context }) => {
    const { data: order, error: orderError } = await context.supabase
      .from("ticket_orders")
      .select("event_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderError) {
      console.error("[tickets] resend confirmation order lookup failed", orderError.message);
      throw new Error("Could not verify access to this order");
    }

    const { data: ownedEvent, error: eventError } = order
      ? await context.supabase
          .from("events")
          .select("id")
          .eq("id", order.event_id)
          .eq("owner_id", context.userId)
          .maybeSingle()
      : { data: null, error: null };
    if (eventError) {
      console.error("[tickets] resend confirmation ownership check failed", eventError.message);
      throw new Error("Could not verify access to this order");
    }
    if (!order || !ownedEvent) {
      throw new Error("Only the event owner can resend order confirmations");
    }

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
  .validator((d: unknown) => RefundInput.parse(d))
  .handler(async ({ data, context }) => {
    // Verify caller owns the event
    const { data: order, error } = await context.supabase
      .from("ticket_orders")
      .select("id, event_id, ticket_type_id, quantity, amount_cents, refund_amount_cents, status, stripe_payment_intent, buyer_name, buyer_email, currency")
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
           reverse_transfer: true,
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

    // Exception alert — always fires, regardless of per-sale preference
    try {
      const { insertExceptionAlert } = await import("@/lib/ticket-notifications.server");
      await insertExceptionAlert({
        eventId: order.event_id,
        type: "refund",
        amountCents: requested,
        buyerName: (order as { buyer_name?: string | null }).buyer_name ?? "buyer",
        currency: (order as { currency?: string | null }).currency ?? "usd",
      });
    } catch (e) { console.error("refund exception alert failed", e); }

    return {
      ok: true,
      refunded_cents: row?.refund_amount_cents ?? (alreadyRefunded + requested),
      status: row?.status ?? (alreadyRefunded + requested >= (order.amount_cents ?? 0) ? "refunded" : "partially_refunded"),
    };
  });


// ---------- Owner/attendee: build PDF for order (returns base64 bytes) ----------
export const getOrderTicketsPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { orderId: string }) => ({ orderId: uuid.parse(d.orderId) }))
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
  .validator((d: { eventId: string }) => ({ eventId: uuid.parse(d.eventId) }))
  .handler(async ({ data }) => {
    // Public event pages expose only the explicitly selected safe fields below.
    // Use the server client so link-only ticket pages are not blocked by the
    // broader public-event RLS policy, which requires the general event page
    // to be published.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: event, error: e1 } = await supabaseAdmin
      .from("events")
      .select("id, name, event_type, event_date, event_time, start_time, end_time, location, description, tickets_enabled, banner_url, cover_image_url, event_visibility, owner_id, ticket_primary_color, ticket_accent_color, ticket_contact_name, ticket_contact_email, ticket_cancellation_policy, ticket_cancellation_window_hours, ticket_cancellation_terms")
      .eq("id", data.eventId)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!event || !event.tickets_enabled) {
      return { event: null, types: [] as never[], organizer: null, ticketSalesUnavailable: false };
    }

    const { data: types, error: e2 } = await supabaseAdmin
      .from("ticket_types")
      .select("id, name, description, price_cents, currency, quantity, sold_count, sales_start, sales_end, is_active, max_per_order, visibility, early_bird_price_cents, early_bird_ends_at")
      .eq("event_id", data.eventId)
      .eq("is_active", true)
      .eq("visibility", "public")
      .order("sort_order", { ascending: true });
    if (e2) throw new Error(e2.message);

    const paidTypes = (types ?? []).filter((type) => type.price_cents > 0);
    let ticketSalesUnavailable = false;
    if (paidTypes.length > 0 && event.owner_id) {
      // The public page and checkout use the same environment selected by the
      // deployment. Never expose paid inventory in an environment that cannot
      // route the resulting charge to the organizer.
      const account = await getConnectAccountRow(event.owner_id, defaultTicketStripeEnvironment());
      ticketSalesUnavailable = !account || payoutState(account) !== "ready";
    }

    let organizer: { display_name: string | null } | null = null;
    if (event.owner_id) {
      const { data: prof } = await supabaseAdmin
        .from("profiles").select("display_name").eq("id", event.owner_id).maybeSingle();
      organizer = prof ?? null;
    }
    return {
      event,
      types: ticketSalesUnavailable ? (types ?? []).filter((type) => type.price_cents === 0) : (types ?? []),
      organizer,
      ticketSalesUnavailable,
    };
  });

export const validateTicketCoupon = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ ticketTypeId: uuid, code: z.string().trim().min(1).max(60) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket } = await supabaseAdmin
      .from("ticket_types")
      .select("promo_code,promo_discount_percent,is_active")
      .eq("id", data.ticketTypeId)
      .maybeSingle();
    const valid = !!ticket?.is_active
      && !!ticket.promo_code
      && !!ticket.promo_discount_percent
      && ticket.promo_code.toUpperCase() === data.code.toUpperCase();
    return valid ? { valid: true as const, discountPercent: ticket.promo_discount_percent! } : { valid: false as const };
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
  .validator((d: unknown) => WaitlistInput.parse(d))
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
/** For paid tickets: { url } → redirect to Stripe hosted checkout.
 *  For free tickets: { freeOrderId } → redirect straight to confirm page.
 *  On error: { error }. */
type CheckoutResult =
  | { url: string }
  | { freeOrderId: string; accessToken: string }
  | { error: string };
export const createTicketCheckout = createServerFn({ method: "POST" })
  .validator((d: unknown) => TicketCheckoutInput.parse(d))
  .handler(async ({ data }): Promise<CheckoutResult> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Public buyers do not have a Supabase session. Read the selected ticket
      // server-side, then enforce every sale and inventory rule below before
      // creating an order.
      const { data: t, error: tErr } = await supabaseAdmin
        .from("ticket_types")
        .select("id, event_id, name, price_cents, currency, quantity, sold_count, is_active, max_per_order, promo_code, promo_discount_percent, early_bird_price_cents, early_bird_ends_at, visibility, sales_start, sales_end")
        .eq("id", data.ticketTypeId)
        .maybeSingle();
      if (tErr || !t) return { error: "Ticket type not found" };
      if (!t.is_active) return { error: "This ticket is no longer available." };
      const now = Date.now();
      if (t.sales_start && new Date(t.sales_start).getTime() > now) return { error: "Sales haven't started yet." };
      if (t.sales_end && new Date(t.sales_end).getTime() < now) return { error: "Sales have ended." };
      if (data.quantity > (t.max_per_order ?? 10)) return { error: `Max ${t.max_per_order ?? 10} tickets per order.` };
      if (t.quantity != null && (t.sold_count ?? 0) + data.quantity > t.quantity) {
        return { error: "Not enough tickets remaining." };
      }
      const enteredPromo = (data.promoCode ?? "").trim().toUpperCase();
      const promoMatches = !!t.promo_code && enteredPromo === t.promo_code.toUpperCase();
      if (enteredPromo && !promoMatches) return { error: "Coupon code is invalid." };
      const earlyBirdActive = t.early_bird_price_cents != null
        && !!t.early_bird_ends_at
        && new Date(t.early_bird_ends_at).getTime() > now;
      const baseUnitAmount = earlyBirdActive ? t.early_bird_price_cents! : t.price_cents;
      const unitAmount = promoMatches && t.promo_discount_percent
        ? Math.max(0, Math.round(baseUnitAmount * (100 - t.promo_discount_percent) / 100))
        : baseUnitAmount;

      let payoutAccountId: string | null = null;
      if (unitAmount > 0) {
        const eventResult = await supabaseAdmin
          .from("events")
          .select("owner_id")
          .eq("id", t.event_id)
          .maybeSingle();
        if (eventResult.error || !eventResult.data?.owner_id) {
          return { error: "This event is not ready to accept paid tickets." };
        }
        try {
          const payoutAccount = await requireTicketPayoutsReady(eventResult.data.owner_id, data.environment);
          payoutAccountId = payoutAccount.stripe_account_id;
        } catch {
          return { error: "Ticket sales are temporarily unavailable while the organizer finishes payout setup." };
        }
      }

      // Free tickets: atomic RPC
      if (unitAmount === 0) {
        const { data: newOrderId, error: rpcErr } = await supabaseAdmin.rpc("claim_free_tickets", {
          _ticket_type_id: t.id,
          _buyer_name: data.buyerName,
          _buyer_email: data.buyerEmail,
          _quantity: data.quantity,
          _promo_code: data.promoCode ?? undefined,
        });
        if (rpcErr || !newOrderId) return { error: rpcErr?.message ?? "Could not reserve free tickets" };
        // The database default creates the access token in the same transaction
        // as the order. Read it back rather than assigning it after the claim.
        const { data: securedOrder, error: tokenErr } = await supabaseAdmin
          .from("ticket_orders")
          .select("access_token")
          .eq("id", newOrderId as string)
          .single();
        if (tokenErr || !securedOrder?.access_token) {
          return { error: "Could not secure the ticket confirmation" };
        }
        try {
          const { sendOrderConfirmation } = await import("@/lib/tickets-emails.server");
          await sendOrderConfirmation({ orderId: newOrderId as string });
        } catch (e) { console.error("free ticket email failed", e); }
        // Free tickets bypass Stripe + finalizeTicketOrder — fire milestones here
        try {
          const { checkAndFireTicketMilestones } = await import("@/lib/ticket-notifications.server");
          await checkAndFireTicketMilestones(t.event_id);
        } catch (e) { console.error("free ticket milestone notification failed", e); }
        return { freeOrderId: newOrderId as string, accessToken: securedOrder.access_token };
      }

      // Paid tickets: Stripe hosted checkout
      const stripe = createStripeClient(data.environment);
      const amount = unitAmount * data.quantity;
      const accessToken = crypto.randomUUID();

      const { data: order, error: oErr } = await supabaseAdmin
        .from("ticket_orders")
        .insert({
          event_id: t.event_id, ticket_type_id: t.id,
          buyer_name: data.buyerName, buyer_email: data.buyerEmail,
          quantity: data.quantity, amount_cents: amount, currency: t.currency, status: "pending",
          access_token: accessToken,
        }).select("id").single();
      if (oErr || !order) return { error: oErr?.message ?? "Could not create order" };

      // Build both redirects from a canonical server-controlled URL and the
      // server-resolved event ID. Client input and request headers cannot
      // choose where Stripe sends the bearer token after payment.
      const { successUrl, cancelUrl } = buildTicketCheckoutUrls(
        getCanonicalTicketSiteUrl(process.env),
        t.event_id,
        accessToken,
      );
      const session = await stripe.checkout.sessions.create({
        line_items: [{
          price_data: { currency: t.currency, product_data: { name: t.name }, unit_amount: unitAmount },
          quantity: data.quantity,
        }],
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: data.buyerEmail,
         payment_intent_data: {
           description: `Ticket: ${t.name}`,
           // Destination charge with no application fee: MelaBridge does not
           // take a ticketing platform fee, and the connected organizer
           // receives the full ticket amount.
           transfer_data: { destination: payoutAccountId! },
         },
        metadata: { orderId: order.id, ticketTypeId: t.id, eventId: t.event_id },
      });

      await supabaseAdmin.from("ticket_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
      if (!session.url) return { error: "Stripe did not return a checkout URL" };
      return { url: session.url };
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
  .validator((d: unknown) => FinalizeInput.parse(d))
  .handler(async ({ data }) => {
    try {
      // Free-ticket shortcut (already finalized via RPC)
      if (data.sessionId.startsWith("free_")) {
        const orderId = data.sessionId.slice(5);
        return { ok: true, orderId };
      }

      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId);
      const orderId = session.metadata?.orderId;
      if (!orderId) return { ok: false, error: "No order linked" };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const paid = session.payment_status === "paid";
      if (!paid) return { ok: false, error: "Payment not completed" };

      const { data: finalized, error: finalizeError } = await supabaseAdmin.rpc(
        "finalize_paid_ticket_order" as never,
        {
          _order_id: orderId,
          _payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
        } as never,
      );
      if (finalizeError) return { ok: false, error: finalizeError.message };
      const finalizedRow = (Array.isArray(finalized) ? finalized[0] : finalized) as
        | { claimed: boolean; event_id: string }
        | null;

      if (finalizedRow?.claimed) try {
        const { sendOrderConfirmation } = await import("@/lib/tickets-emails.server");
        await sendOrderConfirmation({ orderId });
      } catch (e) { console.error("ticket confirmation email failed", e); }

      if (finalizedRow?.claimed && finalizedRow.event_id) try {
        const { checkAndFireTicketMilestones } = await import("@/lib/ticket-notifications.server");
        await checkAndFireTicketMilestones(finalizedRow.event_id);
      } catch (e) { console.error("milestone notification failed", e); }

      return { ok: true, orderId, alreadyProcessed: !finalizedRow?.claimed };
    } catch (error) {
      return { ok: false, error: getStripeErrorMessage(error) };
    }
  });


// ---------- Public: fetch a single ticket by QR code (no auth) ----------
export const getTicketByCode = createServerFn({ method: "GET" })
  .validator((d: { ticketCode: string }) => ({ ticketCode: z.string().min(8).max(120).parse(d.ticketCode) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: attendee, error: aErr } = await supabaseAdmin
      .from("ticket_attendees")
      .select("id, order_id, event_id, full_name, checked_in_at")
      .eq("qr_code", data.ticketCode)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!attendee) return null;

    const [{ data: order }, { data: ev }] = await Promise.all([
      supabaseAdmin.from("ticket_orders")
        .select("id, ticket_type_id")
        .eq("id", attendee.order_id).maybeSingle(),
      supabaseAdmin.from("events")
        .select("id, name, event_date, event_time, end_time, location, description")
        .eq("id", attendee.event_id).maybeSingle(),
    ]);
    if (!order || !ev) return null;

    const { data: type } = await supabaseAdmin
      .from("ticket_types").select("id, name, description").eq("id", order.ticket_type_id).maybeSingle();

    return buildPublicTicketRecord(attendee, order, ev, type);
  });


// ---------- Buyer capability: fetch order details by orderId + access token ----------
export const getPublicOrderDetails = createServerFn({ method: "GET" })
  .validator((d: { orderId: string; accessToken: string }) => ({
    orderId: uuid.parse(d.orderId),
    accessToken: uuid.parse(d.accessToken),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("ticket_orders")
      .select("id, event_id, ticket_type_id, buyer_name, buyer_email, quantity, amount_cents, currency, status, created_at")
      .eq("id", data.orderId)
      .eq("access_token", data.accessToken)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return null;

    const [{ data: ev }, { data: type }, { data: attendees }] = await Promise.all([
      supabaseAdmin.from("events")
        .select("id, name, event_date, event_time, location, description")
        .eq("id", order.event_id).maybeSingle(),
      supabaseAdmin.from("ticket_types")
        .select("id, name, price_cents").eq("id", order.ticket_type_id).maybeSingle(),
      supabaseAdmin.from("ticket_attendees")
        .select("id, qr_code, full_name, checked_in_at")
        .eq("order_id", data.orderId)
        .order("created_at", { ascending: true }),
    ]);
    return { order, event: ev, type, attendees: attendees ?? [] };
  });

export const getPublicOrderTicketsPdf = createServerFn({ method: "POST" })
  .validator((d: { orderId: string; accessToken: string }) => ({
    orderId: uuid.parse(d.orderId),
    accessToken: uuid.parse(d.accessToken),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("ticket_orders")
      .select("id, event_id, ticket_type_id, buyer_name")
      .eq("id", data.orderId)
      .eq("access_token", data.accessToken)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");

    const [{ data: ev }, { data: type }, { data: attendees }] = await Promise.all([
      supabaseAdmin.from("events").select("name, event_date, event_time, location").eq("id", order.event_id).maybeSingle(),
      supabaseAdmin.from("ticket_types").select("name").eq("id", order.ticket_type_id).maybeSingle(),
      supabaseAdmin.from("ticket_attendees").select("qr_code, full_name").eq("order_id", order.id).order("created_at", { ascending: true }),
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
    return {
      base64: Buffer.from(bytes).toString("base64"),
      filename: `tickets-${order.id.slice(0, 8)}.pdf`,
    };
  });
export const getPublicTicketPdf = createServerFn({ method: "POST" })
  .validator((d: { ticketCode: string }) => ({ ticketCode: z.string().min(8).max(120).parse(d.ticketCode) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: attendee, error: aErr } = await supabaseAdmin
      .from("ticket_attendees")
      .select("order_id, event_id, qr_code, full_name")
      .eq("qr_code", data.ticketCode)
      .maybeSingle();
    if (aErr || !attendee) throw new Error("Ticket not found");

    const [{ data: order }, { data: ev }] = await Promise.all([
      supabaseAdmin.from("ticket_orders")
        .select("id, ticket_type_id").eq("id", attendee.order_id).maybeSingle(),
      supabaseAdmin.from("events")
        .select("name, event_date, event_time, location").eq("id", attendee.event_id).maybeSingle(),
    ]);
    if (!order) throw new Error("Order not found");

    const { data: type } = await supabaseAdmin
      .from("ticket_types")
      .select("name")
      .eq("id", order.ticket_type_id)
      .maybeSingle();

    const { buildTicketPdf } = await import("@/lib/tickets-emails.server");
    const when = ev?.event_date
      ? new Date(`${ev.event_date}T${(ev.event_time as string) ?? "00:00"}`).toLocaleString(undefined, { dateStyle: "full", timeStyle: ev.event_time ? "short" : undefined })
      : null;
    const bytes = await buildTicketPdf({
      eventName: ev?.name ?? "Event",
      eventWhen: when,
      eventLocation: ev?.location ?? null,
      ticketName: type?.name ?? "Admission",
      attendeeName: attendee.full_name ?? "Guest",
      orderId: order.id,
      attendees: [{ qr_code: attendee.qr_code, full_name: attendee.full_name }],
    });
    const base64 = Buffer.from(bytes).toString("base64");
    return { base64, filename: `ticket-${attendee.qr_code.slice(0, 8)}.pdf` };
  });


// ---------- Owner: check in by QR code (scanner flow) ----------
export const checkInByQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { eventId: string; qrCode: string }) => ({
    eventId: uuid.parse(d.eventId),
    qrCode: z.string().min(4).max(200).parse(d.qrCode),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the caller owns this event before any mutation.
    const { data: ev } = await supabase
      .from("events")
      .select("owner_id")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev || ev.owner_id !== userId) {
      return { ok: false as const, type: "unauthorized" as const };
    }

    const { data: attendee } = await supabase
      .from("ticket_attendees")
      .select("id, event_id, full_name, email, qr_code, checked_in_at, order_id")
      .eq("qr_code", data.qrCode)
      .maybeSingle();

    if (!attendee) return { ok: false as const, type: "invalid" as const };
    if (attendee.event_id !== data.eventId) return { ok: false as const, type: "wrong_event" as const };

    const { data: order } = await supabase
      .from("ticket_orders")
      .select("status, ticket_type_id, ticket_types(name)")
      .eq("id", attendee.order_id)
      .maybeSingle();

    if (!isCheckInEligibleOrderStatus(order?.status)) {
      return { ok: false as const, type: "cancelled" as const };
    }

    const typeName: string = (order?.ticket_types as { name?: string } | null)?.name ?? "Admission";
    const attendeeOut = { id: attendee.id, full_name: attendee.full_name, email: attendee.email };

    if (attendee.checked_in_at) {
      return {
        ok: false as const,
        type: "already_checked_in" as const,
        attendee: attendeeOut,
        typeName,
        checkedInAt: attendee.checked_in_at,
      };
    }

    const now = new Date().toISOString();
    const { data: checkedIn, error } = await supabase
      .from("ticket_attendees")
      .update({ checked_in_at: now })
      .eq("id", attendee.id)
      .is("checked_in_at", null)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false as const, type: "invalid" as const };
    if (!checkedIn) {
      const { data: latest } = await supabase
        .from("ticket_attendees")
        .select("checked_in_at")
        .eq("id", attendee.id)
        .maybeSingle();
      return {
        ok: false as const,
        type: "already_checked_in" as const,
        attendee: attendeeOut,
        typeName,
        checkedInAt: latest?.checked_in_at ?? now,
      };
    }

    return {
      ok: true as const,
      type: "success" as const,
      attendee: attendeeOut,
      typeName,
      checkedInAt: now,
    };
  });

// ---------- Owner: load check-in page data (event + attendees) ----------
export const getCheckinData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { eventId: string }) => ({ eventId: uuid.parse(d.eventId) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: event, error: eErr } = await supabase
      .from("events")
      .select("id, name, event_date, event_time, location, owner_id, tickets_enabled")
      .eq("id", data.eventId)
      .maybeSingle();
    if (eErr) throw new Error(eErr.message);
    if (!event) return { authorized: false as const, event: null, attendees: [] };
    if (event.owner_id !== userId) return { authorized: false as const, event: null, attendees: [] };

    const { data: attendees, error: aErr } = await supabase
      .from("ticket_attendees")
      .select("id, full_name, email, qr_code, checked_in_at, order_id, ticket_orders(ticket_type_id, ticket_types(name))")
      .eq("event_id", data.eventId)
      .order("full_name", { ascending: true })
      .limit(2000);
    if (aErr) throw new Error(aErr.message);

    return { authorized: true as const, event, attendees: attendees ?? [] };
  });


// ---------- Owner: generate a check-in access token ----------
const GenerateTokenInput = z.object({
  eventId: uuid,
  label: z.string().max(80).optional(),
  expiresInHours: z.number().int().min(1).max(168).default(24), // up to 7 days
});
export const generateCheckinToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => GenerateTokenInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify caller owns this event
    const { data: ev } = await supabase.from("events").select("owner_id").eq("id", data.eventId).maybeSingle();
    if (!ev || ev.owner_id !== userId) throw new Error("Not authorized");

    // Generate a cryptographically random token
    const { randomBytes, createHash } = await import("crypto");
    const plain = randomBytes(24).toString("hex"); // 48 hex chars
    const tokenHash = createHash("sha256").update(plain).digest("hex");

    const expiresAt = new Date(Date.now() + data.expiresInHours * 3_600_000).toISOString();

    const { data: row, error } = await supabase.from("checkin_tokens").insert({
      event_id: data.eventId,
      token_hash: tokenHash,
      label: data.label ?? null,
      expires_at: expiresAt,
      created_by: userId,
    }).select("id, label, expires_at, created_at").single();
    if (error) throw new Error(error.message);

    return { id: row.id, plainToken: plain, label: row.label, expiresAt: row.expires_at, createdAt: row.created_at };
  });

// ---------- Owner: list check-in tokens for an event ----------
export const listCheckinTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { eventId: string }) => ({ eventId: uuid.parse(d.eventId) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev } = await supabase.from("events").select("owner_id").eq("id", data.eventId).maybeSingle();
    if (!ev || ev.owner_id !== userId) throw new Error("Not authorized");

    const { data: rows, error } = await supabase
      .from("checkin_tokens")
      .select("id, label, expires_at, revoked_at, created_at")
      .eq("event_id", data.eventId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Owner: revoke a check-in token ----------
export const revokeCheckinToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { tokenId: string }) => ({ tokenId: uuid.parse(d.tokenId) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Ownership check with the authenticated client (subject to RLS on SELECT).
    const { data: token } = await supabase.from("checkin_tokens").select("event_id, created_by").eq("id", data.tokenId).maybeSingle();
    if (!token) throw new Error("Token not found");
    if (token.created_by !== userId) {
      const { data: ev } = await supabase.from("events").select("owner_id").eq("id", token.event_id).maybeSingle();
      if (!ev || ev.owner_id !== userId) throw new Error("Not authorized");
    }
    // Use service-role client for the write so the UPDATE does not depend on
    // an RLS UPDATE policy being granted to authenticated users.  The trigger
    // `checkin_tokens_immutable_cols_trigger` still prevents any mutation of
    // event_id, token_hash, or created_by at the database level.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("checkin_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.tokenId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Staff (token-based): load check-in data ----------
const TokenCheckinInput = z.object({
  eventId: uuid,
  token: z.string().min(8).max(120),
});
export const getCheckinDataWithToken = createServerFn({ method: "GET" })
  .validator((d: unknown) => TokenCheckinInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash } = await import("crypto");
    const tokenHash = createHash("sha256").update(data.token).digest("hex");

    const { data: tokenRow } = await supabaseAdmin
      .from("checkin_tokens")
      .select("id, event_id, expires_at, revoked_at")
      .eq("token_hash", tokenHash)
      .eq("event_id", data.eventId)
      .maybeSingle();

    if (!tokenRow) return { authorized: false as const, reason: "invalid" as const, event: null, attendees: [] };
    if (tokenRow.revoked_at) return { authorized: false as const, reason: "revoked" as const, event: null, attendees: [] };
    if (new Date(tokenRow.expires_at) < new Date()) return { authorized: false as const, reason: "expired" as const, event: null, attendees: [] };

    const { data: event, error: eErr } = await supabaseAdmin
      .from("events")
      .select("id, name, event_date, event_time, location")
      .eq("id", data.eventId)
      .maybeSingle();
    if (eErr || !event) return { authorized: false as const, reason: "invalid" as const, event: null, attendees: [] };

    const { data: attendees } = await supabaseAdmin
      .from("ticket_attendees")
      .select("id, full_name, email, qr_code, checked_in_at, order_id, ticket_orders(ticket_type_id, ticket_types(name))")
      .eq("event_id", data.eventId)
      .order("full_name", { ascending: true })
      .limit(2000);

    return { authorized: true as const, event, attendees: attendees ?? [] };
  });

// ---------- Staff (token-based): check in by QR code ----------
const TokenCheckInInput = z.object({
  eventId: uuid,
  qrCode: z.string().min(4).max(200),
  token: z.string().min(8).max(120),
});
export const checkInByQrCodeWithToken = createServerFn({ method: "POST" })
  .validator((d: unknown) => TokenCheckInInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash } = await import("crypto");
    const tokenHash = createHash("sha256").update(data.token).digest("hex");

    const { data: tokenRow } = await supabaseAdmin
      .from("checkin_tokens")
      .select("id, event_id, expires_at, revoked_at")
      .eq("token_hash", tokenHash)
      .eq("event_id", data.eventId)
      .maybeSingle();

    if (!tokenRow || tokenRow.revoked_at || new Date(tokenRow.expires_at) < new Date()) {
      return { ok: false as const, type: "unauthorized" as const };
    }

    const { data: attendee } = await supabaseAdmin
      .from("ticket_attendees")
      .select("id, event_id, full_name, email, qr_code, checked_in_at, order_id")
      .eq("qr_code", data.qrCode)
      .maybeSingle();

    if (!attendee) return { ok: false as const, type: "invalid" as const };
    if (attendee.event_id !== data.eventId) return { ok: false as const, type: "wrong_event" as const };

    const { data: order } = await supabaseAdmin
      .from("ticket_orders")
      .select("status, ticket_type_id, ticket_types(name)")
      .eq("id", attendee.order_id)
      .maybeSingle();

    if (!isCheckInEligibleOrderStatus(order?.status)) {
      return { ok: false as const, type: "cancelled" as const };
    }

    const typeName: string = (order?.ticket_types as { name?: string } | null)?.name ?? "Admission";
    const attendeeOut = { id: attendee.id, full_name: attendee.full_name, email: attendee.email };

    if (attendee.checked_in_at) {
      return {
        ok: false as const,
        type: "already_checked_in" as const,
        attendee: attendeeOut,
        typeName,
        checkedInAt: attendee.checked_in_at,
      };
    }

    const now = new Date().toISOString();
    const { data: checkedIn, error } = await supabaseAdmin
      .from("ticket_attendees")
      .update({ checked_in_at: now })
      .eq("id", attendee.id)
      .is("checked_in_at", null)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false as const, type: "invalid" as const };
    if (!checkedIn) {
      const { data: latest } = await supabaseAdmin
        .from("ticket_attendees")
        .select("checked_in_at")
        .eq("id", attendee.id)
        .maybeSingle();
      return {
        ok: false as const,
        type: "already_checked_in" as const,
        attendee: attendeeOut,
        typeName,
        checkedInAt: latest?.checked_in_at ?? now,
      };
    }

    return {
      ok: true as const,
      type: "success" as const,
      attendee: attendeeOut,
      typeName,
      checkedInAt: now,
    };
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
