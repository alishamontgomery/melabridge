import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BookingStage, ConfirmationRule } from "./booking-stages";

type NewBookingInput = {
  vendorId: string;
  title: string;
  category: string;
  eventId?: string | null;
};

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: NewBookingInput) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: booking, error } = await supabase
      .from("vendor_bookings")
      .insert({
        planner_id: userId,
        vendor_id: data.vendorId,
        title: data.title,
        category: data.category,
        event_id: data.eventId ?? null,
        current_stage: "saved",
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("vendor_booking_events").insert({
      booking_id: booking.id,
      stage: "saved",
      actor_id: userId,
      note: "Vendor saved",
    });
    return booking;
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
    if (e1) throw new Error(e1.message);
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
      if (e2) throw new Error(e2.message);
      vendor = v ?? [];
    }
    return { planner: planner ?? [], vendor };
  });

export const getBooking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: booking, error } = await supabase
      .from("vendor_bookings")
      .select("*, vendor_profiles!vendor_bookings_vendor_id_fkey(id, business_name, business_category, user_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking) throw new Error("Booking not found");
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
  .inputValidator((data: { bookingId: string; stage: "cancelled" | "no_response" | "lost"; note?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!EXCEPTION_STAGES.includes(data.stage)) throw new Error("Invalid exception stage");
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId,
      stage: data.stage,
      actor_id: userId,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reopenBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Clear terminal timestamps; the recompute trigger will re-derive the correct stage.
    const { error: uErr } = await supabase
      .from("vendor_bookings")
      .update({ cancelled_at: null, no_response_at: null, lost_at: null })
      .eq("id", data.bookingId);
    if (uErr) throw new Error(uErr.message);
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId,
      stage: "contacted",
      actor_id: userId,
      note: "Booking reopened",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markQuoteViewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId, stage: "quote_viewed", actor_id: userId, note: "Client opened the quote",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markQuoteAccepted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId, stage: "quote_accepted", actor_id: userId, note: "Client accepted the quote",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const requestReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId, stage: "review_requested", actor_id: userId, note: "Review request sent",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId, stage: "reviewed", actor_id: userId, note: "Review submitted",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string; amount: number }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: b } = await supabase.from("vendor_bookings")
      .select("deposit_paid_amount, total_paid")
      .eq("id", data.bookingId).maybeSingle();
    if (!b) throw new Error("Not found");
    await supabase.from("vendor_bookings").update({
      deposit_paid_amount: Number(b.deposit_paid_amount ?? 0) + data.amount,
      total_paid: Number(b.total_paid ?? 0) + data.amount,
    }).eq("id", data.bookingId);
    await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId, stage: "deposit_paid", actor_id: userId,
      note: `Deposit recorded: $${data.amount.toLocaleString()}`,
      metadata: { amount: data.amount },
    });
    return { ok: true };
  });

export const recordQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string; amount: number; depositAmount?: number | null }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("vendor_bookings").update({
      quote_amount: data.amount,
      deposit_amount: data.depositAmount ?? null,
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
  .inputValidator((data: { confirmationRule: ConfirmationRule; requiresDeposit: boolean }) => data)
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
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId,
      stage: "cancelled",
      actor_id: userId,
      note: data.reason ?? "Booking cancelled",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordSchedulePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { scheduleId: string; amount: number }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("booking_payment_schedule")
      .select("id, booking_id, amount, paid_amount, label")
      .eq("id", data.scheduleId).maybeSingle();
    if (!row) throw new Error("Instalment not found");
    const newPaid = Number(row.paid_amount ?? 0) + data.amount;
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
        total_paid: Number(b.total_paid ?? 0) + data.amount,
        deposit_paid_amount: isDeposit
          ? Number(b.deposit_paid_amount ?? 0) + data.amount
          : b.deposit_paid_amount,
      }).eq("id", row.booking_id);
    }
    await supabase.from("vendor_booking_events").insert({
      booking_id: row.booking_id,
      stage: /deposit/i.test(row.label) ? "deposit_paid" : "booked",
      actor_id: userId,
      note: `${row.label} payment: $${data.amount.toLocaleString()}`,
      metadata: { schedule_id: row.id, amount: data.amount },
    });
    return { ok: true };
  });
