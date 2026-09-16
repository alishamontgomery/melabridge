/**
 * Scheduled message processor — runs server-side with service role access.
 *
 * Called by the cron API endpoint every N minutes. It atomically claims a
 * bounded batch of due event_communications rows (via the
 * claim_scheduled_communications RPC, which uses FOR UPDATE SKIP LOCKED),
 * sends emails + in-app notifications, then marks each row 'sent' — but ONLY
 * when every required recipient email either delivered or was suppressed.
 *
 * Concurrency: the claim RPC flips rows to 'processing' under a row lock, so
 * overlapping cron runs never grab the same row. Rows whose worker crashed
 * mid-send are recovered once their processing lease expires.
 *
 * Retry: a transient failure moves the row to 'retryable' with a backoff and a
 * PII-free error note. After MAX_ATTEMPTS the row is parked as 'failed'.
 *
 * Uses the service_role secret so it can read across all organizers without
 * requiring a user JWT.
 */

/** Max delivery attempts before a row is parked as permanently failed. */
const MAX_ATTEMPTS = 5;
/** Bounded batch size per cron run to keep latency predictable. */
const BATCH_SIZE = 50;
/** Processing lease: a claimed row older than this is treated as stuck. */
const LEASE_SECONDS = 600;

export function isServiceClientAvailable(): boolean {
  // Mirrors the check in client.server.ts (reads "service_role" secret in Replit)
  return !!(process.env.SUPABASE_URL && process.env.service_role);
}

async function getServiceClient() {
  // Delegate to the shared admin client which handles opaque-key quirks
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

type Comm = {
  id: string;
  event_id: string;
  organizer_id: string;
  subject: string;
  body: string;
  recipient_group: string;
  scheduled_for: string | null;
  attempts: number;
  /**
   * Lease token: the timestamp this worker stamped when it claimed the row.
   * Every status transition is guarded by (id, locked_at) so a stale worker
   * whose lease expired cannot overwrite a row a new worker has reclaimed.
   */
  locked_at: string;
};

/**
 * A transient failure that should leave the row in 'retryable' state rather
 * than 'failed'. Carries a short, PII-free reason for the last_error column.
 */
class RetryableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "RetryableError";
  }
}

/** Exponential backoff (minutes) for the Nth attempt: 1, 2, 4, 8, 16... */
function backoffMinutes(attempts: number): number {
  return Math.min(2 ** Math.max(attempts - 1, 0), 60);
}

async function resolveRecipients(
  sb: any,
  eventId: string,
  group: string,
): Promise<Array<{ email: string; name: string | null }>> {
  if (group === "ticket_holders") {
    const { data, error } = await (sb as any)
      .from("ticket_orders")
      .select("buyer_email, buyer_name")
      .eq("event_id", eventId)
      .in("status", ["paid", "free"]);
    if (error) throw new RetryableError("recipient_query_failed");
    return (data ?? []).map((r: any) => ({ email: r.buyer_email, name: r.buyer_name }));
  }

  if (group === "checked_in") {
    const { data, error } = await (sb as any)
      .from("ticket_attendees")
      .select("email, full_name")
      .eq("event_id", eventId)
      .not("checked_in_at", "is", null);
    if (error) throw new RetryableError("recipient_query_failed");
    return (data ?? []).filter((r: any) => r.email).map((r: any) => ({ email: r.email, name: r.full_name }));
  }

  // Guest-based groups
  let q = (sb as any)
    .from("guests")
    .select("email, full_name, rsvp_status")
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .not("email", "is", null);
  if (group === "confirmed") q = q.eq("rsvp_status", "yes");
  if (group === "pending") q = q.eq("rsvp_status", "pending");
  if (group === "declined") q = q.eq("rsvp_status", "no");

  const { data, error } = await q;
  if (error) throw new RetryableError("recipient_query_failed");
  return (data ?? []).map((r: any) => ({ email: r.email, name: r.full_name }));
}

/**
 * Send one communication's emails + notifications and mark it sent.
 * Throws RetryableError on a recoverable failure; the caller decides whether
 * to schedule a retry or park the row as failed.
 */
