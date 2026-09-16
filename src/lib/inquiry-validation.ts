import { z } from "zod";

/**
 * Input contract for a vendor inquiry submission.
 *
 * This mirrors the argument validation the `submit_vendor_inquiry` SECURITY
 * DEFINER RPC re-enforces at the database layer. Kept in a dependency-free
 * module so it can be unit-tested without importing server-only code.
 */
export const InquiryInput = z.object({
  vendorId: z.string().uuid(),
  eventName: z.string().trim().min(1).max(200),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventType: z.string().trim().max(100).nullable().optional(),
  message: z.string().trim().max(2000).nullable().optional(),
});

export type InquiryInputData = z.infer<typeof InquiryInput>;

/**
 * Shape returned by the `submit_vendor_inquiry` RPC.
 * `duplicate` distinguishes an idempotent no-op (an active inquiry already
 * exists) from a freshly created lead + request.
 */
export type InquiryRpcResult = {
  duplicate?: boolean;
  booking_id?: string;
  request_id?: string;
  vendor_user_id?: string;
};

/**
 * Decides whether a vendor notification should be sent for an RPC result.
 *
 * A notification is a non-critical, best-effort side effect. It is only sent
 * for a newly created lead — never for an idempotent duplicate short-circuit.
 */
export function shouldNotifyVendor(result: InquiryRpcResult): boolean {
  return result.duplicate !== true;
}

/**
 * Expected, user-safe validation messages the `submit_vendor_inquiry` RPC may
 * raise. These are deliberately non-sensitive and are surfaced verbatim to the
 * client. Anything not on this allow-list is treated as an internal failure and
 * collapsed to a generic message so DB internals never leak.
 */
const FRIENDLY_INQUIRY_ERRORS: Record<string, string> = {
  "Not authenticated": "Please sign in to send an inquiry.",
  "This account cannot submit vendor inquiries":
    "This account type can't send vendor inquiries.",
  "Event name is required": "Please enter an event name.",
  "Event name is too long": "That event name is too long.",
  "Message is too long": "Your message is too long.",
  "Invalid event date": "Please choose a valid event date.",
  "Event date must be today or later": "Please choose a date that is today or later.",
  "Vendor not found": "We couldn't find that vendor.",
  "Vendor is not accepting inquiries yet": "This vendor isn't accepting inquiries yet.",
  "You cannot submit an inquiry to your own profile":
    "You can't send an inquiry to your own profile.",
};

const GENERIC_INQUIRY_ERROR = "We couldn't send your inquiry. Please try again.";

/**
 * Sanitizes a raw RPC/Postgres error message before it reaches the client.
 *
 * Known validation errors map to friendly, non-sensitive copy; everything else
 * (constraint names, SQLSTATEs, stack details, connection errors, etc.) is
 * replaced with a single generic message so no database internals are exposed.
 */
export function sanitizeInquiryError(rawMessage: string | null | undefined): string {
  const trimmed = (rawMessage ?? "").trim();
  return FRIENDLY_INQUIRY_ERRORS[trimmed] ?? GENERIC_INQUIRY_ERROR;
}
