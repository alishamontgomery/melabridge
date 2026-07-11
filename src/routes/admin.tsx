import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { ShieldCheck, Users, Activity, AlertTriangle, Server, DollarSign, BadgeCheck, Flag } from "lucide-react";
import { ModuleGrid, MetricRow, Section } from "@/components/module-page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "AdminOS™ — MelaBridge" },
      { name: "description", content: "Enterprise controls for teams, vendors, safety, and platform health." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <AppShell active="/admin">
      <div className="space-y-6">
        <PageHeader
          eyebrow="AdminOS™"
          title="Enterprise controls, in one calm surface"
          description="Manage users, vendors, safety, subscriptions, and platform health across your organization."
          icon={ShieldCheck}
        />
        <MetricRow
          metrics={[
            { label: "Active users", value: "1,240", hint: "+8% this week" },
            { label: "Events in flight", value: 312 },
            { label: "Vendor applications", value: 24, hint: "Awaiting review" },
            { label: "Uptime · 30d", value: "99.98%" },
          ]}
        />
        <ModuleGrid
          features={[
            { icon: Users, title: "User management", detail: "Roles, SSO, workspace transfers, and impersonation." },
            { icon: BadgeCheck, title: "Vendor verification", detail: "Review documents, KYC, and grant BridgeCheck™ badges." },
            { icon: Flag, title: "Trust & safety", detail: "Reports queue, auto-mod, and appeals workflow." },
            { icon: DollarSign, title: "Billing & payouts", detail: "Subscription revenue, refunds, and vendor payout audits." },
            { icon: Server, title: "System health", detail: "Realtime status of AI, payments, messaging, and data pipelines." },
            { icon: Activity, title: "Audit log", detail: "Immutable log of every privileged action across the platform." },
          ]}
        />
        <Section title="Queues needing attention">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { icon: BadgeCheck, l: "Vendor verifications", c: 24, tone: "text-primary" },
              { icon: AlertTriangle, l: "Open reports", c: 6, tone: "text-destructive" },
              { icon: DollarSign, l: "Refunds pending", c: 3, tone: "text-gold" },
            ].map((q) => (
              <Card key={q.l} className="flex items-center justify-between border-border/60 p-4 shadow-soft">
                <div className="flex items-center gap-2">
                  <q.icon className={`h-4 w-4 ${q.tone}`} />
                  <span className="text-sm font-medium">{q.l}</span>
                </div>
                <Badge variant="secondary">{q.c}</Badge>
              </Card>
            ))}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
