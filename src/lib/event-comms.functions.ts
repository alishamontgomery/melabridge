/**
 * Server functions for guest communication, post-event recap, event duplication,
 * and data exports.
 *
 * All functions require the planner's JWT (requireSupabaseAuth) so RLS
 * enforces ownership on the events table.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalizeEmailInput } from "@/lib/event-input-normalization";

const uuid = z.string().uuid();

// ─── Recipient groups ────────────────────────────────────────────────────────

const RECIPIENT_GROUPS = [
  "all_guests",
  "confirmed",
  "pending",
  "declined",
  "ticket_holders",
  "checked_in",
] as const;
export type RecipientGroup = typeof RECIPIENT_GROUPS[number];

type Recipient = { email: string; name: string | null; guestId?: string };

const SendInvitationsInput = z.object({
  eventId: uuid,
  guestIds: z.array(uuid).min(1).max(100),
  message: z.string().trim().min(1).max(2000),
  requestId: uuid,
});

export const sendGuestInvitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => SendInvitationsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: event } = await supabase
      .from("events")
      .select("id, name, owner_id")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!event || event.owner_id !== userId) throw new Error("Event not found or access denied");

    const { data: guests, error } = await supabase
      .from("guests")
      .select("id, email, full_name")
      .eq("event_id", data.eventId)
      .is("deleted_at", null)
      .in("id", data.guestIds);
    if (error) throw new Error(error.message);

    const emailSchema = z.string().email();
    const invalidSelectedCount = data.guestIds.filter((guestId) => {
      const guest = (guests ?? []).find((candidate) => candidate.id === guestId);
      const normalized = normalizeEmailInput(guest?.email);
      return !normalized || !emailSchema.safeParse(normalized).success;
    }).length;
    const recipients = (guests ?? []).flatMap((guest) => {
      const normalized = normalizeEmailInput(guest.email);
      return normalized && emailSchema.safeParse(normalized).success
        ? [{ ...guest, email: normalized }]
        : [];
    });
    if (recipients.length === 0) throw new Error("Select at least one guest with an email address");

    const now = new Date();
    const cooldownCutoff = new Date(now.getTime() - 10 * 60_000).toISOString();
    const { data: claimed, error: claimError } = await supabase
      .from("events")
      .update({ invitation_last_sent_at: now.toISOString() })
      .eq("id", data.eventId)
      .eq("owner_id", userId)
      .or(`invitation_last_sent_at.is.null,invitation_last_sent_at.lt.${cooldownCutoff}`)
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claimed) throw new Error("Invitations were sent recently. Please wait 10 minutes before sending another batch.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const organizerName = profile?.display_name ?? "Your event organiser";
    const { signRsvpToken } = await import("@/lib/rsvp-token");
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

    const siteUrl = (process.env.SITE_URL ?? "https://melabridge.com").replace(/\/$/, "");
    const deliveredIds: string[] = [];
    let providerDisabled = false;
    let deliveryFailureCount = 0;
    for (let offset = 0; offset < recipients.length; offset += 5) {
      const batch = recipients.slice(offset, offset + 5);
      await Promise.all(batch.map(async (guest) => {
        try {
          const [yesToken, noToken] = await Promise.all([
            signRsvpToken({ guestId: guest.id, email: guest.email!, eventId: data.eventId, status: "yes" }),
            signRsvpToken({ guestId: guest.id, email: guest.email!, eventId: data.eventId, status: "no" }),
          ]);
          const delivery = await sendTemplateEmail("guest-invitation", guest.email!, {
            templateData: {
              guestName: guest.full_name,
              eventName: event.name,
              organizerName,
              message: data.message,
              rsvpYesUrl: `${siteUrl}/rsvp/${yesToken}`,
              rsvpNoUrl: `${siteUrl}/rsvp/${noToken}`,
            },
            idempotencyKey: `invitation-${data.eventId}-${guest.id}-${data.requestId}`,
          });
           if (delivery.sent) {
             deliveredIds.push(guest.id);
           } else {
             deliveryFailureCount += 1;
             providerDisabled ||= delivery.reason === "provider_disabled";
           }
        } catch {
           deliveryFailureCount += 1;
          console.error("[event-comms] Guest invitation delivery failed");
        }
      }));
    }

    const invitedAt = new Date().toISOString();
    if (deliveredIds.length > 0) {
      const { error: updateError } = await supabase
        .from("guests")
        .update({ invited_at: invitedAt })
        .in("id", deliveredIds);
      if (updateError) throw new Error("Invitations were delivered, but their sent status could not be saved");
    }

    // Do not lock the planner out for ten minutes when the provider rejected
    // every message. A successful or partially successful batch keeps the
    // cooldown to prevent accidental duplicate sends.
    if (deliveredIds.length === 0) {
      await supabase
        .from("events")
        .update({ invitation_last_sent_at: null })
        .eq("id", data.eventId)
        .eq("owner_id", userId)
        .eq("invitation_last_sent_at", now.toISOString());
    }

    return {
      sentCount: deliveredIds.length,
      failedCount: deliveryFailureCount,
      invalidCount: invalidSelectedCount,
      providerDisabled,
      invitedAt,
    };
  });

async function resolveRecipients(
  supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>,
  eventId: string,
  group: RecipientGroup,
): Promise<Recipient[]> {
  if (group === "ticket_holders" || group === "checked_in") {
    if (group === "ticket_holders") {
      const { data } = await (supabase as any)
        .from("ticket_orders")
        .select("buyer_email, buyer_name")
        .eq("event_id", eventId)
        .in("status", ["paid", "free"]);
      return (data ?? []).map((r: any) => ({ email: r.buyer_email, name: r.buyer_name }));
    }
    const { data } = await (supabase as any)
      .from("ticket_attendees")
      .select("email, full_name, checked_in_at")
      .eq("event_id", eventId)
      .not("checked_in_at", "is", null);
    return (data ?? [])
      .filter((r: any) => r.email)
      .map((r: any) => ({ email: r.email, name: r.full_name }));
  }

  let q = (supabase as any)
    .from("guests")
    .select("id, email, full_name, rsvp_status")
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .not("email", "is", null);

  if (group === "confirmed") q = q.eq("rsvp_status", "yes");
  if (group === "pending") q = q.eq("rsvp_status", "pending");
  if (group === "declined") q = q.eq("rsvp_status", "no");

  const { data } = await q;
  return (data ?? []).map((r: any) => ({ email: r.email, name: r.full_name, guestId: r.id }));
}

// ─── Send / schedule message ─────────────────────────────────────────────────

// Guest-based groups where per-recipient RSVP links make sense
const GUEST_RSVP_GROUPS: RecipientGroup[] = ["all_guests", "confirmed", "pending", "declined"];

const SendMessageInput = z.object({
  eventId: uuid,
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  recipientGroup: z.enum(RECIPIENT_GROUPS),
  scheduledFor: z.string().datetime().optional(),
  /** App base URL (e.g. https://myapp.replit.app) used to construct RSVP links. */
  baseUrl: z.string().url().optional(),
});

