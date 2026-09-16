/**
 * Public server function for one-click RSVP from email links.
 * No auth required — the signed token is the credential.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Try to read the eventId from a token body without verifying the signature.
 *  Used only to resolve a public-event link on the error card (display-only). */
function peekEventIdFromToken(token: string): string | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 0) return null;
    const body = token.slice(0, dot);
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
    return typeof payload.eventId === "string" ? payload.eventId : null;
  } catch {
    return null;
  }
}

export const confirmRsvpFromToken = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyRsvpToken } = await import("@/lib/rsvp-token");
    const payload = await verifyRsvpToken(data.token);

    if (!payload) {
      // Token is invalid or expired. Try to peek the eventId so the error card
      // can link to the public event page if the event is still published.
      const peekedEventId = peekEventIdFromToken(data.token);
      if (peekedEventId) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: ev } = await supabaseAdmin
          .from("events")
          .select("id, is_published")
          .eq("id", peekedEventId)
          .maybeSingle();
        if (ev?.is_published) {
          return { ok: false, reason: "invalid_or_expired" as const, eventId: ev.id, isPublished: true };
        }
      }
      return { ok: false, reason: "invalid_or_expired" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify guest still exists, email still matches, and belongs to the event in the token
    const { data: guest, error: guestErr } = await supabaseAdmin
      .from("guests")
      .select("id, full_name, email, rsvp_status")
      .eq("id", payload.guestId)
      .eq("event_id", payload.eventId)   // re-validate ownership against token payload
      .is("deleted_at", null)
      .maybeSingle();

    if (guestErr) {
      console.error("[rsvp-link] Guest lookup failed:", guestErr.message);
      return { ok: false, reason: "update_failed" as const };
    }
    if (!guest || guest.email?.toLowerCase().trim() !== payload.email.toLowerCase().trim()) {
      return { ok: false, reason: "guest_not_found" as const };
    }

    // Fetch event details for the confirmation page
    const { data: ev, error: evErr } = await supabaseAdmin
      .from("events")
      .select("id, name, event_date, location, is_published")
      .eq("id", payload.eventId)
      .maybeSingle();

    if (evErr) {
      console.error("[rsvp-link] Event lookup failed:", evErr.message);
      return { ok: false, reason: "update_failed" as const };
    }
    if (!ev) {
      return { ok: false, reason: "event_not_found" as const };
    }

    // Apply the RSVP update — scope by event_id to match the ownership check above
    const { error } = await supabaseAdmin
      .from("guests")
      .update({ rsvp_status: payload.status })
      .eq("id", payload.guestId)
      .eq("event_id", payload.eventId)
      .is("deleted_at", null);

    if (error) {
      console.error("[rsvp-link] Update failed:", error.message);
      return { ok: false, reason: "update_failed" as const };
    }

    return {
      ok: true,
      guestName: guest.full_name,
      eventName: ev.name,
      eventId: ev.id,
      eventDate: ev.event_date ?? null,
      location: ev.location ?? null,
      isPublished: ev.is_published ?? false,
      status: payload.status,
      previousStatus: guest.rsvp_status ?? "pending",
    };
  });
