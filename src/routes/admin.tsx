import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { ShieldCheck, Users, Activity, AlertTriangle, Server, DollarSign, BadgeCheck, Flag, Settings2, Percent, Ticket, HandCoins } from "lucide-react";
import { ModuleGrid, MetricRow, Section } from "@/components/module-page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { billingConfig, getPlansFor, formatPrice, audienceMeta, type BillingAudience } from "@/lib/billing-config";

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
        <Section title="Billing configuration">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <Settings2 className="mt-0.5 h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Centralized pricing source of truth</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Every plan, price, feature, trial length, and promise across MelaBridge reads
                  from a single config. Update once — Pricing page, checkout, upgrade screens,
                  billing portal, and marketing pages update everywhere. In production this
                  hydrates from the <code className="rounded bg-muted px-1">billing_config</code> table.
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
                        <Button variant="outline" size="sm">Edit</Button>
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