export const sendEventMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => SendMessageInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ev, error: evErr } = await supabase
      .from("events")
      .select("id, name, owner_id")
      .eq("id", data.eventId)
      .maybeSingle();
    if (evErr || !ev || ev.owner_id !== userId) throw new Error("Event not found or access denied");

    const isScheduled = !!data.scheduledFor;

    // For immediate sends, resolve recipients now so we log the count.
    // For scheduled sends, we'll resolve at delivery time (recipient list may change).
    const recipients = isScheduled
      ? await resolveRecipients(supabase as any, data.eventId, data.recipientGroup)
      : await resolveRecipients(supabase as any, data.eventId, data.recipientGroup);

    const { error: logErr } = await (supabase as any).from("event_communications").insert({
      event_id: data.eventId,
      organizer_id: userId,
      subject: data.subject,
      body: data.body,
      recipient_group: data.recipientGroup,
      recipient_count: recipients.length,
      scheduled_for: data.scheduledFor ?? null,
      sent_at: isScheduled ? null : new Date().toISOString(),
      status: isScheduled ? "scheduled" : "sent",
    });
    if (logErr) throw new Error(logErr.message);

    if (!isScheduled) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();
      const organizerName = profile?.display_name ?? "Your event organiser";

      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

      // Determine whether to include RSVP action buttons.
      // Only for guest-based groups, and only when the caller provides the app's base URL.
      const useRsvpLinks = !!(data.baseUrl && GUEST_RSVP_GROUPS.includes(data.recipientGroup));

      const emailPromises = recipients.map(async (r, recipientIndex) => {
        try {
          let templateId: string = "guest-message";
          let templateData: Record<string, unknown> = {
            eventName: ev.name,
            organizerName,
            subject: data.subject,
            body: data.body,
          };

          if (useRsvpLinks && r.guestId) {
            const { signRsvpToken } = await import("@/lib/rsvp-token");
            const [yesToken, noToken] = await Promise.all([
              signRsvpToken({ guestId: r.guestId, email: r.email, eventId: data.eventId, status: "yes" }),
              signRsvpToken({ guestId: r.guestId, email: r.email, eventId: data.eventId, status: "no" }),
            ]);
            templateId = "guest-message-rsvp";
            templateData = {
              ...templateData,
              rsvpYesUrl: `${data.baseUrl}/rsvp/${yesToken}`,
              rsvpNoUrl: `${data.baseUrl}/rsvp/${noToken}`,
            };
          }

          await sendTemplateEmail(templateId, r.email, {
            templateData,
            idempotencyKey: `guestmsg-${data.eventId}-${Date.now()}-${r.email}`,
          });
        } catch {
          const recipientReference = r.guestId ?? recipientIndex;
          console.error(
            `[event-comms] Guest message email delivery failed for recipient ${recipientReference}`,
          );
        }
      });

      const guestEmails = recipients.map((r) => r.email).filter(Boolean);
      const notifPromise = guestEmails.length > 0
        ? (supabase as any)
            .from("profiles")
            .select("id")
            .in("email", guestEmails)
            .then(({ data: profiles }: any) => {
              if (!profiles?.length) return;
              const notifs = (profiles as any[]).map((p: any) => ({
                user_id: p.id,
                category: "event",
                title: `${ev.name}: ${data.subject}`,
                body: data.body.slice(0, 200),
                href: `/e/${data.eventId}`,
              }));
              return (supabase as any).from("notifications").insert(notifs);
            })
        : Promise.resolve();

      await Promise.allSettled([...emailPromises, notifPromise]);
    }

    return {
      ok: true,
      recipientCount: recipients.length,
      status: isScheduled ? "scheduled" : "sent",
    };
  });

