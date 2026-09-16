import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Briefcase, Loader2, ArrowLeft, MoreHorizontal } from "lucide-react";
import { BookingProgressTracker } from "@/components/booking/BookingProgressTracker";
import { BookingStageBadge } from "@/components/booking/BookingStageBadge";
import { stageMeta, type BookingStage } from "@/lib/booking-stages";
import {
  advanceLeadStage, cancelBooking, getBooking,
  markException, reopenBooking,
} from "@/lib/bookings.functions";
import { useRole } from "@/lib/use-role";

export const Route = createFileRoute("/_authenticated/bookings/$id")({
  head: () => ({ meta: [{ title: "Lead — MelaBridge" }] }),
  component: BookingDetail,
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">Could not load this lead. {import.meta.env.DEV ? error.message : ""}</div>,
  notFoundComponent: () => <div className="p-8">Lead not found.</div>,
});

function BookingDetail() {
  const { id } = Route.useParams();
  const { role } = useRole();
  const isVendor = role === "vendor";
  const getFn = useServerFn(getBooking);
  const advance = useServerFn(advanceLeadStage);
  const cancelFn = useServerFn(cancelBooking);
  const exceptionFn = useServerFn(markException);
  const reopenFn = useServerFn(reopenBooking);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["booking", id] });
    qc.invalidateQueries({ queryKey: ["bookings"] });
  };

  useEffect(() => {
    const ch = supabase
      .channel(`booking-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_bookings", filter: `id=eq.${id}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_booking_events", filter: `booking_id=eq.${id}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_invoices", filter: `booking_id=eq.${id}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_payment_schedule", filter: `booking_id=eq.${id}` }, invalidate)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const advanceM = useMutation({
    mutationFn: (stage: "quote_sent" | "booked") => advance({ data: { bookingId: id, stage } }),
    onSuccess: (_result, stage) => {
      toast.success(stage === "booked" ? "Lead marked as hired" : "Lead marked as interested");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const cancelM = useMutation({
    mutationFn: (reason?: string) => cancelFn({ data: { bookingId: id, reason } }),
    onSuccess: () => { toast.success("Lead archived"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const exceptionM = useMutation({
    mutationFn: (stage: "no_response" | "lost") => exceptionFn({ data: { bookingId: id, stage } }),
    onSuccess: (_r, stage) => { toast.success(stage === "lost" ? "Marked as lost" : "Marked as no response"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const reopenM = useMutation({
    mutationFn: () => reopenFn({ data: { bookingId: id } }),
    onSuccess: () => { toast.success("Lead reopened"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  if (isLoading || !data) {
    return (
      <AppShell active="/bookings">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }

  const b = data.booking;
  const events = data.events;
  const stage = b.current_stage as BookingStage;
  const isTerminal = stage === "cancelled" || stage === "no_response" || stage === "lost" || stage === "completed" || stage === "reviewed";
  const waiting = null; // Status shown via stage tracker; no platform-side gating

  const timestamps: Partial<Record<BookingStage, string | null | undefined>> = {
    quote_sent: b.quote_sent_at,
    quote_viewed: (b as any).quote_viewed_at,
    quote_accepted: (b as any).quote_accepted_at,
    contract_sent: b.contract_sent_at,
    contract_signed: b.contract_signed_at,
    deposit_paid: b.deposit_paid_at,
    booked: b.confirmed_at,
    in_progress: (b as any).in_progress_at,
    completed: b.completed_at,
    review_requested: (b as any).review_requested_at,
    reviewed: (b as any).reviewed_at,
  };

  return (
    <AppShell active="/bookings">
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="w-fit"><Link to="/bookings"><ArrowLeft className="mr-1 h-4 w-4" /> All leads</Link></Button>
        <PageHeader
          eyebrow={b.category}
          icon={Briefcase}
          title={b.title}
          description={b.vendor_profiles?.business_name ?? "Vendor"}
          actions={<BookingStageBadge stage={stage} />}
        />

        <Card className="p-5">
          <BookingProgressTracker currentStage={stage} waitingFor={waiting} timestamps={timestamps} />
        </Card>

        {/* Action row — Cancel is available to both sides; vendor-only exception tools are gated */}
        <div className="flex flex-wrap items-center gap-2">
          {!isTerminal && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Archive this lead? This will remove it from your active pipeline.")) {
                  cancelM.mutate(undefined);
                }
              }}
              disabled={cancelM.isPending}
            >
              {cancelM.isPending ? "Archiving…" : "Archive lead"}
            </Button>
          )}

          {/* Vendor-only: pipeline exception tools */}
          {isVendor && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <MoreHorizontal className="h-4 w-4" /> More actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>Lead actions</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={isTerminal || exceptionM.isPending}
                  onClick={() => exceptionM.mutate("no_response")}
                >
                  Mark as unresponsive
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isTerminal || exceptionM.isPending}
                  onClick={() => exceptionM.mutate("lost")}
                >
                  Mark as lost
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!isTerminal || reopenM.isPending}
                  onClick={() => reopenM.mutate()}
                >
                  Reopen lead
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Vendor-only: CRM tracking without recording money or contracts */}
        {isVendor && (
          <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <h3 className="font-display text-base font-semibold">Update lead stage</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Track your conversation here. Agreements and payments stay between you and the client.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => advanceM.mutate("quote_sent")}
                disabled={advanceM.isPending || stage === "quote_sent" || stage === "booked"}
              >
                {advanceM.isPending ? "Saving…" : "Mark as Interested"}
              </Button>
              <Button
                onClick={() => advanceM.mutate("booked")}
                disabled={advanceM.isPending || stage === "booked" || stage === "completed"}
              >
                {advanceM.isPending ? "Saving…" : "Mark as Hired"}
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-5">
          <h3 className="mb-3 font-display text-base font-semibold">History</h3>
          <ol className="space-y-2">
            {events.map((ev: any) => {
              const m = stageMeta(ev.stage as BookingStage);
              const Icon = m.icon;
              return (
                <li key={ev.id} className="flex items-start gap-3 text-sm">
                  <div className={`mt-0.5 rounded-full p-1.5 ${m.tone}`}><Icon className="h-3 w-3" /></div>
                  <div className="flex-1">
                    <p className="font-medium">{m.label}</p>
                    {ev.note && <p className="text-xs text-muted-foreground">{ev.note}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(ev.occurred_at).toLocaleString()}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

      </div>
    </AppShell>
  );
}

