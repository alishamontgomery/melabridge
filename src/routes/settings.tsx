import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Settings, Bell, ShieldCheck, Globe2, Palette, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — MelaBridge" },
      { name: "description", content: "Account, privacy, workspace, and BridgeDNA™ preferences." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const GROUPS = [
  {
    label: "Account",
    icon: Users,
    items: [
      { k: "Name", v: "Amara Okafor" },
      { k: "Email", v: "amara@example.com" },
      { k: "Plan", v: "Pro · renews Jan 2027" },
    ],
  },
  {
    label: "Notifications",
    icon: Bell,
    items: [
      { k: "Ripple alerts", v: "On · in-app + email" },
      { k: "Vendor updates", v: "Instant" },
      { k: "Weekly digest", v: "Sunday 8 PM" },
    ],
  },
  {
    label: "Privacy",
    icon: ShieldCheck,
    items: [
      { k: "Anonymous benchmarks", v: "Contributing (opt out)" },
      { k: "BridgeVault™ sharing", v: "Family only" },
      { k: "Data export", v: "Available anytime" },
    ],
  },
  {
    label: "Workspace",
    icon: Palette,
    items: [
      { k: "Theme", v: "System" },
      { k: "Language", v: "English (US)" },
      { k: "Timezone", v: "Auto" },
    ],
  },
  {
    label: "Integrations",
    icon: Globe2,
    items: [
      { k: "Google Calendar", v: "Connected" },
      { k: "Stripe", v: "Connected" },
      { k: "iCloud photos", v: "Not connected" },
    ],
  },
];

function SettingsPage() {
  return (
    <AppShell active="/settings">
      <PageHeader
        eyebrow="Settings"
        icon={Settings}
        title={<>Your <span className="text-gradient">workspace, your way</span>.</>}
        description="Account, notifications, privacy, and integrations across the MelaBridge Ecosystem™."
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.label} className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <g.icon className="h-4 w-4" />
              </span>
              <h3 className="font-display text-lg font-semibold">{g.label}</h3>
            </div>
            <ul className="mt-4 divide-y divide-border">
              {g.items.map((i) => (
                <li key={i.k} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-muted-foreground">{i.k}</span>
                  <span className="font-medium">{i.v}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end"><Button size="sm" variant="soft">Edit</Button></div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