async function processOne(sb: any, comm: Comm): Promise<"sent"> {
  // Fetch event info for the email template.
  const { data: ev, error: evErr } = await sb
    .from("events")
    .select("id, name, owner_id")
    .eq("id", comm.event_id)
    .maybeSingle();
  if (evErr) throw new RetryableError("event_query_failed");
  if (!ev) throw new RetryableError("event_not_found");

  // Fetch organizer display name (best-effort — failure here is non-fatal
  // but we still surface a query error as retryable to avoid partial sends).
  const { data: profile, error: profErr } = await (sb as any)
    .from("profiles")
    .select("display_name, email")
    .eq("id", comm.organizer_id)
    .maybeSingle();
  if (profErr) throw new RetryableError("organizer_query_failed");
  const organizerName = profile?.display_name ?? "Your event organiser";

  const recipients = await resolveRecipients(sb, comm.event_id, comm.recipient_group);

  // Application email is optional. With no provider configured, the helper
  // returns a fulfilled provider_disabled result and in-app delivery continues.
  // Only genuine provider errors reject and trigger a retry.
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const sendResults = await Promise.allSettled(
    recipients.map((r) =>
      sendTemplateEmail("guest-message", r.email, {
        templateData: {
          eventName: ev.name,
          organizerName,
          subject: comm.subject,
          body: comm.body,
        },
        idempotencyKey: `sched-${comm.id}-${r.email}`,
      })
    )
  );

  // Count only genuine delivery failures (rejected promises). Suppression is
  // a fulfilled { sent: false } and does not count as a failure.
  const failedDeliveries = sendResults.filter((r) => r.status === "rejected").length;
  if (failedDeliveries > 0) {
    // At least one required email delivery failed — do NOT mark sent; the
    // caller will schedule a retry. (Emails are idempotency-keyed per
    // recipient so a retry re-sends only what actually failed.)
    throw new RetryableError(`email_delivery_failed:${failedDeliveries}/${recipients.length}`);
  }

  // All required emails delivered. Mark 'sent' NOW — before the optional
  // in-app notifications — and only if we still own the lease (id + locked_at).
  // Committing 'sent' first is what makes the optional work below safe to
  // treat as best-effort: a later retry can never re-run because the row is
  // no longer claimable, so already-delivered emails/notifications are never
  // duplicated.
  const { error: sentErr } = await (sb as any)
    .from("event_communications")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      recipient_count: recipients.length,
      locked_at: null,
      last_error: null,
      next_attempt_at: null,
    })
    .eq("id", comm.id)
    .eq("locked_at", comm.locked_at); // only transition the row WE claimed
  if (sentErr) {
    // Emails already went out; retrying would duplicate them. Do NOT throw —
    // log generically (no raw error, which could contain recipient PII) and
    // let lease recovery reconcile the orphaned 'processing' row later.
    console.error(`[scheduled-messages] mark_sent_failed for comm ${comm.id} (emails already delivered)`);
  }

  // Optional in-app notifications for guests with MelaBridge accounts.
  // Best-effort ONLY: failures are logged generically and never bubble up as a
  // retry, because the emails (and possibly some notifications) are already
  // delivered and the row is already committed as 'sent'.
  try {
    const guestEmails = recipients.map((r) => r.email).filter(Boolean);
    if (guestEmails.length > 0) {
      const { data: profiles, error: profsErr } = await (sb as any)
        .from("profiles")
        .select("id")
        .in("email", guestEmails);
      if (profsErr) {
        console.error(`[scheduled-messages] optional notification lookup failed for comm ${comm.id}`);
      } else if (profiles?.length) {
        const notifs = (profiles as any[]).map((p: any) => ({
          user_id: p.id,
          category: "event",
          title: `${ev.name}: ${comm.subject}`,
          body: comm.body.slice(0, 200),
          href: `/e/${comm.event_id}`,
        }));
        const { error: notifErr } = await (sb as any).from("notifications").insert(notifs);
        if (notifErr) {
          console.error(`[scheduled-messages] optional notification insert failed for comm ${comm.id}`);
        }
      }
    }
  } catch {
    // Generic, PII-free log — never surface the raw error nor retry.
    console.error(`[scheduled-messages] optional notifications errored for comm ${comm.id}`);
  }

  console.log(`[scheduled-messages] Processed comm ${comm.id} for ${recipients.length} recipients`);
  return "sent";
}

/**
 * Park a row after a failed attempt: either schedule a retry ('retryable')
 * with backoff, or give up ('failed') once attempts are exhausted.
 * `reason` must be PII-free.
 */
async function recordFailure(sb: any, comm: Comm, reason: string): Promise<void> {
  const exhausted = comm.attempts >= MAX_ATTEMPTS;
  const nextStatus = exhausted ? "failed" : "retryable";
  const patch: Record<string, unknown> = {
    status: nextStatus,
    locked_at: null,
    last_error: reason.slice(0, 200),
  };
  if (!exhausted) {
    const delayMs = backoffMinutes(comm.attempts) * 60_000;
    patch.next_attempt_at = new Date(Date.now() + delayMs).toISOString();
  } else {
    patch.next_attempt_at = null;
  }

  const { error } = await (sb as any)
    .from("event_communications")
    .update(patch)
    .eq("id", comm.id)
    .eq("locked_at", comm.locked_at); // only transition the row WE claimed
  if (error) {
    // Can't reach the DB to record state — log generically (no raw error,
    // which could contain PII) and let the lease recovery path re-claim this
    // row on a later run.
    console.error(`[scheduled-messages] failed to record failure for comm ${comm.id}`);
  }
}

export async function processScheduledMessages(): Promise<{ processed: number; sent: number; failed: number }> {
  const sb = await getServiceClient();

  // Atomically claim a bounded batch. The RPC flips due 'scheduled'/'retryable'
  // rows (and stuck 'processing' rows past their lease) to 'processing' under
  // FOR UPDATE SKIP LOCKED, so overlapping cron runs never claim the same row.
  const { data: claimed, error } = await (sb as any).rpc("claim_scheduled_communications", {
    _batch_size: BATCH_SIZE,
    _lease_seconds: LEASE_SECONDS,
  });

  if (error) throw new Error("Failed to claim scheduled messages");
  // Preserve zero-pending behavior: nothing due → nothing to report.
  if (!claimed?.length) return { processed: 0, sent: 0, failed: 0 };

  const comms = claimed as Comm[];

  const results = await Promise.allSettled(
    comms.map(async (comm) => {
      try {
        await processOne(sb, comm);
        return "sent" as const;
      } catch (err) {
        const reason =
          err instanceof RetryableError
            ? err.message
            : "unexpected_error";
        // Log only the sanitized, PII-free reason — never the raw error, which
        // may embed a recipient address or other recipient PII.
        console.error(`[scheduled-messages] failed to send comm ${comm.id}: ${reason}`);
        await recordFailure(sb, comm, reason);
        return "failed" as const;
      }
    })
  );

  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value === "sent") sent++;
    else failed++;
  }

  return { processed: comms.length, sent, failed };
}
