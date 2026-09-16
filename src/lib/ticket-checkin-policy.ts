const INVALID_CHECK_IN_ORDER_STATUSES = new Set(["refunded", "failed", "expired"]);

export function isCheckInEligibleOrderStatus(status: string | null | undefined): boolean {
  return Boolean(status) && !INVALID_CHECK_IN_ORDER_STATUSES.has(status!);
}