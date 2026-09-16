import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3, Users, Store, MessageSquare, CreditCard,
  TrendingUp, Lock, RefreshCw, BadgeCheck, AlertTriangle,
} from "lucide-react";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useRole } from "@/lib/use-role";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformStats } from "@/lib/admin-platform-stats.functions";
import type { PlatformStats } from "@/lib/admin-platform-stats.functions";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Platform Analytics — MelaBridge" },
      { name: "description", content: "Platform-level metrics for MelaBridge administrators." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { role, loading: roleLoading } = useRole();
  const isAdmin = role === "admin";

  const fn = useServerFn(getPlatformStats);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["platform-analytics"],
    enabled: isAdmin,
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  if (authLoading || roleLoading) {
    return (
      <AppShell active="/analytics">
        <Card className="p-10 text-center text-sm text-muted-foreground">Checking access…</Card>
      </AppShell>
    );
  }

  if (!user || !isAdmin) {
    return (
      <AppShell active="/analytics">
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="font-display text-xl font-semibold">Admin only</h1>
          <p className="max-w-md text-sm text-muted-foreground">Platform analytics is only available to administrators.</p>
          <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
        </Card>
      </AppShell>
    );
  }

  const stats = (!isLoading && data && !("error" in data)) ? data as PlatformStats : null;
  const fmt = (n: number | undefined) => (typeof n === "number" ? n.toLocaleString() : "—");

  return (
    <AppShell active="/analytics">
      <div className="space-y-8">
        <PageHeader
          eyebrow="AdminOS™"
          icon={BarChart3}
          title="Platform analytics"
          description="MelaBridge-level metrics — users, vendors, marketplace activity, and subscriptions."
          actions={
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />

        {isError && (
          <Card className="flex items-center gap-3 border-destructive/40 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Failed to load platform analytics. Check that your admin role is active.
          </Card>
        )}

        {/* ── Top-level stats ── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Users</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              icon={Users}
              label="Total users"
              value={isLoading ? null : fmt(stats?.totalUsers)}
              sub="All registered accounts"
              to="/admin/users"
            />
            <StatCard
              icon={TrendingUp}
              label="New (last 30 days)"
              value={isLoading ? null : fmt(stats?.newUsersLast30)}
              sub="Recently joined"
            />
            <StatCard
              icon={Store}
              label="Vendor accounts"
              value={isLoading ? null : fmt(stats?.totalVendors)}
              sub="Total vendor profiles"
              to="/admin/vendors"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Vendor listings</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={Store}
              label="Active listings"
              value={isLoading ? null : fmt(stats?.activeVendors)}
              sub="Profile complete & listed"
              tone="good"
            />
            <StatCard
              icon={AlertTriangle}
              label="Incomplete profiles"
              value={isLoading ? null : fmt(stats?.incompleteVendors)}
              sub="Not yet published"
              tone="warn"
            />
            <StatCard
              icon={BadgeCheck}
              label="BridgeCheck™ badges"
              value={isLoading ? null : fmt(stats?.verifiedVendors)}
              sub="Admin-verified listings"
              tone="good"
            />
            <StatCard
              icon={TrendingUp}
              label="New vendors (30d)"
              value={isLoading ? null : fmt(stats?.newVendorsLast30)}
              sub="Recently onboarded"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Marketplace activity</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              icon={MessageSquare}
              label="Total inquiries"
              value={isLoading ? null : fmt(stats?.totalInquiries)}
              sub="Leads sent via platform"
            />
            <StatCard
              icon={TrendingUp}
              label="Inquiries (last 30d)"
              value={isLoading ? null : fmt(stats?.recentInquiries)}
              sub="Recent marketplace activity"
              tone="good"
            />
            <StatCard
              icon={CreditCard}
              label="Active subscriptions"
              value={isLoading ? null : `${fmt(stats?.activeSubscriptions)} / ${fmt(stats?.totalSubscriptions)}`}
              sub="Active or in 5-day trial"
            />
          </div>
        </section>

        {/* ── Category breakdown ── */}
        {(stats?.categoryBreakdown?.length ?? 0) > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Vendor categories</h2>
            <Card className="divide-y divide-border/50 border-border/60 shadow-soft">
              {stats!.categoryBreakdown.slice(0, 12).map(({ category, count }) => {
                const max = stats!.categoryBreakdown[0].count;
                const pct = Math.round((count / max) * 100);
                return (
                  <div key={category} className="flex items-center gap-4 px-5 py-3 text-sm">
                    <span className="w-40 shrink-0 truncate font-medium">{category}</span>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-muted/60">
                        <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="w-10 shrink-0 text-right text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </Card>
          </section>
        )}

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  sub?: string;
  tone?: "good" | "warn";
  to?: string;
}) {
  const inner = (
    <Card className="flex flex-col gap-1 border-border/60 p-4 shadow-soft transition hover:border-primary/40 hover:shadow-elegant">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon
          className={`h-3.5 w-3.5 ${
            tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-primary"
          }`}
        />
        {label}
      </div>
      {value === null ? (
        <Skeleton className="mt-1 h-7 w-20" />
      ) : (
        <p className={`font-display text-2xl font-semibold ${
          tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : ""
        }`}>{value}</p>
      )}
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </Card>
  );

  if (to) {
    return <Link to={to as "/admin/users"} className="block">{inner}</Link>;
  }
  return inner;
}
