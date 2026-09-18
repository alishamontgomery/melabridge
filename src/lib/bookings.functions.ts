import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BookingStage, ConfirmationRule } from "./booking-stages";
import {
  InquiryInput,
  shouldNotifyVendor,
  sanitizeInquiryError,
  type InquiryRpcResult,
} from "./inquiry-validation";

/**
 * Asserts the calling user is a party to the booking (planner OR vendor owner).
 * Throws "Forbidden" with a 403-style error if not.
 * Returns the vendor's user_id for callers that need it.
 */
async function assertBookingParty(
  supabase: any,
  userId: string,
  bookingId: string,
): Promise<{ planner_id: string; vendorUserId: string | null }> {
  const { data: b } = await supabase
    .from("vendor_bookings")
    .select("planner_id, vendor_profiles!vendor_bookings_vendor_id_fkey(user_id)")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b) throw new Error("Booking not found");
  const vendorUserId: string | null = (b as any).vendor_profiles?.user_id ?? null;
  if (b.planner_id !== userId && vendorUserId !== userId) {
    throw new Error("Forbidden: you are not a party to this booking");
  }
  return { planner_id: b.planner_id, vendorUserId };
}

/** Validates a monetary amount is a positive finite number within sane bounds. */
function assertValidAmount(amount: unknown, label = "Amount") {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) {
    throw new Error(`${label} must be a positive number up to $10,000,000`);
  }
  return n;
}

/**
 * Server-side inquiry submission.
 *
 * Delegates the multi-row write to a single SECURITY DEFINER RPC
 * (`submit_vendor_inquiry`) that atomically creates the planner-side lead
 * (`vendor_bookings`) and the vendor-side request (`calendar_booking_requests`),
 * enforcing caller-role, public/onboarded-vendor, self-inquiry, date, and length
 * validation server-side. The RPC is idempotent under concurrent retries via a
 * deterministic idempotency key + unique index — no read-then-insert or
 * compensating delete.
 *
 * This function validates input shape with zod, invokes the RPC, and — only
 * after the lead is durably created — fires a best-effort, non-critical vendor
 * notification. A failed notification never rolls back the inquiry.
 */
export const submitInquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => InquiryInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      // The function isn't in the generated types yet; cast the name.
      "submit_vendor_inquiry" as any,
      {
        p_vendor_profile_id: data.vendorId,
        p_event_name: data.eventName,
        p_event_date: data.eventDate,
        p_event_type: data.eventType ?? null,
        p_message: data.message ?? null,
      },
    );
    if (rpcError) {
      console.error("[submitInquiry] Inquiry RPC failed");
      throw new Error(sanitizeInquiryError(rpcError.message));
    }

    const result = (rpcResult ?? {}) as InquiryRpcResult;

    // Idempotent short-circuit: an active inquiry already exists — nothing new
    // to create and no notification to send.
    if (!shouldNotifyVendor(result)) {
      return {
        ok: true,
        duplicate: true,
        bookingId: result.booking_id ?? null,
        requestId: result.request_id ?? null,
      };
    }

    // Non-critical notification: the lead is already durably persisted by the
    // RPC. A failure here is logged and swallowed — it must not undo the inquiry.
    try {
      const vendorUserId = result.vendor_user_id;
      if (!vendorUserId) throw new Error("Missing vendor recipient for notification");
      const { data: planner } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", userId)
        .maybeSingle();
      const plannerName =
        planner?.display_name?.trim() || planner?.email?.split("@")[0] || "A planner";
      const { dispatchNotification } = await import("./notification-delivery.server");
      await dispatchNotification({
        userId: vendorUserId,
        category: "booking",
        title: `New inquiry from ${plannerName}`,
        body: `${plannerName} sent an inquiry about ${data.eventName}. Review the details and follow up directly.`,
        href: "/vendor",
        entityType: "booking",
        entityId: result.booking_id ?? null,
        idempotencyKey: result.booking_id ? `booking-inquiry:${result.booking_id}` : undefined,
      });
    } catch {
      console.warn("[submitInquiry] Vendor notification could not be created");
    }

    return {
      ok: true,
      duplicate: false,
      bookingId: result.booking_id ?? null,
      requestId: result.request_id ?? null,
    };
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Planner-side bookings
    const { data: planner, error: e1 } = await supabase
      .from("vendor_bookings")
      .select("*, vendor_profiles!vendor_bookings_vendor_id_fkey(business_name, business_category, user_id)")
      .eq("planner_id", userId)
      .order("updated_at", { ascending: false });
    if (e1) throw new Error("Failed to load bookings");
    // Vendor-side (as the vendor)
    const { data: vendorMe } = await supabase
      .from("vendor_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    let vendor: typeof planner = [];
    if (vendorMe?.id) {
      const { data: v, error: e2 } = await supabase
        .from("vendor_bookings")
        .select("*, vendor_profiles!vendor_bookings_vendor_id_fkey(business_name, business_category, user_id)")
        .eq("vendor_id", vendorMe.id)
        .order("updated_at", { ascending: false });
      if (e2) throw new Error("Failed to load bookings");
      vendor = v ?? [];
    }
    return { planner: planner ?? [], vendor };
  });

