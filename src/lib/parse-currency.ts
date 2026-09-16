/**
 * Parse a currency string entered by the user into a non-negative number.
 *
 * Accepts formats like:
 *   "25000"       →  25000
 *   "25,000"      →  25000
 *   "$25,000.50"  →  25000.5
 *   "1500.50"     →  1500.5
 *
 * Returns null when the input is empty, blank, or cannot be parsed to a
 * non-negative finite number.
 */
export function parseCurrency(raw: string | number | undefined | null): number | null {
  if (raw == null || raw === "") return null;
  const str = String(raw).replace(/[$,\s]/g, "").trim();
  if (!str) return null;
  const n = parseFloat(str);
  if (!isFinite(n) || n < 0) return null;
  return n;
}