// ─── Cancel a scheduled message ──────────────────────────────────────────────

export const cancelScheduledMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ commId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership via the event
    const { data: comm, error: commErr } = await (supabase as any)
      .from("event_communications")
      .select("id, status, event_id")
      .eq("id", data.commId)
      .maybeSingle();

    if (commErr || !comm) throw new Error("Message not found");
    if (comm.status !== "scheduled") throw new Error("Only scheduled messages can be cancelled");

    // Check ownership of the event
    const { data: ev } = await supabase
      .from("events")
      .select("owner_id")
      .eq("id", comm.event_id)
      .maybeSingle();
    if (!ev || ev.owner_id !== userId) throw new Error("Access denied");

    const { error } = await (supabase as any)
      .from("event_communications")
      .delete()
      .eq("id", data.commId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// ─── Send a scheduled message immediately ────────────────────────────────────

export const sendScheduledNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ commId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: comm, error: commErr } = await (supabase as any)
      .from("event_communications")
      .select("*")
      .eq("id", data.commId)
      .maybeSingle();
    if (commErr || !comm) throw new Error("Message not found");
    if (comm.status !== "scheduled") throw new Error("Only scheduled messages can be sent now");

    const { data: ev } = await supabase
      .from("events")
      .select("id, name, owner_id")
      .eq("id", comm.event_id)
      .maybeSingle();
    if (!ev || ev.owner_id !== userId) throw new Error("Access denied");

    // Clear scheduled_for so the cron doesn't also pick it up, mark status=sent
    await (supabase as any)
      .from("event_communications")
      .update({ scheduled_for: null, status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.commId);

    // Resolve and deliver
    const recipients = await resolveRecipients(
      supabase as any,
      comm.event_id,
      comm.recipient_group as RecipientGroup,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const organizerName = profile?.display_name ?? "Your event organiser";

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await Promise.allSettled(
      recipients.map((r) =>
        sendTemplateEmail("guest-message", r.email, {
          templateData: { eventName: ev.name, organizerName, subject: comm.subject, body: comm.body },
          idempotencyKey: `sendnow-${data.commId}-${r.email}`,
        })
      )
    );

    // In-app notifications
    const guestEmails = recipients.map((r) => r.email).filter(Boolean);
    if (guestEmails.length > 0) {
      const { data: profiles } = await (supabase as any).from("profiles").select("id").in("email", guestEmails);
      if (profiles?.length) {
        const notifs = (profiles as any[]).map((p: any) => ({
          user_id: p.id,
          category: "event",
          title: `${ev.name}: ${comm.subject}`,
          body: (comm.body as string).slice(0, 200),
          href: `/e/${comm.event_id}`,
        }));
        await (supabase as any).from("notifications").insert(notifs);
      }
    }

    // Update final recipient count
    await (supabase as any)
      .from("event_communications")
      .update({ recipient_count: recipients.length })
      .eq("id", data.commId);

    return { ok: true, recipientCount: recipients.length };
  });