/**
 * Planner-facing history of marketplace inquiries.
 *
 * calendar_booking_requests stores the vendor owner's user id, while the public
 * profile route uses the vendor profile id. Resolve the names here so the
 * browser never needs broader access to vendor_profiles.
 */
export const listMyInquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: requests, error } = await supabase
      .from("calendar_booking_requests")
      .select(
        "id, vendor_id, event_name, event_type, requested_start, created_at, updated_at, status, message, alternate_start, alternate_end, alternate_message",
      )
      .eq("planner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Failed to load inquiries");
    if (!requests?.length) return [];

    const vendorUserIds = [...new Set(requests.map((request) => request.vendor_id))];
    // Requests are already scoped to the authenticated planner above. Use the
    // server-only client solely to resolve those vendors' public display fields;
    // vendor_profiles_public intentionally omits the owner user id needed to join.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("vendor_profiles")
      .select("id, user_id, business_name")
      .in("user_id", vendorUserIds);
    if (profileError) throw new Error("Failed to load inquiry vendors");

    const profileByUserId = new Map(
      (profiles ?? []).map((profile) => [profile.user_id, profile]),
    );

    return requests.map((request) => {
      const profile = profileByUserId.get(request.vendor_id);
      return {
        ...request,
        vendor_name: profile?.business_name ?? "Vendor",
        vendor_profile_id: profile?.id ?? null,
      };
    });
  });

export const getBooking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: booking, error } = await supabase
      .from("vendor_bookings")
      .select("*, vendor_profiles!vendor_bookings_vendor_id_fkey(id, business_name, business_category, user_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error("Failed to load booking");
    if (!booking) throw new Error("Booking not found");
    // Ownership check — caller must be the planner or the vendor
    const vendorUserId = (booking as any).vendor_profiles?.user_id;
    if (booking.planner_id !== userId && vendorUserId !== userId) {
      throw new Error("Forbidden");
    }
    const { data: events } = await supabase
      .from("vendor_booking_events")
      .select("*")
      .eq("booking_id", data.id)
      .order("occurred_at", { ascending: true });
    const { data: invoices } = await supabase
      .from("booking_invoices")
      .select("*")
      .eq("booking_id", data.id)
      .order("issued_at", { ascending: false });
    const { data: schedule } = await supabase
      .from("booking_payment_schedule")
      .select("*")
      .eq("booking_id", data.id)
      .order("sort_order", { ascending: true });
    return { booking, events: events ?? [], invoices: invoices ?? [], schedule: schedule ?? [] };
  });

/** Only exception transitions are accepted from the client. Normal stages are derived from timestamps. */
const EXCEPTION_STAGES: BookingStage[] = ["cancelled", "no_response", "lost"];

export const markException = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { bookingId: string; stage: "cancelled" | "no_response" | "lost"; note?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!EXCEPTION_STAGES.includes(data.stage)) throw new Error("Invalid exception stage");
    await assertBookingParty(supabase, userId, data.bookingId);
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId,
      stage: data.stage,
      actor_id: userId,
      note: data.note ?? null,
    });
    if (error) throw new Error("Failed to record event");
    return { ok: true };
  });

/**
 * Move a lead through the product's non-financial CRM stages.
 * The database keeps the legacy stage enum for compatibility, while the UI
 * deliberately does not expose quotes, deposits, contracts, or reviews.
 */
export const advanceLeadStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { bookingId: string; stage: "quote_sent" | "booked" }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBookingParty(supabase, userId, data.bookingId);

    const { error: updateError } = await supabase
      .from("vendor_bookings")
      .update({ current_stage: data.stage })
      .eq("id", data.bookingId);
    if (updateError) throw new Error("Failed to update lead stage");

    const { error: eventError } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId,
      stage: data.stage,
      actor_id: userId,
      note: data.stage === "booked" ? "Lead marked as hired" : "Lead marked as interested",
    });
    if (eventError) throw new Error("Failed to record lead stage");

    return { ok: true };
  });

export const reopenBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { bookingId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBookingParty(supabase, userId, data.bookingId);
    // Clear terminal timestamps; the recompute trigger will re-derive the correct stage.
    const { error: uErr } = await supabase
      .from("vendor_bookings")
      .update({ cancelled_at: null, no_response_at: null, lost_at: null })
      .eq("id", data.bookingId);
    if (uErr) throw new Error("Failed to reopen booking");
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId,
      stage: "contacted",
      actor_id: userId,
      note: "Booking reopened",
    });
    if (error) throw new Error("Failed to record event");
    return { ok: true };
  });

export const markQuoteViewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { bookingId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBookingParty(supabase, userId, data.bookingId);
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId, stage: "quote_viewed", actor_id: userId, note: "Client opened the quote",
    });
    if (error) throw new Error("Failed to record event");
    return { ok: true };
  });

export const markQuoteAccepted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { bookingId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBookingParty(supabase, userId, data.bookingId);
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId, stage: "quote_accepted", actor_id: userId, note: "Client accepted the quote",
    });
    if (error) throw new Error("Failed to record event");
    return { ok: true };
  });

