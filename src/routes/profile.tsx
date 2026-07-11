import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { User, Mail, Globe2, Camera, Dna } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/module-page";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — MelaBridge" },
      { name: "description", content: "Manage your MelaBridge identity, connected accounts, and BridgeDNA™." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <AppShell active="/profile">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Your profile"
          title="Amara Okafor"
          description="Your identity, planning style, and connected accounts across the MelaBridge ecosystem."
          icon={User}
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <Card className="border-border/60 p-6 text-center shadow-soft">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-primary to-gold text-2xl font-semibold text-primary-foreground">
              A
            </div>
            <p className="mt-3 font-semibold">Amara Okafor</p>
            <p className="text-xs text-muted-foreground">Lagos, NG · Joined 2025</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              <Badge variant="secondary">Pro</Badge>
              <Badge variant="secondary">Host · 4 events</Badge>
              <Badge variant="secondary">BridgeDNA™ ready</Badge>
            </div>
            <Button variant="outline" size="sm" className="mt-4 gap-2"><Camera className="h-4 w-4" /> Change photo</Button>
          </Card>
          <Card className="border-border/60 p-6 shadow-soft">
            <p className="mb-4 text-sm font-semibold">Account details</p>
            <div className="space-y-3">
              <Field icon={User} label="Full name" value="Amara Okafor" />
              <Field icon={Mail} label="Email" value="amara@example.com" />
              <Field icon={Globe2} label="Timezone" value="Africa/Lagos (WAT)" />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline">Cancel</Button>
              <Button>Save changes</Button>
            </div>
          </Card>
        </div>
        <Section title="BridgeDNA™ personalization" description="How Concierge tailors every recommendation to you.">
          <Card className="border-border/60 p-5 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <Dna className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Your planner style</p>
              <Badge variant="secondary" className="text-[10px]">Auto-learned</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              {[
                { l: "Aesthetic", v: "Elegant · candlelit · cultural fusion" },
                { l: "Priorities", v: "Guest experience · photography · food" },
                { l: "Comfort level", v: "Delegates operations, decides on vision" },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border border-border/60 bg-accent/30 p-3">
                  <p className="uppercase tracking-widest text-muted-foreground">{s.l}</p>
                  <p className="mt-1 font-medium text-foreground">{s.v}</p>
                </div>
              ))}
            </div>
          </Card>
        </Section>
      </div>
    </AppShell>
  );
}

function Field({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </label>
      <Input defaultValue={value} />
    </div>
  );
}