// ─── List communications history ─────────────────────────────────────────────

export const listEventCommunications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ eventId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("event_communications")
      .select("*")
      .eq("event_id", data.eventId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string;
      event_id: string;
      organizer_id: string;
      subject: string;
      body: string;
      recipient_group: RecipientGroup;
      recipient_count: number;
      scheduled_for: string | null;
      sent_at: string | null;
      status: "sent" | "scheduled" | "failed";
      created_at: string;
    }>;
  });

// ─── Post-event recap ────────────────────────────────────────────────────────

export const getEventRecap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ eventId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ev, error: evErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", data.eventId)
      .maybeSingle();
    if (evErr || !ev || ev.owner_id !== userId) throw new Error("Access denied");

    const [
      { data: tasks },
      { data: budget },
      { data: guests },
      { data: attendees },
      { data: orders },
      { data: vendorNeeds },
      { data: runsheet },
    ] = await Promise.all([
      supabase.from("tasks").select("id,status,completed_at").eq("event_id", data.eventId).is("deleted_at", null),
      supabase.from("budget_items").select("id,category,label,estimated_amount,actual_amount,paid_amount").eq("event_id", data.eventId).is("deleted_at", null),
      supabase.from("guests").select("id,rsvp_status,plus_ones").eq("event_id", data.eventId).is("deleted_at", null),
      (supabase as any).from("ticket_attendees").select("id,full_name,checked_in_at").eq("event_id", data.eventId),
      (supabase as any).from("ticket_orders").select("id,amount_cents,status,quantity").eq("event_id", data.eventId).in("status", ["paid", "free"]),
      (supabase as any).from("event_vendor_needs").select("id,category,status,notes,priority").eq("event_id", data.eventId),
      (supabase as any).from("event_runsheet_items").select("id,title,status,duration_min").eq("event_id", data.eventId).order("sort_order"),
    ]);

    const totalGuests = (guests ?? []).length;
    const confirmedGuests = (guests ?? []).filter((g: any) => g.rsvp_status === "yes").length;
    const pendingGuests = (guests ?? []).filter((g: any) => g.rsvp_status === "pending").length;
    const declinedGuests = (guests ?? []).filter((g: any) => g.rsvp_status === "no").length;
    const plusOnes = (guests ?? []).reduce((s: number, g: any) => s + (g.plus_ones ?? 0), 0);
    const totalAttendees = (attendees ?? []).length;
    const checkedIn = (attendees ?? []).filter((a: any) => a.checked_in_at).length;

    const budgetTarget = ev.budget_target ? Number(ev.budget_target) : 0;
    const totalEstimated = (budget ?? []).reduce((s: number, b: any) => s + Number(b.estimated_amount ?? 0), 0);
    const totalActual = (budget ?? []).reduce((s: number, b: any) => s + Number(b.actual_amount ?? 0), 0);
    const totalPaid = (budget ?? []).reduce((s: number, b: any) => s + Number(b.paid_amount ?? 0), 0);

    const byCategory: Record<string, { estimated: number; actual: number; paid: number }> = {};
    for (const item of budget ?? []) {
      const cat = (item as any).category || "Other";
      if (!byCategory[cat]) byCategory[cat] = { estimated: 0, actual: 0, paid: 0 };
      byCategory[cat].estimated += Number((item as any).estimated_amount ?? 0);
      byCategory[cat].actual += Number((item as any).actual_amount ?? 0);
      byCategory[cat].paid += Number((item as any).paid_amount ?? 0);
    }

    const ticketRevenueCents = (orders ?? []).reduce((s: number, o: any) => s + (o.amount_cents ?? 0), 0);
    const ticketsSold = (orders ?? []).reduce((s: number, o: any) => s + (o.quantity ?? 0), 0);

    const totalTasks = (tasks ?? []).length;
    const completedTasks = (tasks ?? []).filter((t: any) => t.status === "done").length;
    const openTasks = totalTasks - completedTasks;

    const vendors = (vendorNeeds ?? []).map((v: any) => ({
      id: v.id,
      category: v.category,
      notes: v.notes,
      status: v.status,
      priority: v.priority,
    }));

    const unpaidItems = (budget ?? [])
      .filter((b: any) => Number(b.actual_amount ?? 0) > Number(b.paid_amount ?? 0))
      .map((b: any) => ({ label: b.label, category: b.category, unpaid: Number(b.actual_amount) - Number(b.paid_amount) }));

    return {
      event: { id: ev.id, name: ev.name, event_date: ev.event_date, event_type: ev.event_type, status: ev.status },
      attendance: { totalGuests, confirmedGuests, pendingGuests, declinedGuests, plusOnes, totalAttendees, checkedIn },
      budget: { target: budgetTarget, estimated: totalEstimated, actual: totalActual, paid: totalPaid, byCategory, unpaidItems },
      tickets: { revenueCents: ticketRevenueCents, sold: ticketsSold, totalOrders: (orders ?? []).length },
      tasks: { total: totalTasks, completed: completedTasks, open: openTasks },
      vendors,
      runsheet: (runsheet ?? []).map((r: any) => ({ id: r.id, title: r.title, status: r.status, duration_min: r.duration_min })),
    };
  });

