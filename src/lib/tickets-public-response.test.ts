import { describe, expect, it } from "vitest";
import { buildPublicTicketRecord } from "./tickets.functions";

describe("buildPublicTicketRecord", () => {
  it("returns only fields needed to display one ticket", () => {
    const result = buildPublicTicketRecord(
      {
        id: "attendee-1",
        full_name: "Ticket Guest",
        checked_in_at: null,
        email: "guest@example.com",
        qr_code: "shared-secret",
      } as never,
      {
        id: "order-1",
        buyer_name: "Private Buyer",
        buyer_email: "buyer@example.com",
        quantity: 4,
        amount_cents: 12000,
        currency: "usd",
        status: "paid",
      } as never,
      {
        id: "event-1",
        name: "Launch Party",
        event_date: "2026-09-17",
        event_time: "18:00",
        end_time: "21:00",
        location: "Main Hall",
        description: "An event",
      },
      {
        id: "type-1",
        name: "General Admission",
        description: "Entry",
        price_cents: 3000,
      } as never,
    );

    expect(result).toEqual({
      attendee: {
        id: "attendee-1",
        full_name: "Ticket Guest",
        checked_in_at: null,
      },
      order: { id: "order-1" },
      event: {
        id: "event-1",
        name: "Launch Party",
        event_date: "2026-09-17",
        event_time: "18:00",
        end_time: "21:00",
        location: "Main Hall",
        description: "An event",
      },
      type: {
        id: "type-1",
        name: "General Admission",
        description: "Entry",
      },
    });
  });
});