type CalendarEvent = {
  id: string;
  starts_at: string;
  ends_at: string;
  event_name?: string | null;
  venue_name?: string | null;
  address?: string | null;
  updated_at?: string | null;
};

type BlockedDate = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  updated_at?: string | null;
};

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function utcDate(value: string): string {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function dateOnly(value: string): string {
  return value.replace(/-/g, "");
}

function nextDay(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function fold(line: string): string {
  const chunks: string[] = [];
  let chunk = "";
  let chunkBytes = 0;
  let limit = 75;

  for (const character of line) {
    const bytes = new TextEncoder().encode(character).length;
    if (chunk && chunkBytes + bytes > limit) {
      chunks.push(chunk);
      chunk = "";
      chunkBytes = 0;
      limit = 74;
    }
    chunk += character;
    chunkBytes += bytes;
  }
  chunks.push(chunk);
  return chunks.join("\r\n ");
}

export type VendorCalendarFeedOptions = {
  includeEventName?: boolean;
  includeVenue?: boolean;
  includeAddress?: boolean;
};

export function buildVendorCalendar(
  vendorId: string,
  events: CalendarEvent[],
  blockedDates: BlockedDate[],
  options: VendorCalendarFeedOptions = {},
): string {
  const now = new Date().toISOString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MelaBridge//Vendor Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:MelaBridge Bookings",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const event of events) {
    const summary =
      options.includeEventName && event.event_name?.trim()
        ? event.event_name.trim()
        : "Confirmed booking";
    const location = [
      options.includeVenue ? event.venue_name?.trim() : null,
      options.includeAddress ? event.address?.trim() : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(", ");

    lines.push(
      "BEGIN:VEVENT",
      `UID:booking-${event.id}@melabridge.com`,
      `DTSTAMP:${utcDate(event.updated_at ?? event.starts_at)}`,
      `DTSTART:${utcDate(event.starts_at)}`,
      `DTEND:${utcDate(event.ends_at)}`,
      `SUMMARY:${escapeText(summary)}`,
    );
    if (location) lines.push(`LOCATION:${escapeText(location)}`);
    lines.push("STATUS:CONFIRMED", "TRANSP:OPAQUE", "END:VEVENT");
  }

  for (const block of blockedDates) {
    const label = block.reason.replace(/_/g, " ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:blocked-${block.id}-${vendorId}@melabridge.com`,
      `DTSTAMP:${utcDate(block.updated_at ?? now)}`,
      `DTSTART;VALUE=DATE:${dateOnly(block.start_date)}`,
      `DTEND;VALUE=DATE:${dateOnly(nextDay(block.end_date))}`,
      `SUMMARY:${escapeText(`Unavailable — ${label}`)}`,
    );
    lines.push("TRANSP:OPAQUE", "END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}