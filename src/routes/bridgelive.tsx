import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Radio, Video, MessageCircle, Camera, Users, Heart } from "lucide-react";
import { ModuleGrid, MetricRow } from "@/components/module-page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/bridgelive")({
  head: () => ({
    meta: [
      { title: "BridgeLive™ — MelaBridge" },
      { name: "description", content: "Livestream your event, capture memories, and let remote guests feel present." },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  return (
    <AppShell active="/bridgelive">
      <div className="space-y-6">
        <PageHeader
          eyebrow="BridgeLive™"
          title="Bring remote guests into the room"
          description="High-quality livestream, guest cam feeds, live chat, moments capture, and a private replay in BridgeVault™."
          icon={Radio}
          actions={
            <Button className="gap-2 bg-destructive text-destructive-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Go live
            </Button>
          }
        />
        <MetricRow
          metrics={[
            { label: "Remote guests online", value: 47 },
            { label: "Photos captured", value: 218, hint: "Guest cam" },
            { label: "Reactions", value: "1.2k" },
            { label: "Recording", value: "Ready" },
          ]}
        />
        <Card className="overflow-hidden border-border/60 shadow-soft">
          <div className="relative aspect-video bg-gradient-to-br from-primary/40 via-primary/20 to-gold/20">
            <div className="absolute left-4 top-4 flex items-center gap-2">
              <Badge className="gap-1 bg-destructive text-destructive-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
              </Badge>
              <Badge variant="secondary">Ceremony — Cam 1</Badge>
            </div>
            <div className="absolute inset-0 grid place-items-center">
              <Video className="h-16 w-16 text-white/80" />
            </div>
          </div>
        </Card>
        <ModuleGrid
          features={[
            { icon: Camera, title: "Multi-cam switching", detail: "Switch between ceremony, guest cam, and drone feeds live." },
            { icon: MessageCircle, title: "Live chat & toasts", detail: "Remote guests send toasts read aloud during the reception." },
            { icon: Heart, title: "Reactions overlay", detail: "Emoji reactions float across the stream in real time." },
            { icon: Users, title: "Private access lists", detail: "Only invited guests can view the stream." },
            { icon: Radio, title: "Auto-replay", detail: "Recording archived in BridgeVault™ within minutes of ending." },
            { icon: Video, title: "Highlight reel", detail: "AI clips the best moments into a shareable montage." },
          ]}
        />
      </div>
    </AppShell>
  );
}
