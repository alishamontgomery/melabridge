import { describe, expect, it } from "vitest";
import { eventIdFromPathname, getPageContext } from "./page-context";

describe("MelaAssist page context", () => {
  it.each(["/files", "/collaboration", "/settings"])(
    "provides a helpful no-event prompt on %s",
    (pathname) => {
      const context = getPageContext(pathname, "personal");

      expect(context.surface).toBe("MelaBridge");
      expect(context.greeting).toMatch(/what would you like help with/i);
      expect(context.suggestions.length).toBeGreaterThan(0);
    },
  );

  it("initializes event-specific suggestions on an event page", () => {
    const context = getPageContext(
      "/events/123e4567-e89b-42d3-a456-426614174000",
      "organization",
    );

    expect(context.surface).toBe("Event page");
    expect(context.greeting).toMatch(/for this event/i);
  });
});

describe("eventIdFromPathname", () => {
  it("reads a UUID from an event detail page", () => {
    expect(
      eventIdFromPathname("/events/123e4567-e89b-42d3-a456-426614174000"),
    ).toBe("123e4567-e89b-42d3-a456-426614174000");
  });

  it.each(["/dashboard", "/files", "/marketplace", "/events", "/events/new", "/events/ai-new"])(
    "does not invent event context for %s",
    (pathname) => {
      expect(eventIdFromPathname(pathname)).toBeNull();
    },
  );
});