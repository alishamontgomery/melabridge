import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, Search, Lock, RotateCcw, ExternalLink, AlertTriangle,
  CheckCircle2, Clock, XCircle, AlertCircle, ChevronLeft, ChevronRight, TrendingUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAdminSubscriptions,
  getAdminSubscriptionSummary,
  getStripePortalLinkForCustomer,
  type AdminSubscriptionRow,
} from "@/lib/admin-subscriptions.functions";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useRole } from "@/lib/use-role";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { findPlanByPriceId } from "@/lib/billing-config";

type StatusFilter = "all" | "active" | "trialing" | "past_due" | "canceled" | "other";

export const Route = createFileRoute("/admin/subscriptions")({
  validateSearch: (search: Record<string, unknown>): { status?: StatusFilter } => ({
    status: ["active", "trialing", "past_due", "canceled", "other"].includes(String(search.status))
      ? search.status as StatusFilter
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Subscriptions — AdminOS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSubscriptionsPage,
});

const PAGE_SIZE = 50;

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function resolvePlanName(row: AdminSubscriptionRow): string {
  if (row.price_id) {
    const plan = findPlanByPriceId(row.price_id);
    if (plan) return plan.name;
  }
  if (row.product_id) return row.product_id;
  return "Unknown plan";
}

function StatusBadge({
  status,
  currentPeriodEnd,
}: {
  status: string | null;
  currentPeriodEnd?: string | null;
}) {
  if (!status) return <Badge variant="outline">Unknown</Badge>;
  if (
    status === "trialing" &&
    currentPeriodEnd &&
    new Date(currentPeriodEnd).getTime() <= Date.now()
  ) {
    return (
      <Badge variant="secondary" className="gap-1">
        <XCircle className="h-3 w-3" />Trial expired
      </Badge>
    );
  }
  switch (status) {
    case "active":
      return (
        <Badge className="gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />Active
        </Badge>
      );
    case "trialing":
      return (
        <Badge className="gap-1 bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400">
          <Clock className="h-3 w-3" />Trial
        </Badge>
      );
    case "past_due":
      return (
        <Badge className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" />Past due
        </Badge>
      );
    case "canceled":
      return (
        <Badge variant="secondary" className="gap-1">
          <XCircle className="h-3 w-3" />Canceled
        </Badge>
      );
    default:
      return <Badge variant="outline" className="capitalize">{status}</Badge>;
  }
}

function AdminSubscriptionsPage() {
  const search = Route.useSearch();
  const { user, loading: authLoading } = useRequireAuth();
  const { role, loading: roleLoading } = useRole();
  const isAdmin = role === "admin";

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(search.status ?? "all");
  const [page, setPage] = useState(1);
  const [openingPortalFor, setOpeningPortalFor] = useState<string | null>(null);

  const fetchSubs = useServerFn(listAdminSubscriptions);
  const fetchSummary = useServerFn(getAdminSubscriptionSummary);
  const fetchPortalLink = useServerFn(getStripePortalLinkForCustomer);

  const query = useQuery({
    queryKey: ["admin-subscriptions", page, statusFilter, q],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await fetchSubs({
          data: { page, pageSize: PAGE_SIZE, status: statusFilter, search: q.trim() || null },
      } as any);
      if (res && "error" in res) throw new Error(res.error);
      return res;
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["admin-subscription-summary"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await fetchSummary();
      if ("error" in res) throw new Error(res.error);
      return res;
    },
  });

  const rows = useMemo(() => query.data?.subscriptions ?? [], [query.data]);

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function changeStatus(v: StatusFilter) {
    setStatusFilter(v);
    setPage(1);
    setQ("");
  }

  async function openStripePortal(s: AdminSubscriptionRow) {
    if (!s.stripe_customer_id) {
      toast.error("No Stripe customer ID on this subscription");
      return;
    }
    setOpeningPortalFor(s.id);
    try {
      const res = await fetchPortalLink({
        data: {
          stripeCustomerId: s.stripe_customer_id,
          returnUrl: window.location.href,
        },
      } as any);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      // Navigate in the same tab — Stripe returns to returnUrl after the session ends.
      window.location.href = res.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to open portal");
    } finally {
      setOpeningPortalFor(null);
    }
  }

  if (authLoading || roleLoading) {
    return (
      <AppShell active="/admin/subscriptions">
        <Card className="p-10 text-center text-sm text-muted-foreground">Checking access…</Card>
      </AppShell>
    );
  }

  if (!user || !isAdmin) {
    return (
      <AppShell active="/admin/subscriptions">
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="font-display text-xl font-semibold">Restricted</h1>
          <Button asChild variant="outline">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  const summary = summaryQuery.data;
  const activeCount = (summary?.active ?? 0) + (summary?.trialing ?? 0);
  const pastDueCount = summary?.pastDue ?? 0;
  const canceledCount = summary?.canceled ?? 0;

  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <AppShell active="/admin/subscriptions">
      <div className="space-y-6">
        <PageHeader
          eyebrow="AdminOS™"
          icon={CreditCard}
          title="Subscriptions"
          description={
            query.isLoading
              ? "Loading subscription records…"
              : `${total.toLocaleString()} subscription record${total !== 1 ? "s" : ""} total.`
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                query.refetch();
                summaryQuery.refetch();
              }}
              aria-label="Refresh"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />Refresh
            </Button>
          }
        />

        {/* Platform-wide subscription summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total" value={summary?.total ?? 0} loading={summaryQuery.isLoading} />
          <StatCard label="Active / 5-day trial" value={activeCount} tone="emerald" loading={summaryQuery.isLoading} />
          <StatCard label="Past due" value={pastDueCount} tone={pastDueCount > 0 ? "amber" : undefined} loading={summaryQuery.isLoading} />
          <StatCard label="Canceled" value={canceledCount} loading={summaryQuery.isLoading} />
        </div>

        <Card className="space-y-4 border-border/70 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-semibold">Package upgrades</h2>
              <p className="text-xs text-muted-foreground">
                Paid customers and the plans they selected.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Active customers" value={summary?.activeCustomers ?? 0} tone="emerald" loading={summaryQuery.isLoading} />
            <StatCard label="New paid starts" value={summary?.upgradesLast30Days ?? 0} hint="last 30 days" loading={summaryQuery.isLoading} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Current paid plan mix</p>
            {summaryQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading plan activity…</p>
            ) : summary?.planBreakdown.length ? (
              <div className="flex flex-wrap gap-2">
                {summary.planBreakdown.map((item) => {
                  const plan = findPlanByPriceId(item.priceId);
                  return (
                    <Badge key={item.priceId} variant="secondary" className="gap-1.5">
                      {plan?.name ?? item.priceId}
                      <span className="font-semibold">{item.count}</span>
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No paid package activity yet.</p>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Est. monthly recurring revenue"
            value={`$${((summary?.estimatedMonthlyRevenueCents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            tone="emerald"
            loading={summaryQuery.isLoading}
          />
          <StatCard
            label="Est. annual recurring revenue"
            value={`$${((summary?.estimatedAnnualRevenueCents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            hint="annualized from active plans"
            loading={summaryQuery.isLoading}
          />
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter by email or subscription ID…"
                className="pl-8"
                aria-label="Search subscriptions"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={(v) => changeStatus(v as StatusFilter)}>
                <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="past_due">Past due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => query.refetch()}
                aria-label="Refresh subscriptions"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Results */}
        {query.isLoading ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Loading subscriptions…
          </Card>
        ) : query.isError ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">Failed to load subscriptions.</p>
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              Try again
            </Button>
          </Card>
        ) : rows.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            No subscriptions match your filters.
          </Card>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="grid gap-3 md:hidden">
              {rows.map((s) => (
                <SubscriptionCard
                  key={s.id}
                  sub={s}
                  opening={openingPortalFor === s.id}
                  onOpenPortal={() => openStripePortal(s)}
                />
              ))}
            </div>

            {/* Desktop: table */}
            <Card className="hidden overflow-hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">User</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Plan</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Status</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Renews / Ends</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">5-day trial end</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Cancel at period</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Env</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((s) => (
                      <tr key={s.id} className="align-middle transition-colors hover:bg-muted/40">
                        <td className="px-4 py-3 align-middle">
                          <div className="min-w-[180px] max-w-[260px]">
                            <div className="truncate font-medium">{s.display_name ?? "—"}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {s.email ?? "—"}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle font-medium">
                          {resolvePlanName(s)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle">
                          <StatusBadge status={s.status} currentPeriodEnd={s.current_period_end} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">
                          {formatDate(s.current_period_end)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">
                          {s.status === "trialing" ? formatDate(s.current_period_end) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle">
                          {s.cancel_at_period_end ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Yes
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle">
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {s.environment ?? "—"}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right align-middle">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={!s.stripe_customer_id || openingPortalFor === s.id}
                            onClick={() => openStripePortal(s)}
                            title={
                              s.stripe_customer_id
                                ? "Open Stripe billing portal for this customer"
                                : "No Stripe customer ID"
                            }
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {openingPortalFor === s.id ? "Opening…" : "Stripe portal"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Pagination controls */}
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                {q ? `Showing ${rows.length} of ${pageEnd - pageStart + 1} on page ${page}` : `${pageStart}–${pageEnd} of ${total.toLocaleString()}`}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || query.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <span className="px-2 tabular-nums">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || query.isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  tone,
  hint,
  loading,
}: {
  label: string;
  value: number | string;
  tone?: "emerald" | "amber";
  hint?: string;
  loading?: boolean;
}) {
  const valueClass =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "";
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${valueClass}`}>{loading ? "—" : value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SubscriptionCard({
  sub,
  opening,
  onOpenPortal,
}: {
  sub: AdminSubscriptionRow;
  opening: boolean;
  onOpenPortal: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{sub.display_name ?? "—"}</div>
          <div className="truncate text-xs text-muted-foreground">{sub.email ?? "—"}</div>
        </div>
        <StatusBadge status={sub.status} currentPeriodEnd={sub.current_period_end} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Plan</dt>
        <dd className="text-right font-medium">{resolvePlanName(sub)}</dd>

        <dt className="text-muted-foreground">
          {sub.status === "trialing" ? "5-day trial ends" : "Renews / Ends"}
        </dt>
        <dd className="text-right">{formatDate(sub.current_period_end)}</dd>

        {sub.cancel_at_period_end && (
          <>
            <dt className="text-muted-foreground">Cancels at period end</dt>
            <dd className="text-right text-amber-600 dark:text-amber-400">Yes</dd>
          </>
        )}

        <dt className="text-muted-foreground">Environment</dt>
        <dd className="text-right capitalize">{sub.environment ?? "—"}</dd>
      </dl>

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!sub.stripe_customer_id || opening}
          onClick={onOpenPortal}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {opening ? "Opening…" : "Stripe portal"}
        </Button>
      </div>
    </Card>
  );
}
