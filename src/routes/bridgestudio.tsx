import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { PublicShell } from "@/components/public-shell";
import { Palette, Wand2, Image, Layers, Type, PaintBucket } from "lucide-react";
import { ModuleGrid, Section } from "@/components/module-page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bridgestudio")({
  head: () => ({
    meta: [
      { title: "BridgeStudio™ — MelaBridge" },
      { name: "description", content: "Generate branded invitations, moodboards, and marketing assets with AI." },
    ],
  }),
  component: StudioPage,
});

const TEMPLATES = ["Save the date", "Formal invite", "Program", "Menu card", "Signage", "Thank you"];

function StudioPage() {
  return (
    <PublicShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="BridgeStudio™"
          title="Design the entire event, guided by AI"
          description="Invitations, programs, signage, moodboards, and social assets — auto-branded from your BridgeDNA™."
          icon={Palette}
          actions={<Button className="gap-2 bg-gradient-to-r from-primary to-gold text-primary-foreground"><Wand2 className="h-4 w-4" /> Generate</Button>}
        />
        <ModuleGrid
          features={[
            { icon: Image, title: "Invitations", detail: "AI-generated invites matched to your palette and mood." },
            { icon: Type, title: "Typography kit", detail: "Curated font pairings from your brand." },
            { icon: PaintBucket, title: "Palette engine", detail: "Extract palette from a photo or pick from Concierge presets." },
            { icon: Layers, title: "Moodboards", detail: "Auto-arranged references from your saved inspirations." },
          ]}
        />
        <Section title="Templates">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {TEMPLATES.map((t) => (
              <Card key={t} className="overflow-hidden border-border/60 shadow-soft transition hover:shadow-elegant">
                <div className="aspect-[3/4] bg-gradient-to-br from-primary/20 via-gold/15 to-transparent" />
                <p className="p-3 text-center text-xs font-medium">{t}</p>
              </Card>
            ))}
          </div>
        </Section>
      </div>
    </PublicShell>
  );
}
