import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* --- Settings --- */

const CALENDAR_SETTINGS_FIELDS =
  "user_id,buffer_before_minutes,buffer_after_minutes,max_events_per_day,block_travel_days,vacation_start,vacation_end,timezone,created_at,updated_at";

const settingsSchema = z.object({
  buffer_before_minutes: z.number().int().min(0).max(720),
  buffer_after_minutes: z.number().int().min(0).max(720),
  max_events_per_day: z.number().int().min(1).max(50),
  block_travel_days: z.boolean(),
  vacation_start: z.string().nullable().optional(),
  vacation_end: z.string().nullable().optional(),
  timezone: z.string().optional(),
});

export const getCalendarSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("calendar_settings")
      .select(CALENDAR_SETTINGS_FIELDS)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? {
        user_id: context.userId,
        buffer_before_minutes: 30,
        buffer_after_minutes: 30,
        max_events_per_day: 2,
        block_travel_days: false,
        vacation_start: null,
        vacation_end: null,
        timezone: "UTC",
      }
    );
  });

/**
 * Lightweight upsert for just the timezone field in calendar_settings.
 * Used by the timezone selector in Settings without requiring all other fields.
 */
export const saveTimezone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ timezone: z.string().min(1).max(100) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calendar_settings")
      .upsert(
        { user_id: context.userId, timezone: data.timezone },
        { onConflict: "user_id" }
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCalendarSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calendar_settings")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --- External calendar feed --- */

export const getCalendarFeedToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("calendar_settings")
      .select("calendar_feed_token")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { token: data?.calendar_feed_token ?? null };
  });

export const generateCalendarFeedToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const token = crypto.randomUUID();
    const { error } = await context.supabase
      .from("calendar_settings")
      .upsert(
        { user_id: context.userId, calendar_feed_token: token },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { token };
  });

/* --- Availability --- */

export const listAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("calendar_availability")
      .select("*")
      .eq("user_id", context.userId)
      .order("weekday")
      .order("start_time");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const availabilitySchema = z.object({
  id: z.string().uuid().optional(),
  weekday: z.number().int().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
  is_active: z.boolean().default(true),
});

export const upsertAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => availabilitySchema.parse(input))
  .handler(async ({ data, context }) => {
    const row = { ...data, user_id: context.userId };
    const { data: out, error } = await context.supabase
      .from("calendar_availability")
      .upsert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

export const deleteAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calendar_availability")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --- Blocked dates --- */

export const listBlockedDates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("calendar_blocked_dates")
      .select("*")
      .eq("user_id", context.userId)
      .order("start_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const blockedSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  reason: z.enum(["day_off", "vacation", "travel"]).default("day_off"),
  notes: z.string().nullable().optional(),
});

export const addBlockedDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => blockedSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calendar_blocked_dates")
      .insert({ ...data, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBlockedDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calendar_blocked_dates")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --- Events --- */

const eventStatus = z.enum(["inquiry", "pending", "confirmed", "completed", "cancelled", "declined"]);

export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        status: eventStatus.optional(),
        event_type: z.string().optional(),
        q: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("calendar_events")
      .select("*")
      .or(`vendor_id.eq.${context.userId},planner_id.eq.${context.userId}`)
      .order("starts_at", { ascending: true });
    if (data.from) q = q.gte("starts_at", data.from);
    if (data.to) q = q.lte("starts_at", data.to);
    if (data.status) q = q.eq("status", data.status);
    if (data.event_type) q = q.eq("event_type", data.event_type);
    if (data.q) q = q.or(`event_name.ilike.%${data.q}%,client_name.ilike.%${data.q}%,venue_name.ilike.%${data.q}%`);
    const { data: out, error } = await q;
    if (error) throw new Error(error.message);
    return out ?? [];
  });

export const getEvent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: out, error } = await context.supabase
      .from("calendar_events")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!out) throw new Error("Event not found");
    return out;
  });

const eventInputSchema = z.object({
  id: z.string().uuid().optional(),
  event_name: z.string().min(1),
  event_type: z.string().nullable().optional(),
  client_name: z.string().nullable().optional(),
  venue_name: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  starts_at: z.string(),
  ends_at: z.string(),
  setup_minutes: z.number().int().min(0).default(0),
  breakdown_minutes: z.number().int().min(0).default(0),
  status: eventStatus.optional(),
  internal_notes: z.string().nullable().optional(),
  payment_status: z.string().nullable().optional(),
  contract_status: z.string().nullable().optional(),
  revenue_amount: z.number().nullable().optional(),
  planner_id: z.string().uuid().nullable().optional(),
});

/* --- Conflict check --- */

