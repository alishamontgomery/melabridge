/**
 * Normalize values coming from event forms and database time columns before
 * they reach validation or persistence. PostgreSQL may return time columns as
 * HH:MM:SS while HTML time inputs and our API contract use HH:MM.
 */
export function trimOrNull(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function normalizeTimeInput(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;

  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(normalized);
  if (!match) return normalized;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] == null ? 0 : Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) return normalized;

  return `${match[1]}:${match[2]}`;
}

export function isValidTimeInput(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

export function normalizeDateInput(value: string | null | undefined): string | null {
  return trimOrNull(value);
}

export function normalizeEmailInput(value: string | null | undefined): string | null {
  return trimOrNull(value)?.toLowerCase() ?? null;
}