/**
 * MessageComposer — dialog for composing, previewing, and sending (or scheduling)
 * a message to a guest segment.
 *
 * Immediate sends: always available.
 * Schedule for later: available to all planners — the scheduled_for timestamp is
 * stored in event_communications and the background scheduler delivers it.
 */
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Mail, Users, Clock, Send, Loader2, Sparkles, ChevronDown,
  Calendar, X, AlertTriangle, PlayCircle, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  sendEventMessage,
  previewRecipientCount,
  cancelScheduledMessage,
  sendScheduledNow,
  type RecipientGroup,
} from "@/lib/event-comms.functions";
import { useMelaAssistOptional } from "@/components/melaassist/context";

export const GROUP_LABELS: Record<RecipientGroup, string> = {
  all_guests: "All guests",
  confirmed: "Confirmed (attending)",
  pending: "Pending RSVP",
  declined: "Declined",
  ticket_holders: "Ticket holders",
  checked_in: "Checked-in attendees",
};

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  onSent?: () => void;
}

/** Local datetime string → UTC ISO datetime string, or undefined if blank. */
function localToUtc(local: string): string | undefined {
  if (!local) return undefined;
  return new Date(local).toISOString();
}

/** Min datetime string for the schedule picker (now + 5 minutes). */
function minScheduleLocal(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  // Format as YYYY-MM-DDTHH:MM (local time, for <input type="datetime-local">)
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MessageComposer({ open, onClose, eventId, eventName, onSent }: Props) {
  const [group, setGroup] = useState<RecipientGroup>("all_guests");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const sendFn = useServerFn(sendEventMessage);
  const countFn = useServerFn(previewRecipientCount);
  const melaAssist = useMelaAssistOptional();

  useEffect(() => {
    if (!open) return;
    setCounting(true);
    countFn({ data: { eventId, group } })
      .then((r) => setRecipientCount(r.count))
      .catch(() => setRecipientCount(null))
      .finally(() => setCounting(false));
  }, [group, eventId, open, countFn]);

  function reset() {
    setSubject(""); setBody(""); setGroup("all_guests");
    setScheduleEnabled(false); setScheduleLocal("");
    setShowPreview(false);
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      toast.error("Please fill in the subject and body.");
      return;
    }
    if (scheduleEnabled && !scheduleLocal) {
      toast.error("Please choose a send date and time.");
      return;
    }
    const scheduledFor = scheduleEnabled ? localToUtc(scheduleLocal) : undefined;
    if (scheduledFor && new Date(scheduledFor) <= new Date()) {
      toast.error("Scheduled time must be in the future.");
      return;
    }

    setSending(true);
    try {
      const result = await sendFn({
        data: {
          eventId,
          subject,
          body,
          recipientGroup: group,
          scheduledFor,
          baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });

      if (result.status === "scheduled") {
        toast.success(
          `Message scheduled for ${new Date(scheduledFor!).toLocaleString(undefined, {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          })} · ${result.recipientCount} recipient${result.recipientCount !== 1 ? "s" : ""}`
        );
      } else {
        toast.success(
          `Message sent to ${result.recipientCount} recipient${result.recipientCount !== 1 ? "s" : ""}!`
        );
      }
      reset();
      onSent?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  function openMelaAssist() {
    melaAssist?.openAssistant({
      initialPrompt: `Draft a clear and friendly in-app update for the "${eventName}" event. The selected audience is: ${GROUP_LABELS[group].toLowerCase()}. Subject line is: "${subject || "(not set yet)"}". Keep it warm and concise.`,
    });
  }

  const sendLabel = scheduleEnabled
    ? "Schedule in-app update"
    : "Post in-app update";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {scheduleEnabled ? "Schedule in-app update" : "Post in-app update"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            MelaBridge account holders in the selected group receive an in-app notification.
            Guests without an account remain in your guest list but will not receive an email.
          </p>
          {/* Recipients */}
          <div className="space-y-1.5">
            <Label>Recipients</Label>
            <div className="flex items-center gap-3">
              <Select value={group} onValueChange={(v) => setGroup(v as RecipientGroup)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(GROUP_LABELS) as [RecipientGroup, string][]).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
                <Users className="h-4 w-4" />
                {counting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <span>{recipientCount ?? "—"} recipient{recipientCount !== 1 ? "s" : ""}</span>}
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="msg-subject">Subject</Label>
            <Input
              id="msg-subject"
              placeholder={`Message from ${eventName} organiser…`}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="msg-body">Message</Label>
              {melaAssist && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-primary h-auto py-0.5 text-xs"
                  onClick={openMelaAssist}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Draft with MelaAssist
                </Button>
              )}
            </div>
            <Textarea
              id="msg-body"
              rows={6}
              placeholder="Write your message here…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
            />
            <p className="text-right text-xs text-muted-foreground">{body.length}/5000</p>
          </div>

          {/* Schedule toggle */}
          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Schedule for later</span>
              </div>
              <Switch
                checked={scheduleEnabled}
                onCheckedChange={(v) => {
                  setScheduleEnabled(v);
                  if (!v) setScheduleLocal("");
                }}
              />
            </div>
            {scheduleEnabled && (
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="msg-schedule">Send at</Label>
                <Input
                  id="msg-schedule"
                  type="datetime-local"
                  value={scheduleLocal}
                  min={minScheduleLocal()}
                  onChange={(e) => setScheduleLocal(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  The message will be delivered by the background scheduler (within ~5 minutes of the chosen time).
                </p>
              </div>
            )}
          </div>

          {/* Preview toggle */}
          {subject && body && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowPreview((p) => !p)}
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${showPreview ? "rotate-180" : ""}`} />
                {showPreview ? "Hide preview" : "Show preview"}
              </Button>
              {showPreview && (
                <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
                  <p className="mb-1 font-semibold">Subject: {subject}</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{body}</p>
                </div>
              )}
            </div>
          )}

          {/* Delivery note */}
          <div className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">How it's delivered: </span>
            Guests with MelaBridge accounts receive an in-app notification and an email.
            Guests without accounts receive an email only.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            disabled={sending || !subject.trim() || !body.trim() || recipientCount === 0}
            onClick={handleSend}
            className="gap-2"
          >
            {sending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {scheduleEnabled ? "Scheduling…" : "Sending…"}</>
              : <><Send className="h-4 w-4" /> {sendLabel}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Communications history ───────────────────────────────────────────────────

type CommRecord = {
  id: string;
  subject: string;
  body: string;
  recipient_group: RecipientGroup;
  recipient_count: number;
  sent_at: string | null;
  scheduled_for: string | null;
  status: "sent" | "scheduled" | "failed";
  created_at: string;
};

interface HistoryProps {
  comms: CommRecord[];
  onRefresh: () => void;
}

export function CommunicationsHistory({ comms, onRefresh }: HistoryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CommRecord | null>(null);
  const [sendingNow, setSendingNow] = useState<string | null>(null);
  const cancelFn = useServerFn(cancelScheduledMessage);
  const sendNowFn = useServerFn(sendScheduledNow);

  async function handleCancel(comm: CommRecord) {
    try {
      await cancelFn({ data: { commId: comm.id } });
      toast.success("Scheduled message cancelled");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setCancelTarget(null);
    }
  }

  async function handleSendNow(comm: CommRecord) {
    setSendingNow(comm.id);
    try {
      const result = await sendNowFn({ data: { commId: comm.id } });
      toast.success(`Update processed for ${result.recipientCount} selected guest${result.recipientCount !== 1 ? "s" : ""}. Account holders were notified in app.`);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSendingNow(null);
    }
  }

  if (comms.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 p-8 text-center text-sm text-muted-foreground">
        <Mail className="mx-auto mb-3 h-8 w-8 opacity-30" />
        <p>No updates yet. Use <strong>Post update</strong> above to notify guests who have MelaBridge accounts.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {comms.map((c) => (
          <div key={c.id} className="rounded-xl border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">{c.subject}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {GROUP_LABELS[c.recipient_group]} · {c.recipient_count} recipient{c.recipient_count !== 1 ? "s" : ""}
                  </span>
                  {c.status === "scheduled" && c.scheduled_for && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <Calendar className="h-3 w-3" />
                      Scheduled for{" "}
                      {new Date(c.scheduled_for).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </span>
                  )}
                  {c.status === "sent" && c.sent_at && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(c.sent_at).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize ${
                      c.status === "sent"
                        ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"
                        : c.status === "scheduled"
                        ? "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30"
                        : "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30"
                    }`}
                  >
                    {c.status === "sent" ? "posted" : c.status}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {c.status === "scheduled" && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs h-7"
                      disabled={sendingNow === c.id}
                      onClick={() => handleSendNow(c)}
                      title="Send now instead of waiting"
                    >
                      {sendingNow === c.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />}
                      Send now
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => setCancelTarget(c)}
                      title="Cancel scheduled message"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                >
                  {expanded === c.id ? "Hide" : "View"}
                </Button>
              </div>
            </div>

            {expanded === c.id && (
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                {c.body}
              </p>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        destructive
        title="Cancel this scheduled message?"
        description={
          <p>
            The message <strong>"{cancelTarget?.subject}"</strong> scheduled for{" "}
            {cancelTarget?.scheduled_for
              ? new Date(cancelTarget.scheduled_for).toLocaleString(undefined, {
                  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                })
              : "—"}{" "}
            will be deleted and not sent.
          </p>
        }
        confirmLabel="Cancel message"
        onConfirm={async () => { if (cancelTarget) await handleCancel(cancelTarget); }}
      />
    </>
  );
}
