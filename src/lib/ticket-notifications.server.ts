/**
 * Server-only helpers for ticket milestone and exception notifications.
 * Called lazily from ticket server functions; never imported at client module scope.
 */

const MILESTONE_THRESHOLDS = [25, 50, 75, 90, 100] as const;

/**
 * Called after each successful ticket purchase.
 * Checks whether any capacity milestone (25 / 50 / 75 / 90 / 100 %) has been
 * newly crossed and inserts a single in-app notification per threshold.
 *
 * Each milestone fires exactly once per event (tracked via entity_id in the
 * notifications table — no extra columns or tables required).
 */
export async function checkAndFireTicketMilestones(eventId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch event owner and name
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("owner_id, name")
      .eq("id", eventId)
      .maybeSingle();
    if (!event?.owner_id) return;

    // Fetch active ticket types — skip if any type has unlimited capacity
    const { data: types } = await supabaseAdmin
      .from("ticket_types")
      .select("quantity, sold_count")
      .eq("event_id", eventId)
      .eq("is_active", true);
    if (!types?.length) return;
    if (types.some((t) => t.quantity == null)) return; // can't calculate % for unlimited

    const totalSold = types.reduce((s, t) => s + (t.sold_count ?? 0), 0);
    const totalCapacity = types.reduce((s, t) => s + (t.quantity as number), 0);
    if (totalCapacity === 0) return;

    const pct = Math.floor((totalSold / totalCapacity) * 100);

    // Which milestones have already fired for this event?
    const { data: existing } = await supabaseAdmin
      .from("notifications")
      .select("entity_id")
      .eq("user_id", event.owner_id)
      .eq("entity_type", "ticket_milestone")
      .like("entity_id", `${eventId}:%`);

    const fired = new Set(
      (existing ?? []).map((n: { entity_id: string | null }) => n.entity_id ?? ""),
    );

    for (const threshold of MILESTONE_THRESHOLDS) {
      if (pct < threshold) break; // thresholds are ascending; nothing higher can fire yet
      const key = `${eventId}:${threshold}`;
      if (fired.has(key)) continue;

      const soldOut = threshold === 100;
      await supabaseAdmin.from("notifications").insert({
        user_id: event.owner_id,
        category: "tickets",
        title: soldOut
          ? `🎉 Sold out — ${event.name}`
          : `Ticket milestone: ${threshold}% sold`,
        body: soldOut
          ? `All ${totalCapacity} tickets for "${event.name}" have sold out!`
          : `${totalSold} of ${totalCapacity} tickets sold — ${threshold}% of capacity reached for "${event.name}".`,
        href: `/events/${eventId}?tab=tickets`,
        icon: soldOut ? "party_popper" : "ticket",
        entity_type: "ticket_milestone",
        entity_id: key,
      });
    }
  } catch (err) {
    // Non-blocking: log but never fail the parent purchase transaction
    console.error("[ticket-notifications] milestone check failed:", err);
  }
}

/**
 * Fired on refund, payment failure, or Stripe dispute — regardless of the
 * organiser's per-sale email preference.
 */
export async function insertExceptionAlert(params: {
  eventId: string;
  type: "refund" | "payment_failure" | "dispute";
  amountCents: number;
  buyerName: string;
  currency?: string;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: event } = await supabaseAdmin
      .from("events")
      .select("owner_id, name")
      .eq("id", params.eventId)
      .maybeSingle();
    if (!event?.owner_id) return;

    const moneyStr = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (params.currency ?? "usd").toUpperCase(),
    }).format(params.amountCents / 100);

    const titles: Record<string, string> = {
      refund: `Refund issued: ${moneyStr}`,
      payment_failure: `Payment failed: ${moneyStr}`,
      dispute: `Chargeback opened: ${moneyStr}`,
    };
    const bodies: Record<string, string> = {
      refund: `A refund of ${moneyStr} was issued to ${params.buyerName} for "${event.name}".`,
      payment_failure: `A payment of ${moneyStr} from ${params.buyerName} failed for "${event.name}".`,
      dispute: `${moneyStr} chargeback from ${params.buyerName} for "${event.name}". Please respond in your Stripe dashboard promptly.`,
    };

    await supabaseAdmin.from("notifications").insert({
      user_id: event.owner_id,
      category: "tickets",
      title: titles[params.type],
      body: bodies[params.type],
      href: `/events/${params.eventId}?tab=tickets`,
      icon: params.type === "dispute" ? "alert_triangle" : "rotate_ccw",
      entity_type: "ticket_exception",
      entity_id: null,
    });
  } catch (err) {
    console.error("[ticket-notifications] exception alert failed:", err);
  }
}
