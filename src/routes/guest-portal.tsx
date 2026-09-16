import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { UserCheck, Calendar, MapPin, Utensils, QrCode, Copy, Loader2 } from "lucide-react";
import { ModuleGrid, Section, ChecklistCard } from "@/components/module-page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEcosystem } from "@/lib/ecosystem-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/guest-portal")({
  head: () => ({
    meta: [
      { title: "Guest List — MelaBridge" },
      { name: "description", content: "Organize guest details, RSVP status, meal choices, notes, and plus-ones for your event." },
    ],
  }),
  component: GuestPortalPage,
});

function GuestPortalPage() {
  const { event, hasEvent, loading: eventLoading } = useEcosystem();

  const guestsQ = useQuery({
    queryKey: ["guest-portal-stats", event.id],
    enabled: !!event.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guests")
        .select("id, rsvp_status, plus_ones")
        .eq("event_id", event.id!)
        .is("deleted_at", null);
      if (error) throw error;
      const rows = data ?? [];
      const total = rows.reduce((s, g) => s + 1 + Number(g.plus_ones ?? 0), 0);
      const confirmed = rows.filter((g) => g.rsvp_status === "yes").length;
      const pct = total > 0 ? Math.round((confirmed / rows.length) * 100) : 0;
      return { invited: rows.length, total, confirmed, pct };
    },
  });

  function copyPortalLink() {
    if (!event.id) { toast.error("No active event"); return; }
    const url = `${window.location.origin}/e/${event.id}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Portal link copied to clipboard"),
      () => {
        // Fallback for browsers that block clipboard
        toast.info(`Link: ${url}`);
      }
    );
  }

  const stats = guestsQ.data;

  return (
    <AppShell active="/guest-portal">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Guest list"
          title="Keep your guest list organized"
          description="Track guest details, RSVP status, meal choices, notes, and plus-ones from your planning workspace."
          icon={UserCheck}
        />

        {/* Real guest metrics from active event */}
        {eventLoading || guestsQ.isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0,1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : hasEvent ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Invited" value={stats?.invited ?? 0} />
            <MetricCard label="Confirmed" value={stats?.confirmed ?? 0} hint={stats?.pct ? `${stats.pct}% RSVP` : undefined} />
            <MetricCard label="Total incl. +1s" value={stats?.total ?? 0} />
            <MetricCard label="Event" value={event.name} small />
          </div>
        ) : (
          <Card className="border-border/60 p-8 text-center">
            <UserCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-display text-base font-semibold">No active event</p>
            <p className="mt-1 text-sm text-muted-foreground">Create an event to start organizing its guest list.</p>
            <Button asChild className="mt-4"><Link to="/events/new">Create event</Link></Button>
          </Card>
        )}

        <ModuleGrid
          features={[
            { icon: Calendar, title: "RSVP tracking", detail: "Organizers can track invited, confirmed, declined, and pending guests." },
            { icon: MapPin, title: "Event details", detail: "Keep the date, time, and event location in one workspace." },
            { icon: Utensils, title: "Meals & notes", detail: "Record meal choices, allergies, and other guest notes." },
          ]}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/60 p-5 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Ticket QR check-in</p>
            </div>
            <div className="grid place-items-center rounded-2xl border border-dashed border-border/60 py-10">
              <div className="grid h-32 w-32 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-gold/15">
                <QrCode className="h-16 w-16 text-primary" />
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">Ticketed events can issue QR codes for staff check-in at the door.</p>
          </Card>
          <ChecklistCard
            title="Guest experience checklist"
            items={[
              "Guest contact details and RSVP status",
              "Meal choices and guest notes",
              "Plus-one counts and guest notes",
              "CSV exports for guest records",
              "Guest-list exports and organization",
            ]}
          />
        </div>

        <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-5">
          <div>
            <p className="text-sm font-semibold">Share your event page</p>
            <p className="text-xs text-muted-foreground">
              {hasEvent ? `melabridge.com/e/${event.id}` : "Create an event to generate your event-page link"}
            </p>
          </div>
          <Button
            onClick={copyPortalLink}
            disabled={!hasEvent}
            className="gap-1.5"
          >
            <Copy className="h-4 w-4" />
            Copy link
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}

function MetricCard({ label, value, hint, small }: {
  label: string; value: number | string; hint?: string; small?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display font-semibold ${small ? "text-base truncate" : "text-2xl"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
