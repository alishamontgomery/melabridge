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
    return { booking, events: events ?? [] };
  });

const ALLOWED_MANUAL: BookingStage[] = [
  "contacted", "consultation_scheduled", "quote_sent", "quote_under_review",
  "contract_sent", "contract_signed", "deposit_paid", "completed",
  "review_requested", "reviewed",
];

export const advanceStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string; stage: BookingStage; note?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.stage === "booked") {
      // Only allowed under manual confirmation rule
      const { data: b } = await supabase
        .from("vendor_bookings")
        .select("vendor_id")
        .eq("id", data.bookingId)
        .maybeSingle();
      if (!b) throw new Error("Booking not found");
      const { data: settings } = await supabase
        .from("vendor_booking_settings")
        .select("confirmation_rule")
        .eq("vendor_id", b.vendor_id)
        .maybeSingle();
      if (settings?.confirmation_rule !== "manual") {
        throw new Error("Bookings can only be confirmed automatically once the vendor's requirements are met.");
      }
      await supabase.from("vendor_bookings")
        .update({ current_stage: "booked", confirmed_at: new Date().toISOString() })
        .eq("id", data.bookingId);
    } else if (!ALLOWED_MANUAL.includes(data.stage) && data.stage !== "saved") {
      throw new Error("Invalid stage");
    }
    const { error } = await supabase.from("vendor_booking_events").insert({
      booking_id: data.bookingId,
      stage: data.stage,
      actor_id: userId,
      note: data.note ?? null,
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
