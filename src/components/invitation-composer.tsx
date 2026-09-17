import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendGuestInvitations } from "@/lib/event-comms.functions";
import { defaultInvitationGuestIds, MAX_INVITATIONS_PER_BATCH } from "@/lib/invitation-selection";

type GuestChoice = { id: string; full_name: string; email: string | null; invited_at: string | null };

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  guests: GuestChoice[];
  onSent: () => Promise<void>;
}

export function InvitationComposer({ open, onClose, eventId, eventName, guests, onSent }: Props) {
  const eligible = useMemo(() => guests.filter((guest) => !!guest.email), [guests]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState(`We would love for you to join us for ${eventName}. Please let us know if you can make it.`);
  const [sending, setSending] = useState(false);
  const sendFn = useServerFn(sendGuestInvitations);

  useEffect(() => {
    if (open) setSelected(defaultInvitationGuestIds(guests));
  }, [open, guests]);

  async function send() {
    if (selected.length === 0) return toast.error("Select at least one guest.");
    setSending(true);
    try {
      const result = await sendFn({
        data: {
          eventId,
          guestIds: selected,
          message,
          requestId: crypto.randomUUID(),
        },
      });
      if (result.sentCount === 0) {
        if (result.providerDisabled) {
          throw new Error("Email delivery is not configured right now. Please try again later.");
        }
        if (result.invalidCount > 0 && result.failedCount === 0) {
          throw new Error("The selected guests do not have valid email addresses.");
        }
        throw new Error("Email delivery failed. Please check the selected addresses and try again.");
      }
      toast.success(`Invitation${result.sentCount === 1 ? "" : "s"} sent to ${result.sentCount} guest${result.sentCount === 1 ? "" : "s"}.`);
      if (result.failedCount > 0) toast.warning(`${result.failedCount} invitation${result.failedCount === 1 ? "" : "s"} could not be delivered.`);
      if (result.invalidCount > 0) toast.warning(`${result.invalidCount} selected guest${result.invalidCount === 1 ? "" : "s"} had no valid email address.`);
      await onSent();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send invitations");
    } finally {
      setSending(false);
    }
  }

  const defaultBatch = defaultInvitationGuestIds(guests);
  const defaultBatchSelected = defaultBatch.length > 0 && defaultBatch.every((id) => selected.includes(id));

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> Send invitations</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">Each selected guest receives a personal invitation with secure Yes and No RSVP buttons.</p>
          {guests.filter((guest) => !!guest.email).length > 100 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              To protect email delivery, each batch is limited to 100 guests. After the cooldown, the next uninvited guests will be selected automatically.
            </p>
          )}
          <div className="rounded-xl border border-border/60">
            <label className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 font-medium">
              <Checkbox checked={defaultBatchSelected} onCheckedChange={(checked) => setSelected(checked ? defaultBatch : [])} />
              Select next batch ({defaultBatch.length} of {eligible.length})
            </label>
            <div className="max-h-52 overflow-y-auto">
              {eligible.map((guest) => (
                <label key={guest.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/30">
                  <Checkbox
                    checked={selected.includes(guest.id)}
                    disabled={!selected.includes(guest.id) && selected.length >= MAX_INVITATIONS_PER_BATCH}
                    onCheckedChange={(checked) => setSelected((current) => checked ? [...current, guest.id].slice(0, MAX_INVITATIONS_PER_BATCH) : current.filter((id) => id !== guest.id))}
                  />
                  <span className="min-w-0 text-sm">
                    <span className="block font-medium">{guest.full_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{guest.email}</span>
                  </span>
                </label>
              ))}
              {eligible.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Add an email address to a guest before inviting them.</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invitation-message">Invitation message</Label>
            <Textarea id="invitation-message" rows={5} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="gap-2" disabled={sending || selected.length === 0 || !message.trim()} onClick={send}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending…" : `Send ${selected.length || ""} invitation${selected.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}