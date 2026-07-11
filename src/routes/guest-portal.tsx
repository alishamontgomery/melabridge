import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { UserCheck, Calendar, MapPin, Hotel, Utensils, Gift, MessageCircle, QrCode } from "lucide-react";
import { ModuleGrid, MetricRow, Section, ChecklistCard } from "@/components/module-page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/guest-portal")({
  head: () => ({
    meta: [
      { title: "Guest Portal — MelaBridge" },
      { name: "description", content: "Everything guests need for your event — RSVP, travel, dress code, and updates." },
    ],
  }),
  component: GuestPortalPage,
});

function GuestPortalPage() {
  return (
    <AppShell active="/guest-portal">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Guest Portal"
          title="A beautiful, branded experience for your guests"
          description="RSVP, dietary preferences, travel & hotel blocks, dress code, live updates, and a personal QR check-in — all in one link."
          icon={UserCheck}
        />
        <MetricRow
          metrics={[
            { label: "Invited", value: 180 },
            { label: "Confirmed", value: 132, hint: "73% RSVP" },
            { label: "Travel help requested", value: 41 },
            { label: "Dietary notes", value: 22 },
          ]}
        />
        <ModuleGrid
          features={[
            { icon: Calendar, title: "Personal schedule", detail: "Each guest sees only the events they're invited to." },
            { icon: MapPin, title: "Venue & directions", detail: "Maps, parking, accessibility, and shuttle timings." },
            { icon: Hotel, title: "Hotel blocks", detail: "Group rates and one-tap booking for out-of-town guests." },
            { icon: Utensils, title: "Menu & dietary", detail: "Guests select meals and note allergies in advance." },
            { icon: Gift, title: "Registry & gifts", detail: "Curated registry with cash-gift options via BridgePay™." },
            { icon: MessageCircle, title: "Live updates", detail: "Push notifications for time changes, weather, and toasts." },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/60 p-5 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Personal QR check-in</p>
            </div>
            <div className="grid place-items-center rounded-2xl border border-dashed border-border/60 py-10">
              <div className="grid h-32 w-32 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-gold/15">
                <QrCode className="h-16 w-16 text-primary" />
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">Each guest gets a unique QR for touchless entry and seat lookup.</p>
          </Card>
          <ChecklistCard
            title="Guest experience checklist"
            items={[
              "Custom branded portal with your colors and hero image",
              "Multi-language support (EN, FR, ES, YO, SW)",
              "Accessibility mode with high contrast and reader support",
              "Group RSVP for families and travel parties",
              "Photo upload after the event, streamed into BridgeVault™",
            ]}
          />
        </div>
        <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-5">
          <div>
            <p className="text-sm font-semibold">Share your portal</p>
            <p className="text-xs text-muted-foreground">melabridge.com/e/amara-june-14</p>
          </div>
          <Button>Copy link</Button>
        </Card>
      </div>
    </AppShell>
  );
}