type ConflictReason = "overlap" | "setup_overlap" | "breakdown_overlap" | "buffer" | "blocked" | "vacation" | "max_per_day" | "travel";
type Conflict = { reason: ConflictReason; message: string; hard: boolean; eventId?: string };

async function computeConflicts(
  supabase: any,
  vendorId: string,
  startISO: string,
  endISO: string,
  setup: number,
  breakdown: number,
  excludeId?: string,
): Promise<Conflict[]> {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const conflicts: Conflict[] = [];

  // Settings & blocked dates
  const [{ data: settings }, { data: blocks }] = await Promise.all([
    supabase
      .from("calendar_settings")
      .select(CALENDAR_SETTINGS_FIELDS)
      .eq("user_id", vendorId)
      .maybeSingle(),
    supabase.from("calendar_blocked_dates").select("*").eq("user_id", vendorId),
  ]);

  const dateStr = start.toISOString().slice(0, 10);
  for (const b of blocks ?? []) {
    if (dateStr >= b.start_date && dateStr <= b.end_date) {
      conflicts.push({
        reason: b.reason === "vacation" ? "vacation" : "blocked",
        message: `Date is marked as ${b.reason.replace("_", " ")}${b.notes ? ` (${b.notes})` : ""}`,
        hard: true,
      });
    }
  }

  if (settings?.vacation_start && settings?.vacation_end) {
    if (dateStr >= settings.vacation_start && dateStr <= settings.vacation_end) {
      conflicts.push({ reason: "vacation", message: "Vacation mode is on for this date", hard: true });
    }
  }

  // Existing events same window (extended by setup/breakdown)
  const bufferBefore = settings?.buffer_before_minutes ?? 0;
  const bufferAfter = settings?.buffer_after_minutes ?? 0;
  const windowStart = new Date(start.getTime() - (setup + bufferBefore) * 60000);
  const windowEnd = new Date(end.getTime() + (breakdown + bufferAfter) * 60000);

  let q = supabase
    .from("calendar_events")
    .select("id, event_name, starts_at, ends_at, setup_minutes, breakdown_minutes, status")
    .eq("vendor_id", vendorId)
    .in("status", ["confirmed", "pending", "inquiry"])
    .lte("starts_at", windowEnd.toISOString())
    .gte("ends_at", windowStart.toISOString());
  if (excludeId) q = q.neq("id", excludeId);
  const { data: existing } = await q;

  for (const e of existing ?? []) {
    const es = new Date(new Date(e.starts_at).getTime() - (e.setup_minutes ?? 0) * 60000);
    const ee = new Date(new Date(e.ends_at).getTime() + (e.breakdown_minutes ?? 0) * 60000);
    if (es < end && ee > start) {
      conflicts.push({
        reason: "overlap",
        message: `Overlaps "${e.event_name}"`,
        hard: e.status === "confirmed",
        eventId: e.id,
      });
    }
  }

  // Max events per day
  if (settings?.max_events_per_day) {
    const dayStart = new Date(dateStr + "T00:00:00Z").toISOString();
    const dayEnd = new Date(dateStr + "T23:59:59Z").toISOString();
    let dq = supabase
      .from("calendar_events")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .in("status", ["confirmed"])
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd);
    if (excludeId) dq = dq.neq("id", excludeId);
    const { count } = await dq;
    if ((count ?? 0) >= settings.max_events_per_day) {
      conflicts.push({ reason: "max_per_day", message: `Max ${settings.max_events_per_day} events per day reached`, hard: true });
    }
  }

  return conflicts;
}

