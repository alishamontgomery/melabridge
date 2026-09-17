const DEFAULT_TIME_ZONE = "UTC";

export function validTimeZone(timeZone?: string | null): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/**
 * Formats an absolute timestamp in the recipient's saved timezone.
 */
export function formatEmailDateTime(
  value: string | Date,
  timeZone?: string | null,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const zone = validTimeZone(timeZone);

  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
  return `${datePart} at ${timePart}`;
}

/**
 * Formats a date and optional wall-clock time already entered for an event.
 * Keeping the wall-clock fields intact avoids shifting organizer-entered local
 * times while still deriving the correct DST abbreviation for the saved zone.
 */
export function formatEmailWallDateTime(
  dateValue?: string | null,
  timeValue?: string | null,
  timeZone?: string | null,
): string | null {
  if (!dateValue) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) return dateValue;

  const [, year, month, day] = match;
  const dateOnly = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  if (Number.isNaN(dateOnly.getTime())) return dateValue;

  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(dateOnly);

  if (!timeValue) return datePart;
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(timeValue);
  if (!timeMatch) return datePart;

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const timePart = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));

  const zone = validTimeZone(timeZone);
  const zoneName =
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "short",
    })
      .formatToParts(dateOnly)
      .find((part) => part.type === "timeZoneName")?.value ?? "UTC";

  return `${datePart} at ${timePart} ${zoneName}`;
}