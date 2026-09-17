import { beforeEach, describe, expect, it, vi } from "vitest";

const ORDER_ID = "34aa928d-75db-40ef-bbda-e02698128178";
const ACCESS_TOKEN = "5e7606d2-8101-4241-8d93-7f07cc6358f4";
const WRONG_TOKEN = "6974e576-fefc-4ca6-b4f7-49610fb69031";

type OrderStatus = "free" | "paid";

const state = vi.hoisted(() => ({
  orderStatus: "paid" as OrderStatus,
  orderFilters: [] as Array<[string, unknown]>,
  tablesRead: [] as string[],
  pdfBuilds: 0,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      state.tablesRead.push(table);
      const filters: Record<string, unknown> = {};
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          if (table === "ticket_orders") state.orderFilters.push([column, value]);
          return query;
        },
        order() {
          return Promise.resolve({
            data: table === "ticket_attendees"
              ? [{ id: "attendee-1", qr_code: "qr-secret", full_name: "Guest", checked_in_at: null }]
              : [],
            error: null,
          });
        },
        maybeSingle() {
          if (table === "ticket_orders") {
            const authorized = filters.id === ORDER_ID && filters.access_token === ACCESS_TOKEN;
            return Promise.resolve({
              data: authorized
                ? {
                    id: ORDER_ID,
                    event_id: "event-1",
                    ticket_type_id: "type-1",
                    buyer_name: "Buyer",
                    buyer_email: "buyer@example.com",
                    quantity: 1,
                    amount_cents: state.orderStatus === "free" ? 0 : 2500,
                    currency: "usd",
                    status: state.orderStatus,
                    created_at: "2026-09-17T12:00:00Z",
                  }
                : null,
              error: null,
            });
          }
          if (table === "events") {
            return Promise.resolve({
              data: {
                id: "event-1",
                name: "Secure Event",
                event_date: "2026-09-18",
                event_time: "18:00",
                location: "Main Hall",
                description: null,
              },
              error: null,
            });
          }
          if (table === "ticket_types") {
            return Promise.resolve({
              data: { id: "type-1", name: "Admission", price_cents: 2500 },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return query;
    },
  },
}));

vi.mock("@/lib/tickets-emails.server", () => ({
  buildTicketPdf: vi.fn(async () => {
    state.pdfBuilds += 1;
    return new Uint8Array([1, 2, 3]);
  }),
}));

import {
  getPublicOrderDetailsHandler,
  getPublicOrderTicketsPdfHandler,
  PublicOrderAccessInput,
} from "./tickets.functions";

describe("ticket confirmation order capability", () => {
  beforeEach(() => {
    state.orderStatus = "paid";
    state.orderFilters.length = 0;
    state.tablesRead.length = 0;
    state.pdfBuilds = 0;
  });

  it("rejects an order ID without an access token before reading buyer details or QR codes", async () => {
    expect(() => PublicOrderAccessInput.parse({ orderId: ORDER_ID })).toThrow();

    expect(state.tablesRead).toEqual([]);
  });

  it("returns no order data and cannot build a PDF for the wrong token", async () => {
    await expect(getPublicOrderDetailsHandler({
      orderId: ORDER_ID, accessToken: WRONG_TOKEN,
    })).resolves.toBeNull();

    expect(state.orderFilters).toContainEqual(["access_token", WRONG_TOKEN]);
    expect(state.tablesRead).not.toContain("ticket_attendees");

    state.tablesRead.length = 0;
    await expect(getPublicOrderTicketsPdfHandler({
      orderId: ORDER_ID, accessToken: WRONG_TOKEN,
    })).rejects.toThrow("Order not found");

    expect(state.tablesRead).toEqual(["ticket_orders"]);
    expect(state.pdfBuilds).toBe(0);
  });

  it.each(["free", "paid"] as const)(
    "returns buyer details and QR codes for a matching token in the %s confirmation flow",
    async (status) => {
      state.orderStatus = status;

      const result = await getPublicOrderDetailsHandler({
        orderId: ORDER_ID, accessToken: ACCESS_TOKEN,
      });

      expect(result?.order).toMatchObject({
        id: ORDER_ID,
        buyer_email: "buyer@example.com",
        status,
      });
      expect(result?.attendees).toEqual([
        expect.objectContaining({ qr_code: "qr-secret" }),
      ]);
      expect(state.orderFilters).toContainEqual(["access_token", ACCESS_TOKEN]);
    },
  );

  it("builds an order PDF only when the token matches", async () => {
    const result = await getPublicOrderTicketsPdfHandler({
      orderId: ORDER_ID, accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({
      base64: "AQID",
      filename: `tickets-${ORDER_ID.slice(0, 8)}.pdf`,
    });
    expect(state.pdfBuilds).toBe(1);
  });
});