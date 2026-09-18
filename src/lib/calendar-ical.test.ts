import { describe, expect, it } from "vitest";
import { buildVendorCalendar } from "./calendar-ical";

describe("buildVendorCalendar", () => {
  it("exports confirmed bookings and inclusive blocked date ranges", () => {
    const calendar = buildVendorCalendar(
      "vendor-1",
      [
        {
          id: "event-1",
          starts_at: "2026-09-12T18:00:00.000Z",
          ends_at: "2026-09-12T22:00:00.000Z",
          updated_at: "2026-09-10T12:00:00.000Z",
        },
      ],
      [
        {
          id: "block-1",
          start_date: "2026-09-20",
          end_date: "2026-09-22",
          reason: "day_off",
          updated_at: "2026-09-10T12:00:00.000Z",
        },
      ],
    );

    expect(calendar).toContain("DTSTART:20260912T180000Z");
    expect(calendar).toContain("DTEND:20260912T220000Z");
    expect(calendar).toContain("SUMMARY:Confirmed booking");
    expect(calendar).toContain("DTSTART;VALUE=DATE:20260920");
    expect(calendar).toContain("DTEND;VALUE=DATE:20260923");
    expect(calendar).toContain("SUMMARY:Unavailable — day off");
    expect(calendar.endsWith("\r\n")).toBe(true);
  });

  it("folds long Unicode lines at 75 UTF-8 octets without corrupting characters", () => {
    const calendar = buildVendorCalendar(
      "vendor-1",
      [],
      [
        {
          id: "block-with-a-very-long-identifier-that-forces-the-uid-content-line-to-fold-🎉🎉🎉",
          start_date: "2026-09-20",
          end_date: "2026-09-20",
          reason: "vacation",
        },
      ],
    );

    for (const line of calendar.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(calendar).toContain("🎉🎉🎉");
  });

  it("includes only the vendor-enabled booking details", () => {
    const calendar = buildVendorCalendar(
      "vendor-1",
      [
        {
          id: "event-1",
          starts_at: "2026-09-12T18:00:00.000Z",
          ends_at: "2026-09-12T22:00:00.000Z",
          event_name: "Mela & Sam's Wedding",
          venue_name: "The Garden",
          address: "123 Main St, Austin",
        },
      ],
      [],
      { includeEventName: true, includeVenue: true, includeAddress: false },
    );

    expect(calendar).toContain("SUMMARY:Mela & Sam's Wedding");
    expect(calendar).toContain("LOCATION:The Garden");
    expect(calendar).not.toContain("123 Main St");
  });

  it("keeps existing feeds privacy-minimized when no options are provided", () => {
    const calendar = buildVendorCalendar(
      "vendor-1",
      [
        {
          id: "event-1",
          starts_at: "2026-09-12T18:00:00.000Z",
          ends_at: "2026-09-12T22:00:00.000Z",
          event_name: "Private event name",
          venue_name: "Private venue",
          address: "Private address",
        },
      ],
      [],
    );

    expect(calendar).toContain("SUMMARY:Confirmed booking");
    expect(calendar).not.toContain("Private event name");
    expect(calendar).not.toContain("Private venue");
    expect(calendar).not.toContain("Private address");
  });

  it("keeps event UIDs stable when a subscribed feed receives updated booking data", () => {
    const initial = buildVendorCalendar(
      "vendor-1",
      [
        {
          id: "event-1",
          starts_at: "2026-09-12T18:00:00.000Z",
          ends_at: "2026-09-12T22:00:00.000Z",
          updated_at: "2026-09-10T12:00:00.000Z",
        },
      ],
      [],
    );
    const updated = buildVendorCalendar(
      "vendor-1",
      [
        {
          id: "event-1",
          starts_at: "2026-09-13T19:00:00.000Z",
          ends_at: "2026-09-13T23:00:00.000Z",
          updated_at: "2026-09-11T12:00:00.000Z",
        },
      ],
      [],
    );

    expect(initial).toContain("UID:booking-event-1@melabridge.com");
    expect(updated).toContain("UID:booking-event-1@melabridge.com");
    expect(updated).toContain("DTSTART:20260913T190000Z");
    expect(updated).toContain("DTEND:20260913T230000Z");
    expect(updated).not.toContain("DTSTART:20260912T180000Z");
    expect(updated).not.toContain("DTEND:20260912T220000Z");
  });
});
