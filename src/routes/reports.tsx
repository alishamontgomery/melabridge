import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { FileBarChart, Download, Users, Store, Lock, CreditCard, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useRole } from "@/lib/use-role";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminUsers, type AdminUserRow } from "@/lib/admin-users.functions";
import { listVendorsForReview } from "@/lib/admin-vendors.functions";
import { getAdminSubscriptionSummary } from "@/lib/admin-subscriptions.functions";
import { toast } from "sonner";
import { getVendorCategories } from "@/lib/vendor-categories";
import { PremiumUpgradeGate } from "@/components/premium-upgrade-gate";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Platform Reports — MelaBridge" },
      { name: "description", content: "Exportable platform-administration reports for MelaBridge administrators." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { role, loading: roleLoading } = useRole();
  const isAdmin = role === "admin";

  const usersFn = useServerFn(listAdminUsers);
  const vendorsFn = useServerFn(listVendorsForReview);
  const subscriptionsFn = useServerFn(getAdminSubscriptionSummary);

  const usersQ = useQuery({
    queryKey: ["admin-users-export"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await usersFn();
      if (res && "error" in res) throw new Error(res.error);
      return (res as { users: AdminUserRow[]; total: number }).users;
    },
    staleTime: 120_000,
  });

  const vendorsQ = useQuery({
    queryKey: ["admin-vendors-export"],
    enabled: isAdmin,
    queryFn: () => vendorsFn(),
    staleTime: 120_000,
  });

  const subscriptionsQ = useQuery({
    queryKey: ["admin-subscription-summary"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await subscriptionsFn();
      if (res && "error" in res) throw new Error(res.error);
      return res;
    },
    staleTime: 60_000,
  });

  if (authLoading || roleLoading) {
    return (
      <AppShell active="/reports">
        <Card className="p-10 text-center text-sm text-muted-foreground">Checking access…</Card>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell active="/reports">
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="font-display text-xl font-semibold">Sign in required</h1>
          <p className="max-w-md text-sm text-muted-foreground">Sign in to view reports.</p>
          <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
        </Card>
      </AppShell>
    );
  }

  function downloadCsv(rows: string[][], filename: string) {
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportUsers() {
    const users = (usersQ.data ?? []) as AdminUserRow[];
    if (!users.length) { toast.info("No user data loaded yet"); return; }
    const header = ["Name", "Email", "Role", "Account type", "Joined", "Last sign-in", "Status"];
    const rows = users.map((u) => [
      u.display_name ?? [u.first_name, u.last_name].filter(Boolean).join(" ") ?? "",
      u.email ?? "",
      u.roles[0] ?? u.account_type ?? "",
      u.account_type ?? "",
      u.created_at ? new Date(u.created_at).toLocaleDateString() : "",
      u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "",
      u.banned_until && new Date(u.banned_until) > new Date() ? "Suspended" : u.email_confirmed_at ? "Active" : "Pending",
    ]);
    downloadCsv([header, ...rows], "melabridge-users.csv");
    toast.success(`Exported ${users.length} users`);
  }

  function exportVendors() {
    const vendors = Array.isArray(vendorsQ.data) ? vendorsQ.data : [];
    if (!vendors.length) { toast.info("No vendor data loaded yet"); return; }
    const header = ["Business name", "Category", "City", "State", "Status", "BridgeCheck", "Joined"];
    const rows = vendors.map((v: any) => [
      v.business_name ?? "",
      getVendorCategories(v).join(", "),
      v.city ?? "",
      v.state ?? "",
      v.onboarding_completed ? "Active" : "Incomplete",
      v.is_verified ? "Yes" : "No",
      v.created_at ? new Date(v.created_at).toLocaleDateString() : "",
    ]);
    downloadCsv([header, ...rows], "melabridge-vendors.csv");
    toast.success(`Exported ${vendors.length} vendors`);
  }

  const userCount = (usersQ.data as AdminUserRow[] | undefined)?.length ?? 0;
  const vendorData = Array.isArray(vendorsQ.data) ? vendorsQ.data : [];
  const vendorCount = vendorData.length;
  const activeCount = vendorData.filter((v: any) => v.onboarding_completed).length;
  const subscriptionSummary = subscriptionsQ.data;

  return (
    <AppShell active="/reports">
      <PremiumUpgradeGate
        feature="exports"
      >
      {!isAdmin ? (
        <div className="space-y-6">
          <PageHeader
            eyebrow="Reports"
            icon={FileBarChart}
            title="Event reports and exports"
            description="Choose an event to export attendee, budget, timeline, and vendor information."
          />
          <Card className="flex flex-col items-center gap-3 p-10 text-center shadow-soft">
            <FileBarChart className="h-8 w-8 text-primary" />
            <h2 className="font-display text-xl font-semibold">Choose an event</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Open an event, then use its recap and export tools to download the report you need.
            </p>
            <Button asChild><Link to="/events">View my events</Link></Button>
          </Card>
        </div>
      ) : (
      <div className="space-y-6">
        <PageHeader
          eyebrow="AdminOS™"
          icon={FileBarChart}
          title="Platform reports"
          description="Download administration reports for users, vendors, and platform activity."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Users report */}
          <Card className="space-y-4 border-border/60 p-6 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                <Users className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Users</p>
                  {!usersQ.isLoading && (
                    <Badge variant="secondary" className="text-[10px]">{userCount} records</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  All registered accounts — name, email, account type, and join date.
                </p>
              </div>
            </div>
            <Button
              className="w-full gap-2"
              variant="outline"
              onClick={exportUsers}
              disabled={usersQ.isLoading || !userCount}
            >
              <Download className="h-4 w-4" />
              {usersQ.isLoading ? "Loading…" : "Export users CSV"}
            </Button>
          </Card>

          {/* Vendors report */}
          <Card className="space-y-4 border-border/60 p-6 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                <Store className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Vendors</p>
                  {!vendorsQ.isLoading && vendorCount > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{activeCount}/{vendorCount} active</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  All vendor profiles — business name, category, location, listing status, and BridgeCheck badge.
                </p>
              </div>
            </div>
            <Button
              className="w-full gap-2"
              variant="outline"
              onClick={exportVendors}
              disabled={vendorsQ.isLoading || !vendorCount}
            >
              <Download className="h-4 w-4" />
              {vendorsQ.isLoading ? "Loading…" : "Export vendors CSV"}
            </Button>
          </Card>
        </div>

        {/* Platform activity */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-dashed border-border/40 p-6 opacity-60">
            <p className="text-sm font-semibold">Inquiries & leads</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Leads submitted through MelaBridge vendor profiles, with event type and status.
            </p>
            <Badge variant="outline" className="mt-3 text-[10px]">Coming soon</Badge>
          </Card>

          <Card className="space-y-4 border-border/60 p-6 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                <CreditCard className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">Subscription activity</p>
                  {!subscriptionsQ.isLoading && subscriptionSummary && (
                    <Badge variant="secondary" className="text-[10px]">
                      {subscriptionSummary.total} total
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Live plans, 5-day trials, renewals, cancellations, and past-due accounts.
                </p>
              </div>
            </div>

            {subscriptionsQ.isError ? (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/5 p-3 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Subscription data could not be loaded.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <SubscriptionMetric
                  label="Active / trial"
                  value={(subscriptionSummary?.active ?? 0) + (subscriptionSummary?.trialing ?? 0)}
                  loading={subscriptionsQ.isLoading}
                />
                <SubscriptionMetric
                  label="Past due"
                  value={subscriptionSummary?.pastDue ?? 0}
                  loading={subscriptionsQ.isLoading}
                  alert={(subscriptionSummary?.pastDue ?? 0) > 0}
                />
                <SubscriptionMetric
                  label="Canceled"
                  value={subscriptionSummary?.canceled ?? 0}
                  loading={subscriptionsQ.isLoading}
                />
              </div>
            )}

            <Button asChild className="w-full gap-2" variant="outline">
              <Link to="/admin/subscriptions">
                View subscription details
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </Card>
        </div>
      </div>
      )}
      </PremiumUpgradeGate>
    </AppShell>
  );
}

function SubscriptionMetric({
  label,
  value,
  loading,
  alert,
}: {
  label: string;
  value: number;
  loading: boolean;
  alert?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/45 px-2 py-3 text-center">
      <p className={`text-lg font-semibold ${alert ? "text-amber-700 dark:text-amber-400" : ""}`}>
        {loading ? "—" : value}
      </p>
      <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
