import { describe, expect, it } from "vitest";
import { defaultInvitationGuestIds, MAX_INVITATIONS_PER_BATCH } from "./invitation-selection";

describe("defaultInvitationGuestIds", () => {
  it("advances to the next uninvited guests after a 100-person batch", () => {
    const guests = Array.from({ length: 150 }, (_, index) => ({
      id: `guest-${index}`,
      email: `guest-${index}@example.com`,
      invited_at: index < 100 ? "2026-09-09T12:00:00.000Z" : null,
    }));

    const nextBatch = defaultInvitationGuestIds(guests);

    expect(nextBatch).toHaveLength(50);
    expect(nextBatch).toEqual(guests.slice(100).map((guest) => guest.id));
    expect(nextBatch).not.toContain("guest-0");
  });

  it("caps a new batch at the provider-safe limit", () => {
    const guests = Array.from({ length: 150 }, (_, index) => ({
      id: `guest-${index}`,
      email: `guest-${index}@example.com`,
      invited_at: null,
    }));

    expect(defaultInvitationGuestIds(guests)).toHaveLength(MAX_INVITATIONS_PER_BATCH);
  });
});
