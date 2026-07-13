import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { ShieldCheck, Users, Activity, AlertTriangle, Server, DollarSign, BadgeCheck, Flag, Settings2, Percent, Ticket, HandCoins, Lock, FlaskConical, Trash2 } from "lucide-react";
import { ModuleGrid, MetricRow, Section } from "@/components/module-page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { billingConfig, getPlansFor, formatPrice, audienceMeta, type BillingAudience } from "@/lib/billing-config";
import { useRole } from "@/lib/use-role";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStats } from "@/lib/admin-stats.functions";
import { seedTestData, wipeTestData } from "@/lib/test-seed.functions";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";

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
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const isAdmin = role === "admin";

  const fetchStats = useServerFn(getAdminStats);
  const stats = useQuery({
    queryKey: ["admin-stats"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await fetchStats({ data: undefined } as any);
      if (res && "error" in res) throw new Error(res.error);
      return res;
    },
  });

  if (authLoading || roleLoading) {
    return (
      <AppShell active="/admin">
        <Card className="p-10 text-center text-sm text-muted-foreground">Checking access…</Card>
      </AppShell>
    );
  }

  if (!user || !isAdmin) {
    return (
      <AppShell active="/admin">
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="font-display text-xl font-semibold">AdminOS™ is restricted</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            This surface is only available to workspace administrators. If you should have access, ask your organization owner to grant the admin role.
          </p>
          <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
        </Card>
      </AppShell>
    );
  }

  const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString() : "—");

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
            { label: "Total users", value: fmt(stats.data?.activeUsers) },
            { label: "Events in flight", value: fmt(stats.data?.eventsInFlight) },
            { label: "Vendor applications", value: fmt(stats.data?.vendorApplications), hint: "Awaiting review" },
            { label: "Uptime · 30d", value: "—", hint: "Coming soon" },
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
            <QueueCard icon={BadgeCheck} label="Vendor verifications" count={stats.data?.vendorApplications ?? 0} tone="text-primary" />
            <QueueCard icon={AlertTriangle} label="Open reports" count={stats.data?.openReports ?? 0} tone="text-destructive" />
            <QueueCard icon={DollarSign} label="Refunds pending" count={stats.data?.pendingRefunds ?? 0} tone="text-gold" />
          </div>
        </Section>

        <TestSeedSection />

        <Section title="Billing configuration">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <Settings2 className="mt-0.5 h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Centralized pricing source of truth</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Every plan, price, feature, trial length, and promise across MelaBridge reads
                  from a single config. Update once — Pricing page, checkout, upgrade screens,
                  billing portal, and marketing pages update everywhere.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <ConfigStat icon={Percent} label="Donation platform fee" value={`${billingConfig.donationPlatformFeeRate * 100}%`} note="Always zero" />
                  <ConfigStat icon={Ticket} label="Ticketing platform fee" value={`${billingConfig.ticketingPlatformFeeRate * 100}%`} note="Paid plans, no fee" />
                  <ConfigStat
                    icon={HandCoins}
                    label="Marketplace commission"
                    value={billingConfig.marketplaceCommissionEnabled ? `${billingConfig.marketplaceCommissionRate * 100}%` : "Disabled"}
                    note={billingConfig.marketplaceCommissionEnabled ? "Enabled" : "Off at launch"}
                  />
                </div>
              </div>
            </div>
          </Card>

          {(["host", "vendor", "planner"] as BillingAudience[]).map((a) => (
            <div key={a} className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">{audienceMeta[a].label}</p>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/pricing">View public page →</Link>
                </Button>
              </div>
              <Card className="divide-y divide-border/60 border-border/60 shadow-soft">
                {getPlansFor(a).map((p) => {
                  const { amount, period } = formatPrice(p);
                  return (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{p.name}</p>
                          {p.featured && <Badge className="bg-primary/10 text-primary text-[10px]">Most Popular</Badge>}
                          {!p.visible && <Badge variant="secondary" className="text-[10px]">Hidden</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{p.tagline}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Trial: {p.trialDays}d</span>
                        <span className="font-display text-base font-semibold text-foreground">
                          {amount}
                          {period && p.price !== null && (
                            <span className="ml-0.5 text-xs font-normal text-muted-foreground">{period}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
        </Section>
      </div>
    </AppShell>
  );
}

function QueueCard({
  icon: Icon,
  label,
  count,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  tone: string;
}) {
  return (
    <Card className="flex items-center justify-between border-border/60 p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone}`} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Badge variant="secondary">{count}</Badge>
    </Card>
  );
}

function ConfigStat({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{note}</p>
    </div>
  );
}
