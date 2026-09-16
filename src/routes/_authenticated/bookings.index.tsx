import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { listMyBookings, listMyInquiries } from "@/lib/bookings.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, CalendarDays, Loader2, MessageCircle, PlusCircle, Store } from "lucide-react";
import { useRole } from "@/lib/use-role";
import { BookingProgressTracker } from "@/components/booking/BookingProgressTracker";
import { BookingStageBadge } from "@/components/booking/BookingStageBadge";
import type { BookingStage } from "@/lib/booking-stages";

export const Route = createFileRoute("/_authenticated/bookings/")({
  head: () => ({
    meta: [
      { title: "Leads — MelaBridge" },
      { name: "description", content: "Every inquiry and vendor connection, tracked through your decision process." },
    ],
  }),
  component: BookingsIndex,
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function BookingsIndex() {
  const fn = useServerFn(listMyBookings);
  const inquiriesFn = useServerFn(listMyInquiries);
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["bookings", "mine"], queryFn: () => fn() });
  const inquiriesQuery = useQuery({
    queryKey: ["inquiries", "mine"],
    queryFn: () => inquiriesFn(),
  });
  const navigate = useNavigate();
  const { role } = useRole();
  const isVendor = role === "vendor";

  useEffect(() => {
    const ch = supabase
      .channel("bookings-index")
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_bookings" },
        () => qc.invalidateQueries({ queryKey: ["bookings", "mine"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_booking_events" },
        () => qc.invalidateQueries({ queryKey: ["bookings", "mine"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_booking_requests" },
        () => qc.invalidateQueries({ queryKey: ["inquiries", "mine"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  if (isLoading) {
    return (
      <AppShell active="/bookings">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading leads…
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell active="/bookings">
        <Card className="p-10 text-center">
          <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">Could not load leads</p>
          <p className="mt-1 text-sm text-muted-foreground">There was a problem fetching your leads. Please try again.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>Retry</Button>
        </Card>
      </AppShell>
    );
  }

  const planner = data?.planner ?? [];
  const vendor = data?.vendor ?? [];
  const inquiries = inquiriesQuery.data ?? [];

  // Role-aware header copy
  const pageTitle = isVendor ? "Lead Pipeline" : "My Vendors";
  const pageDescription = isVendor
    ? "Every inquiry you've received, organized by where things stand. Reach out to clients directly to take conversations forward."
    : "Every vendor you've saved or contacted, tracked from first discovery through to the event.";

  return (
    <AppShell active="/bookings">
      <div className="space-y-6">
        <PageHeader
          eyebrow={isVendor ? "Business" : "Vendors"}
          title={pageTitle}
          description={pageDescription}
          icon={Briefcase}
        />

        {!isVendor && (
          <section className="space-y-3">
            <div>
              <h2 className="font-display text-lg font-semibold">
                Sent inquiries {inquiries.length > 0 && `(${inquiries.length})`}
              </h2>
              <p className="text-sm text-muted-foreground">
                Track every vendor inquiry and see replies as soon as they arrive.
              </p>
            </div>
            {inquiriesQuery.isLoading ? (
              <Card className="p-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading inquiries…
              </Card>
            ) : inquiriesQuery.isError ? (
              <Card className="p-6 text-center">
                <p className="text-sm text-muted-foreground">Could not load your inquiries.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => inquiriesQuery.refetch()}>
                  Retry
                </Button>
              </Card>
            ) : inquiries.length > 0 ? (
              <div className="grid gap-3">
                {inquiries.map((inquiry: any) => <InquiryRow key={inquiry.id} inquiry={inquiry} />)}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <MessageCircle className="mx-auto mb-3 h-9 w-9 text-primary" />
                <h3 className="font-display font-semibold">No inquiries sent yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  When you contact a vendor, their response will appear here.
                </p>
                <Button asChild size="sm" className="mt-4">
                  <Link to="/marketplace">Browse vendors</Link>
                </Button>
              </Card>
            )}
          </section>
        )}

        {/* Planner-side: vendors they've saved or contacted */}
        {planner.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">
              {isVendor ? "Vendors I'm working with" : "Saved vendors"} ({planner.length})
            </h2>
            <div className="grid gap-3">
              {planner.map((b: any) => (
                <BookingRow key={b.id} b={b} onOpen={() => navigate({ to: "/bookings/$id", params: { id: b.id } })} />
              ))}
            </div>
          </section>
        )}

        {/* Vendor-side: incoming leads from planners */}
        {vendor.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">
              {isVendor ? "Incoming leads" : "Events I've vended"} ({vendor.length})
            </h2>
            <div className="grid gap-3">
              {vendor.map((b: any) => (
                <BookingRow key={b.id} b={b} onOpen={() => navigate({ to: "/bookings/$id", params: { id: b.id } })} />
              ))}
            </div>
          </section>
        )}

        {isVendor && planner.length === 0 && vendor.length === 0 && (
          <Card className="p-10 text-center">
            <Briefcase className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h3 className="font-display text-lg font-semibold">
              {isVendor ? "No leads yet" : "No saved vendors yet"}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {isVendor
                ? "When planners send you inquiries through MelaBridge, each lead appears here. All conversations and agreements happen directly between you and the client."
                : "Save a vendor from the marketplace and they'll appear here so you can track your conversations."}
            </p>
            {isVendor ? (
              <Button asChild className="mt-4">
                <Link to="/vendor-profile-builder">
                  <Store className="mr-2 h-4 w-4" aria-hidden="true" /> Complete your profile
                </Link>
              </Button>
            ) : (
              <Button asChild className="mt-4">
                <Link to="/marketplace">
                  <PlusCircle className="mr-2 h-4 w-4" aria-hidden="true" /> Browse vendors
                </Link>
              </Button>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}

const INQUIRY_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-500/15 text-amber-700" },
  alternate_proposed: { label: "Responded", className: "bg-primary/15 text-primary" },
  approved: { label: "Booked", className: "bg-emerald-500/15 text-emerald-700" },
  declined: { label: "Responded", className: "bg-rose-500/15 text-rose-700" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

function InquiryRow({ inquiry }: { inquiry: any }) {
  const status = INQUIRY_STATUS[inquiry.status] ?? {
    label: inquiry.status,
    className: "bg-muted text-muted-foreground",
  };
  const content = (
    <Card className="p-4 transition hover:shadow-elegant">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{inquiry.vendor_name}</p>
          <p className="text-sm text-muted-foreground">{inquiry.event_name}</p>
        </div>
        <Badge className={status.className}>{status.label}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          Event {new Date(inquiry.requested_start).toLocaleDateString([], { dateStyle: "medium" })}
        </span>
        <span>Sent {new Date(inquiry.created_at).toLocaleDateString([], { dateStyle: "medium" })}</span>
      </div>
      {inquiry.alternate_message && (
        <div className="mt-3 rounded-lg bg-primary/5 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Vendor reply</p>
          <p>{inquiry.alternate_message}</p>
        </div>
      )}
    </Card>
  );

  return inquiry.vendor_profile_id ? (
    <Link
      to="/vendor-profile/$vendorId"
      params={{ vendorId: inquiry.vendor_profile_id }}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </Link>
  ) : content;
}

function BookingRow({ b, onOpen }: { b: any; onOpen: () => void }) {
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
        <BookingProgressTracker currentStage={b.current_stage} />
      </div>
    </Card>
  );
}
