import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plane, Sparkles } from "lucide-react";

export const Route = createFileRoute("/travel")({
  head: () => ({
    meta: [
      { title: "Travel Center — MelaBridge" },
      { name: "description", content: "Hotels, flights, transportation, weather and guest logistics." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TravelPage,
});

function TravelPage() {
  return (
    <AppShell active="/travel">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Travel Center"
          icon={Plane}
          title="Guest travel & logistics"
          description="Coordinate hotel blocks, flight tracking, and transportation for your event."
        />

        <Card className="p-8 text-center">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h3 className="font-display text-lg font-semibold">Travel coordination launching soon</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Hotel blocks, flight tracking, airport pickups, and live weather forecasts will live here. In the meantime, share travel details with guests through messages.
          </p>
          <Button asChild className="mt-4"><Link to="/messaging">Message guests</Link></Button>
        </Card>
      </div>
    </AppShell>
  );
}
