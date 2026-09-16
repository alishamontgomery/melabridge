export type InvitationGuest = {
  id: string;
  email: string | null;
  invited_at: string | null;
};

export const MAX_INVITATIONS_PER_BATCH = 100;

export function defaultInvitationGuestIds(guests: InvitationGuest[]): string[] {
  return guests
    .filter((guest) => !!guest.email && !guest.invited_at)
    .slice(0, MAX_INVITATIONS_PER_BATCH)
    .map((guest) => guest.id);
}