export const checkConflicts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        starts_at: z.string(),
        ends_at: z.string(),
        setup_minutes: z.number().int().min(0).default(0),
        breakdown_minutes: z.number().int().min(0).default(0),
        excludeId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return computeConflicts(
      context.supabase,
      context.userId,
      data.starts_at,
      data.ends_at,
      data.setup_minutes,
      data.breakdown_minutes,
      data.excludeId,
    );
  });

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => eventInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { id: _drop, ...rest } = data;
    const { data: out, error } = await context.supabase
      .from("calendar_events")
      .insert({ ...rest, vendor_id: context.userId, status: data.status ?? "pending" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

export const updateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => eventInputSchema.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: out, error } = await context.supabase
      .from("calendar_events")
      .update(rest)
      .eq("id", id)
      .eq("vendor_id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

export const cancelEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calendar_events")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("vendor_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calendar_events")
      .update({ status: "completed" })
      .eq("id", data.id)
      .eq("vendor_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), newStartsAt: z.string(), newEndsAt: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: src, error: e1 } = await context.supabase
      .from("calendar_events")
      .select("*")
      .eq("id", data.id)
      .eq("vendor_id", context.userId)
      .single();
    if (e1 || !src) throw new Error(e1?.message ?? "Not found");
    const { id: _drop, created_at: _c, updated_at: _u, ...rest } = src as any;
    const { data: out, error } = await context.supabase
      .from("calendar_events")
      .insert({ ...rest, starts_at: data.newStartsAt, ends_at: data.newEndsAt, status: "pending" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

/* --- Booking requests --- */

export const listBookingRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("calendar_booking_requests")
      .select("*")
      .or(`vendor_id.eq.${context.userId},planner_id.eq.${context.userId}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const requestSchema = z.object({
  vendor_id: z.string().uuid(),
  event_name: z.string().min(1),
  event_type: z.string().nullable().optional(),
  client_name: z.string().nullable().optional(),
  venue_name: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  requested_start: z.string(),
  requested_end: z.string(),
  message: z.string().nullable().optional(),
});

export const requestBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => requestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: out, error } = await context.supabase
      .from("calendar_booking_requests")
      .insert({ ...data, planner_id: context.userId, status: "pending" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

export const respondToBookingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["approve", "decline", "propose_alternate"]),
        alternate_start: z.string().optional(),
        alternate_end: z.string().optional(),
        alternate_message: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { dispatchNotification } = await import("./notification-delivery.server");
    const notify = (payload: Parameters<typeof dispatchNotification>[0]) =>
      dispatchNotification(payload).catch(() => {
        console.warn("[calendar] Notification delivery failed");
      });
    const { data: req, error: rErr } = await context.supabase
      .from("calendar_booking_requests")
      .select("*")
      .eq("id", data.id)
      .eq("vendor_id", context.userId)
      .single();
    if (rErr || !req) throw new Error(rErr?.message ?? "Not found");

    if (data.action === "approve") {
      const conflicts = await computeConflicts(
        context.supabase,
        context.userId,
        req.requested_start,
        req.requested_end,
        0,
        0,
      );
      const hard = conflicts.filter((c) => c.hard);
      if (hard.length) throw new Error(`Cannot approve: ${hard[0].message}`);

      const { data: booking, error: bErr } = await context.supabase
        .from("calendar_events")
        .insert({
          vendor_id: context.userId,
          planner_id: req.planner_id,
          event_name: req.event_name,
          event_type: req.event_type,
          client_name: req.client_name,
          venue_name: req.venue_name,
          address: req.address,
          starts_at: req.requested_start,
          ends_at: req.requested_end,
          status: "confirmed",
        })
        .select()
        .single();
      if (bErr) throw new Error(bErr.message);

      const { error: updateErr } = await context.supabase
        .from("calendar_booking_requests")
        .update({ status: "approved", booking_id: booking.id })
        .eq("id", data.id)
        .eq("vendor_id", context.userId);
      if (updateErr) throw new Error(updateErr.message);

      await notify({
        userId: req.planner_id,
        category: "calendar",
        title: "Booking approved",
        body: `${req.event_name} was confirmed.`,
        href: "/calendar",
      });
      return { ok: true, booking };
    }

    if (data.action === "decline") {
      // If the request was previously approved there is a linked calendar_events row.
      // Cancel that event first so the calendar stays consistent; do not leave a
      // "confirmed" event dangling after the request is declined.
      if (req.status === "approved" && req.booking_id) {
        const { error: evtErr } = await context.supabase
          .from("calendar_events")
          .update({ status: "cancelled" })
          .eq("id", req.booking_id)
          .eq("vendor_id", context.userId); // RLS double-check at the data layer
        if (evtErr) throw new Error(`Failed to cancel calendar event: ${evtErr.message}`);
      }

      // Update the request, clearing the booking_id linkage since the event is now cancelled.
      const { error: updateErr } = await context.supabase
        .from("calendar_booking_requests")
        .update({ status: "declined", booking_id: null })
        .eq("id", data.id)
        .eq("vendor_id", context.userId);
      if (updateErr) throw new Error(updateErr.message);

      const wasConfirmed = req.status === "approved";
      await notify({
        userId: req.planner_id,
        category: "calendar",
        title: wasConfirmed ? "Confirmed booking cancelled" : "Booking declined",
        body: wasConfirmed
          ? `${req.event_name} was cancelled by the vendor. Your calendar has been updated.`
          : `${req.event_name} was declined.`,
        href: "/calendar",
      });
      return { ok: true };
    }

    // propose_alternate
    if (!data.alternate_start || !data.alternate_end) throw new Error("Alternate date required");
    const { error: updateErr } = await context.supabase
      .from("calendar_booking_requests")
      .update({
        status: "alternate_proposed",
        alternate_start: data.alternate_start,
        alternate_end: data.alternate_end,
        alternate_message: data.alternate_message ?? null,
      })
      .eq("id", data.id)
      .eq("vendor_id", context.userId);
    if (updateErr) throw new Error(updateErr.message);
    await notify({
      userId: req.planner_id,
      category: "calendar",
      title: "Alternate date proposed",
      body: `${req.event_name}: vendor suggested a different time.`,
      href: "/calendar",
    });
    return { ok: true };
  });

/**
 * Simple status transitions for the vendor portal that don't require the full
 * respondToBookingRequest approval flow (conflict check + booking creation).
 *
 * Allowed transitions:
 *   - pending          → reset to "New" (vendor undo / reopen)
 *   - alternate_proposed → mark as "Responded" without proposing alternate dates
 *   - cancelled        → vendor cancels (only if not yet approved)
 *
 * Approved / declined transitions must go through respondToBookingRequest so that
 * conflict checks, calendar_events creation, and planner notifications are executed.
 */
export const updateBookingRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "alternate_proposed", "cancelled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { dispatchNotification } = await import("./notification-delivery.server");
    const notify = (payload: Parameters<typeof dispatchNotification>[0]) =>
      dispatchNotification(payload).catch(() => {
        console.warn("[calendar] Notification delivery failed");
      });
    // Verify this request belongs to the calling vendor.
    const { data: req, error: rErr } = await context.supabase
      .from("calendar_booking_requests")
      .select("id, event_name, planner_id, status")
      .eq("id", data.id)
      .eq("vendor_id", context.userId)
      .single();
    if (rErr || !req) throw new Error(rErr?.message ?? "Request not found or access denied");

    // Block ALL transitions out of an approved booking through this lightweight path.
    // Approved bookings have a linked calendar_events row; changing their status without
    // reconciling that row would leave the calendar data inconsistent.
    // Use respondToBookingRequest (action: "decline") to handle approved→declined with
    // the proper booking-lifecycle cleanup instead.
    if (req.status === "approved") {
      throw new Error(
        "A confirmed booking cannot be changed through the simple status update path. " +
        "Use the decline action to cancel a confirmed booking with proper cleanup.",
      );
    }

    await context.supabase
      .from("calendar_booking_requests")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("vendor_id", context.userId);

    // Notify the planner when the vendor marks the request as "Responded".
    if (data.status === "alternate_proposed") {
      await notify({
        userId: req.planner_id,
        category: "calendar",
        title: "Vendor responded",
        body: `A vendor replied to your inquiry for ${req.event_name}.`,
        href: "/calendar",
      });
    }

    if (data.status === "cancelled") {
      await notify({
        userId: req.planner_id,
        category: "calendar",
        title: "Booking request cancelled",
        body: `The vendor cancelled the request for ${req.event_name}.`,
        href: "/calendar",
      });
    }

    return { ok: true };
  });

/* --- Dashboard summary --- */

export const getDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [todayRes, upcomingRes, pendingRes, monthRes, settingsRes] = await Promise.all([
      context.supabase
        .from("calendar_events")
        .select("*")
        .eq("vendor_id", context.userId)
        .gte("starts_at", dayStart.toISOString())
        .lte("starts_at", dayEnd.toISOString())
        .order("starts_at"),
      context.supabase
        .from("calendar_events")
        .select("*")
        .eq("vendor_id", context.userId)
        .gt("starts_at", dayEnd.toISOString())
        .in("status", ["confirmed", "pending"])
        .order("starts_at")
        .limit(5),
      context.supabase
        .from("calendar_booking_requests")
        .select("*")
        .eq("vendor_id", context.userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      context.supabase
        .from("calendar_events")
        .select("id, revenue_amount, status")
        .eq("vendor_id", context.userId)
        .gte("starts_at", monthStart.toISOString())
        .lte("starts_at", monthEnd.toISOString()),
      context.supabase
        .from("calendar_settings")
        .select(CALENDAR_SETTINGS_FIELDS)
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);

    const monthEvents = monthRes.data ?? [];
    const revenue = monthEvents
      .filter((e: any) => ["confirmed", "completed"].includes(e.status))
      .reduce((s: number, e: any) => s + Number(e.revenue_amount ?? 0), 0);

    return {
      today: todayRes.data ?? [],
      upcoming: upcomingRes.data ?? [],
      pending: pendingRes.data ?? [],
      monthBookingCount: monthEvents.filter((e: any) => e.status === "confirmed" || e.status === "completed").length,
      monthRevenue: revenue,
      settings: settingsRes.data ?? null,
    };
  });
