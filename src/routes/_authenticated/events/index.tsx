import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Plus, MapPin, Users, Wallet } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

export const Route = createFileRoute("/_authenticated/events/")({
  head: () => ({ meta: [{ title: "Your events — MelaBridge" }] }),
  component: EventsListPage,
});

function EventsListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("events")
      .select("*")
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setEvents(data ?? []);
      });
  }, [user]);

  return (
    <AppShell active="/events">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Events"
          title="Your events"
          description="Every event you own or have been invited to lives here."
          icon={Calendar}
          actions={
            <Button onClick={() => navigate({ to: "/events/new" })} className="gap-1.5">
              <Plus className="h-4 w-4" /> New event
            </Button>
          }
        />

        {error && (
          <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Couldn't load your events: {error}
          </Card>
        )}

        {events === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : events.length === 0 ? (
          <Card className="border-border/60 p-10 text-center shadow-soft">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-semibold">No events yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Create your first event and MelaBridge will help you plan tasks, budget, guests, and more.
            </p>
            <Button className="mt-4 gap-1.5" onClick={() => navigate({ to: "/events/new" })}>
              <Plus className="h-4 w-4" /> Create your first event
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((ev) => (
              <Link key={ev.id} to="/events/$eventId" params={{ eventId: ev.id }}>
                <Card className="group h-full border-border/60 p-5 shadow-soft transition hover:border-primary/40 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg font-semibold group-hover:text-primary">{ev.name}</h3>
                      {ev.event_type && <p className="text-xs text-muted-foreground">{ev.event_type}</p>}
                    </div>
                    <Badge variant="secondary" className="capitalize">{ev.status}</Badge>
                  </div>
                  <dl className="mt-4 space-y-1.5 text-sm">
                    {ev.event_date && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" /> {new Date(ev.event_date).toLocaleDateString()}
                      </div>
                    )}
                    {ev.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> {ev.location}
                      </div>
                    )}
                    {ev.guest_target !== null && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-3.5 w-3.5" /> {ev.guest_target} guests
                      </div>
                    )}
                    {ev.budget_target !== null && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Wallet className="h-3.5 w-3.5" /> ${Number(ev.budget_target).toLocaleString()}
                      </div>
                    )}
                  </dl>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
