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
    const calendar = buildVendorCalendar("vendor-1", [], [
      {
        id: "block-with-a-very-long-identifier-that-forces-the-uid-content-line-to-fold-🎉🎉🎉",
        start_date: "2026-09-20",
        end_date: "2026-09-20",
        reason: "vacation",
      },
    ]);

    for (const line of calendar.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(calendar).toContain("🎉🎉🎉");
  });
});