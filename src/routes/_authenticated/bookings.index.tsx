import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { listMyBookings } from "@/lib/bookings.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, Loader2, PlusCircle } from "lucide-react";
import { BookingProgressTracker } from "@/components/booking/BookingProgressTracker";
import { BookingStageBadge } from "@/components/booking/BookingStageBadge";
import type { BookingStage } from "@/lib/booking-stages";

export const Route = createFileRoute("/_authenticated/bookings/")({
  head: () => ({
    meta: [
      { title: "Bookings — MelaBridge" },
      { name: "description", content: "Every vendor engagement, from saved to booked to completed." },
    ],
  }),
  component: BookingsIndex,
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function waitingLabel(b: { current_stage: BookingStage; contract_signed_at: string | null; deposit_paid_at: string | null; confirmed_at: string | null }) {
  if (b.confirmed_at) return null;
  if (b.current_stage === "contract_signed" && !b.deposit_paid_at) return "Waiting for Deposit";
  if (b.current_stage === "deposit_paid" && !b.contract_signed_at) return "Waiting for Contract Signature";
  return null;
}

function BookingsIndex() {
  const fn = useServerFn(listMyBookings);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["bookings", "mine"], queryFn: () => fn() });
  const navigate = useNavigate();

  useEffect(() => {
    const ch = supabase
      .channel("bookings-index")
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_bookings" },
        () => qc.invalidateQueries({ queryKey: ["bookings", "mine"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_booking_events" },
        () => qc.invalidateQueries({ queryKey: ["bookings", "mine"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  if (isLoading) {
    return (
      <AppShell active="/bookings">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading bookings…
        </div>
      </AppShell>
    );
  }

  const planner = data?.planner ?? [];
  const vendor = data?.vendor ?? [];

  return (
    <AppShell active="/bookings">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Bookings"
          title="Vendor bookings pipeline"
          description="The single source of truth for every vendor engagement — from saved to booked to completed."
          icon={Briefcase}
        />

        {planner.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">As planner ({planner.length})</h2>
            <div className="grid gap-3">
              {planner.map((b: any) => (
                <BookingRow key={b.id} b={b} onOpen={() => navigate({ to: "/bookings/$id", params: { id: b.id } })} />
              ))}
            </div>
          </section>
        )}

        {vendor.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">As vendor ({vendor.length})</h2>
            <div className="grid gap-3">
              {vendor.map((b: any) => (
                <BookingRow key={b.id} b={b} onOpen={() => navigate({ to: "/bookings/$id", params: { id: b.id } })} />
              ))}
            </div>
          </section>
        )}

        {planner.length === 0 && vendor.length === 0 && (
          <Card className="p-10 text-center">
            <Briefcase className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h3 className="font-display text-lg font-semibold">No bookings yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Save a vendor from the marketplace and they'll appear here as a saved lead.
            </p>
            <Button asChild className="mt-4"><Link to="/marketplace"><PlusCircle className="mr-2 h-4 w-4" /> Browse vendors</Link></Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function BookingRow({ b, onOpen }: { b: any; onOpen: () => void }) {
  const waiting = waitingLabel(b);
  return (
    <Card className="cursor-pointer p-4 transition hover:shadow-elegant" onClick={onOpen}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{b.title}</p>
          <p className="text-xs text-muted-foreground">
            {b.vendor_profiles?.business_name ?? "Vendor"} · {b.category}
          </p>
        </div>
        <BookingStageBadge stage={b.current_stage} />
      </div>
      <div className="mt-3">
        <BookingProgressTracker currentStage={b.current_stage} waitingFor={waiting} />
      </div>
    </Card>
  );
}
