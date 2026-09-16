import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Lock, MapPin,
  RefreshCw, Store, TrendingUp,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useRole } from "@/lib/use-role";
import { getAdminVendorDemand, type VendorDemandBreakdown } from "@/lib/admin-sourcing.functions";

export const Route = createFileRoute("/admin/sourcing")({
  head: () => ({ meta: [{ title: "Vendor Demand — AdminOS" }, { name: "robots", content: "noindex" }] }),
  component: AdminVendorDemandPage,
});

function Breakdown({ title, icon: Icon, rows }: { title: string; icon: typeof MapPin; rows: VendorDemandBreakdown[] }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <Card className="border-border/70 p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      {rows.length ? (
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{row.label}</span>
                <span className="font-semibold tabular-nums">{row.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(8, (row.count / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No demand recorded in the recent period.</p>
      )}
    </Card>
  );
}

function AdminVendorDemandPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { role, loading: roleLoading } = useRole();
  const isAdmin = role === "admin";
  const getDemand = useServerFn(getAdminVendorDemand);
  const query = useQuery({
    queryKey: ["admin-vendor-demand"],
    enabled: isAdmin,
    queryFn: () => getDemand({ data: undefined } as never),
    staleTime: 30_000,
  });

  if (authLoading || roleLoading) {
    return <AppShell active="/admin/sourcing"><Card className="p-10 text-center text-sm text-muted-foreground">Checking access…</Card></AppShell>;
  }
  if (!user || !isAdmin) {
    return (
      <AppShell active="/admin/sourcing">
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Lock className="h-7 w-7 text-primary" />
          <h1 className="font-display text-xl font-semibold">Admin access required</h1>
          <Button asChild variant="outline"><Link to="/dashboard">Back to Dashboard</Link></Button>
        </Card>
      </AppShell>
    );
  }

  const data = query.data;
  const trendText = data?.recentTrend === "up" ? "Up from the previous 30 days" : data?.recentTrend === "down" ? "Down from the previous 30 days" : "Flat versus the previous 30 days";
  return (
    <AppShell active="/admin/sourcing">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Manage · Demand"
          title="Vendor Demand"
          description="Aggregate category and location signals from saved vendor needs. No requester or private contact details are shown."
          icon={Store}
          actions={<Button asChild variant="outline" size="sm"><Link to="/admin">Back to Dashboard</Link></Button>}
        />

        {query.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /></div>
        ) : query.isError ? (
          <Card className="flex flex-col items-center gap-3 p-10 text-center"><AlertCircle className="h-7 w-7 text-destructive" /><p className="font-semibold">Could not load vendor demand</p><Button variant="outline" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button></Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Saved vendor needs" value={data?.totalNeeds ?? 0} detail="Last 60 days" icon={Store} />
              <Metric label="Recent demand" value={data?.recentNeeds ?? 0} detail={trendText} icon={data?.recentTrend === "down" ? ArrowDownRight : data?.recentTrend === "up" ? ArrowUpRight : TrendingUp} />
              <Metric label="Unmatched demand" value={data?.unmatchedNeeds ?? 0} detail="Recent needs without a published match" icon={BarChart3} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Breakdown title="By category · last 30 days" icon={Store} rows={data?.categories ?? []} />
              <Breakdown title="By location · last 30 days" icon={MapPin} rows={data?.locations ?? []} />
            </div>
            <p className="text-xs text-muted-foreground">Matching is automatic. Published vendors are surfaced to users when they meet a saved category and location need; no admin processing is required.</p>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: number; detail: string; icon: typeof Store }) {
  return <Card className="border-border/70 p-4"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div><p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></Card>;
}