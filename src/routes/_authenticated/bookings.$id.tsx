import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Briefcase, Loader2, ArrowLeft } from "lucide-react";
import { BookingProgressTracker } from "@/components/booking/BookingProgressTracker";
import { BookingStageBadge } from "@/components/booking/BookingStageBadge";
import { STAGES, stageMeta, type BookingStage } from "@/lib/booking-stages";
import { advanceStage, cancelBooking, getBooking, recordDeposit, recordQuote, recordSchedulePayment } from "@/lib/bookings.functions";
import { Badge } from "@/components/ui/badge";
import { Receipt, CalendarClock as CalendarClockIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bookings/$id")({
  head: () => ({ meta: [{ title: "Booking — MelaBridge" }] }),
  component: BookingDetail,
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Booking not found.</div>,
});

const ACTION_STAGES: BookingStage[] = [
  "contacted", "consultation_scheduled", "quote_under_review",
  "contract_sent", "contract_signed", "in_progress", "completed", "review_requested", "reviewed",
];

function BookingDetail() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getBooking);
  const advance = useServerFn(advanceStage);
  const quote = useServerFn(recordQuote);
  const deposit = useServerFn(recordDeposit);
  const cancelFn = useServerFn(cancelBooking);
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
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const advanceM = useMutation({
    mutationFn: (stage: BookingStage) => advance({ data: { bookingId: id, stage } }),
    onSuccess: () => { toast.success("Stage updated"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const [quoteAmt, setQuoteAmt] = useState("");
  const [depositReq, setDepositReq] = useState("");
  const [depositAmt, setDepositAmt] = useState("");

  const quoteM = useMutation({
    mutationFn: () => quote({ data: { bookingId: id, amount: Number(quoteAmt), depositAmount: depositReq ? Number(depositReq) : null } }),
    onSuccess: () => { toast.success("Quote sent"); setQuoteAmt(""); setDepositReq(""); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const depositM = useMutation({
    mutationFn: () => deposit({ data: { bookingId: id, amount: Number(depositAmt) } }),
    onSuccess: () => { toast.success("Deposit recorded"); setDepositAmt(""); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const cancelM = useMutation({
    mutationFn: () => cancelFn({ data: { bookingId: id } }),
    onSuccess: () => { toast.success("Booking cancelled"); invalidate(); },
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
  const waiting =
    !b.confirmed_at && b.current_stage === "contract_signed" && !b.deposit_paid_at
      ? "Waiting for Deposit"
      : !b.confirmed_at && b.current_stage === "deposit_paid" && !b.contract_signed_at
      ? "Waiting for Contract Signature"
      : null;

  return (
    <AppShell active="/bookings">
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="w-fit"><Link to="/bookings"><ArrowLeft className="mr-1 h-4 w-4" /> All bookings</Link></Button>
        <PageHeader
          eyebrow={b.category}
          icon={Briefcase}
          title={b.title}
          description={b.vendor_profiles?.business_name ?? "Vendor"}
          actions={<BookingStageBadge stage={b.current_stage} />}
        />

        <Card className="p-5">
          <BookingProgressTracker currentStage={b.current_stage} waitingFor={waiting} />
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 p-5">
            <h3 className="font-display text-base font-semibold">Send quote</h3>
            <div className="grid gap-2">
              <Label>Quote amount ($)</Label>
              <Input type="number" value={quoteAmt} onChange={(e) => setQuoteAmt(e.target.value)} placeholder="5000" />
              <Label>Deposit required ($, optional)</Label>
              <Input type="number" value={depositReq} onChange={(e) => setDepositReq(e.target.value)} placeholder="1500" />
              <Button onClick={() => quoteM.mutate()} disabled={!quoteAmt || quoteM.isPending}>
                {quoteM.isPending ? "Sending…" : "Send quote"}
              </Button>
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <h3 className="font-display text-base font-semibold">Record deposit</h3>
            <div className="grid gap-2">
              <Label>Deposit received ($)</Label>
              <Input type="number" value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} placeholder="1500" />
              <p className="text-xs text-muted-foreground">
                Paid so far: ${Number(b.deposit_paid_amount ?? 0).toLocaleString()}
                {b.deposit_amount ? ` of $${Number(b.deposit_amount).toLocaleString()}` : ""}
              </p>
              <Button onClick={() => depositM.mutate()} disabled={!depositAmt || depositM.isPending}>
                {depositM.isPending ? "Recording…" : "Record deposit"}
              </Button>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="mb-3 font-display text-base font-semibold">Advance stage</h3>
          <div className="flex flex-wrap gap-2">
            {ACTION_STAGES.map((s) => {
              const m = stageMeta(s);
              const Icon = m.icon;
              return (
                <Button
                  key={s} variant="outline" size="sm"
                  onClick={() => advanceM.mutate(s)}
                  disabled={advanceM.isPending}
                >
                  <Icon className="mr-1.5 h-3.5 w-3.5" /> {m.label}
                </Button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            "Booked" cannot be set manually — it's applied automatically the moment the vendor's confirmation rule is satisfied.
          </p>
          {b.current_stage !== "cancelled" && b.current_stage !== "completed" && (
            <div className="mt-4 border-t pt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Cancel this booking? This releases any calendar hold and notifies both parties.")) {
                    cancelM.mutate();
                  }
                }}
                disabled={cancelM.isPending}
              >
                {cancelM.isPending ? "Cancelling…" : "Cancel booking"}
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 font-display text-base font-semibold">History</h3>
          <ol className="space-y-2">
            {events.map((ev: any) => {
              const m = stageMeta(ev.stage);
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

        <InvoicesAndSchedule
          invoices={data.invoices ?? []}
          schedule={data.schedule ?? []}
          onRefetch={invalidate}
        />
      </div>
    </AppShell>
  );
}

function InvoicesAndSchedule({
  invoices, schedule, onRefetch,
}: { invoices: any[]; schedule: any[]; onRefetch: () => void }) {
  const payFn = useServerFn(recordSchedulePayment);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const payM = useMutation({
    mutationFn: (v: { scheduleId: string; amount: number }) => payFn({ data: v }),
    onSuccess: () => { toast.success("Payment recorded"); onRefetch(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  if (invoices.length === 0 && schedule.length === 0) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Invoices and the payment schedule generate automatically once this booking is confirmed.
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-semibold">Invoices</h3>
        </div>
        {invoices.length === 0 ? (
          <p className="text-xs text-muted-foreground">No invoices yet.</p>
        ) : (
          <ul className="space-y-2">
            {invoices.map((inv) => (
              <li key={inv.id} className="rounded-md border border-border/60 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{inv.invoice_number}</p>
                  <Badge variant="secondary" className="capitalize">{inv.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  ${Number(inv.amount).toLocaleString()} {inv.currency} · paid $
                  {Number(inv.paid_amount ?? 0).toLocaleString()}
                  {inv.due_date ? ` · due ${new Date(inv.due_date).toLocaleDateString()}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <CalendarClockIcon className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-semibold">Payment schedule</h3>
        </div>
        {schedule.length === 0 ? (
          <p className="text-xs text-muted-foreground">No instalments yet.</p>
        ) : (
          <ul className="space-y-2">
            {schedule.map((s) => {
              const remaining = Number(s.amount) - Number(s.paid_amount ?? 0);
              return (
                <li key={s.id} className="rounded-md border border-border/60 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{s.label}</p>
                    <Badge variant={s.status === "paid" ? "default" : "secondary"} className="capitalize">
                      {s.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ${Number(s.amount).toLocaleString()} · paid $
                    {Number(s.paid_amount ?? 0).toLocaleString()}
                    {s.due_date ? ` · due ${new Date(s.due_date).toLocaleDateString()}` : ""}
                  </p>
                  {s.status !== "paid" && (
                    <div className="mt-2 flex gap-2">
                      <Input
                        type="number"
                        placeholder={remaining.toString()}
                        value={amounts[s.id] ?? ""}
                        onChange={(e) => setAmounts((a) => ({ ...a, [s.id]: e.target.value }))}
                        className="h-8"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          const amt = Number(amounts[s.id] || remaining);
                          if (amt > 0) payM.mutate({ scheduleId: s.id, amount: amt });
                        }}
                        disabled={payM.isPending}
                      >
                        Record
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

