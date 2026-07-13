import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Inbox, ArrowLeft, Check, X, CalendarClock } from "lucide-react";
import { listBookingRequests, respondToBookingRequest } from "@/lib/calendar.functions";

export const Route = createFileRoute("/_authenticated/calendar/requests")({
  head: () => ({
    meta: [
      { title: "Booking Requests — MelaBridge" },
      { name: "description", content: "Approve, decline, or propose an alternate date for booking requests." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RequestsPage,
});

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700",
  approved: "bg-emerald-500/15 text-emerald-700",
  declined: "bg-rose-500/15 text-rose-700",
  alternate_proposed: "bg-primary/15 text-primary",
  cancelled: "bg-muted text-muted-foreground",
};

function RequestsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listBookingRequests);
  const respond = useServerFn(respondToBookingRequest);
  const q = useQuery({ queryKey: ["cal-requests"], queryFn: () => list() });
  const [altFor, setAltFor] = useState<string | null>(null);
  const [alt, setAlt] = useState({ start: "", end: "", message: "" });

  return (
    <AppShell active="/calendar">
      <Link to="/calendar" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to calendar
      </Link>
      <div className="mt-2">
        <PageHeader
          eyebrow="Booking Requests"
          icon={Inbox}
          title={<>Pending <span className="text-gradient">approvals</span>.</>}
          description="Nothing lands on your calendar until you say yes."
        />
      </div>

      <div className="mt-6 space-y-3">
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data?.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">No booking requests yet.</Card>
        )}
        {q.data?.map((r: any) => (
          <Card key={r.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{r.event_name}</h3>
                  <Badge className={STATUS_STYLE[r.status]}>{r.status.replace("_", " ")}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(r.requested_start).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} →{" "}
                  {new Date(r.requested_end).toLocaleString([], { timeStyle: "short" })}
                </p>
                {r.client_name && <p className="mt-0.5 text-sm">Client: {r.client_name}</p>}
                {r.venue_name && <p className="text-sm text-muted-foreground">{r.venue_name}{r.address ? ` · ${r.address}` : ""}</p>}
                {r.message && <p className="mt-2 rounded-md bg-muted/40 p-2 text-sm">{r.message}</p>}
                {r.status === "alternate_proposed" && r.alternate_start && (
                  <p className="mt-2 text-sm text-primary">
                    Proposed alternate: {new Date(r.alternate_start).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    {r.alternate_message ? ` — ${r.alternate_message}` : ""}
                  </p>
                )}
              </div>
              {r.status === "pending" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="hero"
                    onClick={async () => {
                      try {
                        await respond({ data: { id: r.id, action: "approve" } });
                        toast.success("Approved");
                        qc.invalidateQueries({ queryKey: ["cal-requests"] });
                      } catch (e: any) { toast.error(e.message); }
                    }}
                  >
                    <Check className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAltFor(altFor === r.id ? null : r.id)}
                  >
                    <CalendarClock className="mr-1 h-4 w-4" /> Propose alternate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await respond({ data: { id: r.id, action: "decline" } });
                      toast.success("Declined");
                      qc.invalidateQueries({ queryKey: ["cal-requests"] });
                    }}
                  >
                    <X className="mr-1 h-4 w-4" /> Decline
                  </Button>
                </div>
              )}
            </div>
            {altFor === r.id && (
              <div className="mt-4 grid gap-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-4">
                <Input type="datetime-local" value={alt.start} onChange={(e) => setAlt({ ...alt, start: e.target.value })} />
                <Input type="datetime-local" value={alt.end} onChange={(e) => setAlt({ ...alt, end: e.target.value })} />
                <Textarea rows={1} className="min-h-[38px]" placeholder="Message" value={alt.message} onChange={(e) => setAlt({ ...alt, message: e.target.value })} />
                <Button
                  onClick={async () => {
                    if (!alt.start || !alt.end) return toast.error("Pick both times");
                    await respond({
                      data: {
                        id: r.id,
                        action: "propose_alternate",
                        alternate_start: new Date(alt.start).toISOString(),
                        alternate_end: new Date(alt.end).toISOString(),
                        alternate_message: alt.message,
                      },
                    });
                    toast.success("Alternate proposed");
                    setAltFor(null);
                    setAlt({ start: "", end: "", message: "" });
                    qc.invalidateQueries({ queryKey: ["cal-requests"] });
                  }}
                >
                  Send
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