// ─── Duplicate planner event ─────────────────────────────────────────────────

export const duplicatePlannerEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ eventId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: src, error: evErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", data.eventId)
      .maybeSingle();
    if (evErr || !src || src.owner_id !== userId) throw new Error("Event not found or access denied");

    const { data: newEvent, error: createErr } = await supabase
      .from("events")
      .insert({
        owner_id: userId,
        name: `Copy of ${src.name}`,
        event_type: src.event_type,
        guest_target: src.guest_target,
        budget_target: src.budget_target,
        description: src.description,
        status: "planning",
      })
      .select("id")
      .single();
    if (createErr || !newEvent) throw new Error(createErr?.message ?? "Could not create event");

    const newId = newEvent.id;

    const [{ data: tasks }, { data: budget }, { data: runsheet }] = await Promise.all([
      supabase.from("tasks").select("title,priority").eq("event_id", data.eventId).is("deleted_at", null).limit(200),
      supabase.from("budget_items").select("category,label,estimated_amount").eq("event_id", data.eventId).is("deleted_at", null).limit(200),
      (supabase as any).from("event_runsheet_items").select("title,duration_min,sort_order,owner").eq("event_id", data.eventId).limit(100),
    ]);

    const inserts: Promise<unknown>[] = [];

    if (tasks?.length) {
      inserts.push(
        Promise.resolve(supabase.from("tasks").insert(
          tasks.map((t: any) => ({
            event_id: newId,
            title: t.title,
            priority: t.priority ?? "medium",
            created_by: userId,
          }))
        ))
      );
    }

    if (budget?.length) {
      inserts.push(
        Promise.resolve(supabase.from("budget_items").insert(
          budget.map((b: any) => ({
            event_id: newId,
            category: b.category ?? null,
            label: b.label,
            estimated_amount: Number(b.estimated_amount) || 0,
            actual_amount: 0,
            paid_amount: 0,
            created_by: userId,
          }))
        ))
      );
    }

    if (runsheet?.length) {
      inserts.push(
        Promise.resolve((supabase as any).from("event_runsheet_items").insert(
          (runsheet as any[]).map((r: any) => ({
            event_id: newId,
            title: r.title,
            duration_min: r.duration_min ?? 30,
            sort_order: r.sort_order ?? 0,
            owner: r.owner ?? null,
            status: "pending",
          }))
        ))
      );
    }

    await Promise.allSettled(inserts);

    return { newEventId: newId, name: `Copy of ${src.name}` };
  });

// ─── Preview recipient count ─────────────────────────────────────────────────

export const previewRecipientCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ eventId: uuid, group: z.enum(RECIPIENT_GROUPS) }).parse(d))
  .handler(async ({ data, context }) => {
    const recipients = await resolveRecipients(context.supabase as any, data.eventId, data.group);
    return { count: recipients.length };
  });
