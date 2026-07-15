import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { ShieldCheck, Users, Activity, AlertTriangle, Server, DollarSign, BadgeCheck, Flag, Settings2, Percent, Ticket, HandCoins, Lock, FlaskConical, Trash2, Mail, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
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
import { sendDomainTestEmail } from "@/lib/email-test.functions";
import { useRequireAuth } from "@/lib/use-require-auth";
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
  const { user, loading: authLoading } = useRequireAuth();
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

  const metricCards: Array<{ label: string; value: string; hint?: string; to: string }> = [
    { label: "Total users", value: fmt(stats.data?.activeUsers), to: "/admin/users" },
    { label: "Events in flight", value: fmt(stats.data?.eventsInFlight), to: "/events" },
    { label: "Vendor applications", value: fmt(stats.data?.vendorApplications), hint: "Awaiting review", to: "/vendors" },
    { label: "System status", value: "Operational", hint: "All services green", to: "/admin" },
  ];

  const moduleTiles: Array<{ icon: React.ComponentType<{ className?: string }>; title: string; detail: string; to: string }> = [
    { icon: Users, title: "User management", detail: "Search, filter, edit roles, suspend or reactivate.", to: "/admin/users" },
    { icon: BadgeCheck, title: "Vendor verification", detail: "Review documents, KYC, and grant BridgeCheck™ badges.", to: "/vendors" },
    { icon: Flag, title: "Trust & safety", detail: "Reports queue, auto-mod, and appeals workflow.", to: "/reports" },
    { icon: DollarSign, title: "Billing & payouts", detail: "Subscription revenue, refunds, and vendor payout audits.", to: "/bridgepay" },
    { icon: Server, title: "System health", detail: "Realtime status of AI, payments, messaging, and data pipelines.", to: "/analytics" },
    { icon: Activity, title: "Audit log", detail: "Immutable log of every privileged action across the platform.", to: "/reports" },
  ];

  return (
    <AppShell active="/admin">
      <div className="space-y-6">
        <PageHeader
          eyebrow="AdminOS™"
          title="Enterprise controls, in one calm surface"
          description="Manage users, vendors, safety, subscriptions, and platform health across your organization."
          icon={ShieldCheck}
          actions={<Button asChild size="sm"><Link to="/admin/invite">Invite users</Link></Button>}
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {metricCards.map((m) => (
            <Link
              key={m.label}
              to={m.to as "/admin/users"}
              className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft transition hover:border-primary/40 hover:shadow-elegant"
            >
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{m.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{m.value}</p>
              {m.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{m.hint}</p>}
            </Link>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {moduleTiles.map((t) => (
            <Link
              key={t.title}
              to={t.to as "/admin/users"}
              className="group rounded-2xl border border-border/60 bg-card p-5 shadow-soft transition hover:border-primary/40 hover:shadow-elegant"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                <t.icon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-semibold">{t.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.detail}</p>
              <p className="mt-3 text-xs text-primary opacity-0 transition group-hover:opacity-100">Open →</p>
            </Link>
          ))}
        </div>
        <Section title="Queues needing attention">
          <div className="grid gap-3 md:grid-cols-3">
            <QueueCard icon={BadgeCheck} label="Vendor verifications" count={stats.data?.vendorApplications ?? 0} tone="text-primary" to="/vendors" />
            <QueueCard icon={AlertTriangle} label="Open reports" count={stats.data?.openReports ?? 0} tone="text-destructive" to="/reports" />
            <QueueCard icon={DollarSign} label="Refunds pending" count={stats.data?.pendingRefunds ?? 0} tone="text-gold" to="/bridgepay" />
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
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  tone: string;
  to: string;
}) {
  return (
    <Link to={to as "/admin/users"} className="block">
      <Card className="flex items-center justify-between border-border/60 p-4 shadow-soft transition hover:border-primary/40 hover:shadow-elegant">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${tone}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <Badge variant="secondary">{count}</Badge>
      </Card>
    </Link>
  );
}

function TestSeedSection() {
  const seed = useServerFn(seedTestData);
  const wipe = useServerFn(wipeTestData);
  const [busy, setBusy] = useState<"seed" | "wipe" | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const isProdHost = typeof window !== "undefined" && /(^|\.)melabridge\.com$/.test(window.location.hostname);
  if (isProdHost) return null;

  const runSeed = async () => {
    setBusy("seed");
    setLastResult(null);
    try {
      const res = await seed({ data: undefined } as never);
      if (!res.ok) throw new Error(res.error);
      setLastResult(`Seeded ${res.accounts.length} accounts, ${res.events} events, ${res.guests} guests, ${res.notifications} notifications.`);
      toast.success("Test data seeded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setBusy(null);
    }
  };

  const runWipe = async () => {
    if (!confirm("Delete all rows tagged as test seed? This cannot be undone.")) return;
    setBusy("wipe");
    setLastResult(null);
    try {
      const res = await wipe({ data: undefined } as never);
      if (!res.ok) throw new Error(res.error ?? "Wipe failed");
      setLastResult("Test data wiped.");
      toast.success("Test data wiped");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Wipe failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title="QA test data (dev/preview only)">
      <Card className="border-dashed border-primary/30 bg-primary/5 p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 h-5 w-5 text-primary" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-semibold">Seed five test accounts + realistic data</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Creates <code className="rounded bg-muted px-1">admin/planner/vendor/attendee/guest@test.melabridge.com</code> (password <code className="rounded bg-muted px-1">MelaTest!2026</code>) and populates events, guests, tasks, budget, files, messages, notifications, vendor profile, and a sandbox subscription. Every row is tagged so it can be wiped surgically. Hidden entirely on the production domain.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={runSeed} disabled={busy !== null}>
                <FlaskConical className="mr-2 h-4 w-4" />{busy === "seed" ? "Seeding…" : "Seed test data"}
              </Button>
              <Button size="sm" variant="outline" onClick={runWipe} disabled={busy !== null}>
                <Trash2 className="mr-2 h-4 w-4" />{busy === "wipe" ? "Wiping…" : "Wipe test data"}
              </Button>
            </div>
            {lastResult && <p className="text-xs text-muted-foreground">{lastResult}</p>}
          </div>
        </div>
      </Card>
    </Section>
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
