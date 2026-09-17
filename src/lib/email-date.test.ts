import { describe, expect, it } from "vitest";
import {
  formatEmailDateTime,
  formatEmailWallDateTime,
  validTimeZone,
} from "./email-date";

describe("email date formatting", () => {
  it("formats absolute timestamps in the saved timezone", () => {
    expect(
      formatEmailDateTime("2026-06-14T18:00:00.000Z", "America/New_York"),
    ).toBe("Sunday, June 14, 2026 at 2:00 PM EDT");
  });

  it("keeps event wall time and includes the DST abbreviation", () => {
    expect(
      formatEmailWallDateTime("2026-06-14", "14:00", "America/New_York"),
    ).toBe("Sunday, June 14, 2026 at 2:00 PM EDT");
  });

  it("falls back to UTC when no valid timezone is stored", () => {
    expect(validTimeZone("Not/A_Zone")).toBe("UTC");
    expect(formatEmailWallDateTime("2026-12-14", "10:00", null)).toBe(
      "Monday, December 14, 2026 at 10:00 AM UTC",
    );
  });
});