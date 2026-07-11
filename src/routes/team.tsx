import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Users, UserPlus, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/module-page";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team — MelaBridge" },
      { name: "description", content: "Invite collaborators and assign roles across your events." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPage,
});

const MEMBERS = [
  { n: "Amara Okafor", e: "amara@example.com", r: "Owner", tone: "bg-primary text-primary-foreground" },
  { n: "Kola Adebayo", e: "kola@example.com", r: "Co-host", tone: "bg-gold text-primary-foreground" },
  { n: "Ifeoma Umeh", e: "ifeoma@example.com", r: "Planner", tone: "bg-accent text-accent-foreground" },
  { n: "Studio Nine", e: "hi@studio9.co", r: "Vendor · Photo", tone: "bg-secondary" },
  { n: "Aurora Blooms", e: "team@aurora.com", r: "Vendor · Florist", tone: "bg-secondary" },
];

function TeamPage() {
  return (
    <AppShell active="/team">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Team"
          title="Everyone helping you bring it to life"
          description="Invite co-hosts, planners, and vendors. Assign granular permissions per module."
          icon={Users}
        />
        <Card className="flex flex-col gap-3 border-border/60 p-4 shadow-soft sm:flex-row">
          <Input placeholder="Invite by email…" className="flex-1" />
          <Button className="gap-2"><UserPlus className="h-4 w-4" /> Send invite</Button>
        </Card>
        <Section title={`Members · ${MEMBERS.length}`}>
          <Card className="divide-y divide-border/60 border-border/60 shadow-soft">
            {MEMBERS.map((m) => (
              <div key={m.e} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold ${m.tone}`}>
                    {m.n[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.n}</p>
                    <p className="text-xs text-muted-foreground">{m.e}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{m.r}</Badge>
                  <Button variant="ghost" size="sm">Manage</Button>
                </div>
              </div>
            ))}
          </Card>
        </Section>
        <Card className="border-border/60 p-5 shadow-soft">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Role permissions</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Owners control everything. Co-hosts share decisions. Planners edit workflows. Vendors see only their scope.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