export const requestReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { bookingId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBookingParty(supabase, userId, data.bookingId);
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId, stage: "review_requested", actor_id: userId, note: "Review request sent",
    });
    if (error) throw new Error("Failed to record event");
    return { ok: true };
  });

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { bookingId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBookingParty(supabase, userId, data.bookingId);
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId, stage: "reviewed", actor_id: userId, note: "Review submitted",
    });
    if (error) throw new Error("Failed to record event");
    return { ok: true };
  });

export const recordDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { bookingId: string; amount: number }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBookingParty(supabase, userId, data.bookingId);
    const safeAmount = assertValidAmount(data.amount, "Amount");
    const { data: b } = await supabase.from("vendor_bookings")
      .select("deposit_paid_amount, total_paid")
      .eq("id", data.bookingId).maybeSingle();
    if (!b) throw new Error("Not found");
    await supabase.from("vendor_bookings").update({
      deposit_paid_amount: Number(b.deposit_paid_amount ?? 0) + safeAmount,
      total_paid: Number(b.total_paid ?? 0) + safeAmount,
    }).eq("id", data.bookingId);
    await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId, stage: "deposit_paid", actor_id: userId,
      note: `Payment recorded: $${safeAmount.toLocaleString()}`,
      metadata: { amount: safeAmount },
    });
    return { ok: true };
  });

export const recordQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { bookingId: string; amount: number; depositAmount?: number | null }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBookingParty(supabase, userId, data.bookingId);
    const safeAmount = data.amount > 0 ? assertValidAmount(data.amount, "Quote amount") : 0;
    const safeDeposit = data.depositAmount != null && data.depositAmount > 0
      ? assertValidAmount(data.depositAmount, "Deposit amount") : null;
    await supabase.from("vendor_bookings").update({
      quote_amount: safeAmount || null,
      deposit_amount: safeDeposit,
      quote_sent_at: new Date().toISOString(),
    }).eq("id", data.bookingId);
    await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId, stage: "quote_sent", actor_id: userId,
      note: `Quote sent: $${data.amount.toLocaleString()}`,
    });
    return { ok: true };
  });

export const getVendorSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: vp } = await supabase.from("vendor_profiles")
      .select("id").eq("user_id", userId).maybeSingle();
    if (!vp?.id) return null;
    const { data } = await supabase.from("vendor_booking_settings")
      .select("*").eq("vendor_id", vp.id).maybeSingle();
    if (!data) {
      const { data: created } = await supabase.from("vendor_booking_settings")
        .insert({ vendor_id: vp.id }).select("*").single();
      return created;
    }
    return data;
  });

export const updateVendorSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { confirmationRule: ConfirmationRule; requiresDeposit: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: vp } = await supabase.from("vendor_profiles")
      .select("id").eq("user_id", userId).maybeSingle();
    if (!vp?.id) throw new Error("Complete your vendor profile first");
    const { error } = await supabase.from("vendor_booking_settings").upsert({
      vendor_id: vp.id,
      confirmation_rule: data.confirmationRule,
      requires_deposit: data.requiresDeposit,
    });
    if (error) throw new Error("Failed to save vendor settings");
    return { ok: true };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { bookingId: string; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBookingParty(supabase, userId, data.bookingId);
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId,
      stage: "cancelled",
      actor_id: userId,
      note: data.reason ?? "Booking cancelled",
    });
    if (error) throw new Error("Failed to record event");
    return { ok: true };
  });

export const recordSchedulePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { scheduleId: string; amount: number }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const safeAmount = assertValidAmount(data.amount, "Payment amount");
    const { data: row } = await supabase.from("booking_payment_schedule")
      .select("id, booking_id, amount, paid_amount, label")
      .eq("id", data.scheduleId).maybeSingle();
    if (!row) throw new Error("Instalment not found");
    // Ownership check via parent booking
    await assertBookingParty(supabase, userId, row.booking_id);
    const newPaid = Number(row.paid_amount ?? 0) + safeAmount;
    const status = newPaid >= Number(row.amount) ? "paid" : "pending";
    await supabase.from("booking_payment_schedule")
      .update({ paid_amount: newPaid, status })
      .eq("id", row.id);
    // Also record on the booking totals + event log
    const { data: b } = await supabase.from("vendor_bookings")
      .select("total_paid, deposit_paid_amount").eq("id", row.booking_id).maybeSingle();
    if (b) {
      const isDeposit = /deposit/i.test(row.label);
      await supabase.from("vendor_bookings").update({
        total_paid: Number(b.total_paid ?? 0) + safeAmount,
        deposit_paid_amount: isDeposit
          ? Number(b.deposit_paid_amount ?? 0) + safeAmount
          : b.deposit_paid_amount,
      }).eq("id", row.booking_id);
    }
    await supabase.from("vendor_booking_events").insert({
      booking_id: row.booking_id,
      stage: /deposit/i.test(row.label) ? "deposit_paid" : "booked",
      actor_id: userId,
      note: `${row.label} payment: $${safeAmount.toLocaleString()}`,
      metadata: { schedule_id: row.id, amount: safeAmount },
    });
    return { ok: true };
  });
