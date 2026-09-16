import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BadgeCheck, Store, CheckCircle2, Clock, Search,
  XCircle, Lock, MoreHorizontal, ExternalLink, UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { getVendorCategories } from "@/lib/vendor-categories";
import { useState } from "react";
import { listVendorsForReview, setVendorVerified, type VendorRow } from "@/lib/admin-vendors.functions";
import { useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useRole } from "@/lib/use-role";

export const Route = createFileRoute("/admin/vendors")({
  head: () => ({
    meta: [
      { title: "Vendor Directory — AdminOS™ — MelaBridge" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminVendorsPage,
});

type FilterState = "all" | "active" | "incomplete" | "verified";

function AdminVendorsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { role, loading: roleLoading } = useRole();
  const isAdmin = role === "admin";
  const navigate = useNavigate();

  const fn = useServerFn(listVendorsForReview);
  const verifyFn = useServerFn(setVendorVerified);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterState>("all");
  const [toggling, setToggling] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-vendors"],
    enabled: isAdmin,
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  if (authLoading || roleLoading) {
    return (
      <AppShell active="/admin/vendors">
        <Card className="p-10 text-center text-sm text-muted-foreground">Checking access…</Card>
      </AppShell>
    );
  }

  if (!user || !isAdmin) {
    return (
      <AppShell active="/admin/vendors">
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="font-display text-xl font-semibold">AdminOS™ is restricted</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            This surface is only available to workspace administrators.
          </p>
          <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
        </Card>
      </AppShell>
    );
  }

  if (error || (data && !Array.isArray(data) && "error" in (data as object))) {
    const msg = error?.message ?? (data as { error: string } | undefined)?.error ?? "Unknown error";
    return (
      <AppShell active="/admin/vendors">
        <div className="space-y-6">
          <PageHeader eyebrow="AdminOS™" title="Vendor Directory" description="Failed to load vendor data." icon={Store} />
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <XCircle className="h-8 w-8 text-destructive" />
            <h2 className="font-display text-lg font-semibold">Failed to load vendors</h2>
            <p className="max-w-sm text-sm text-muted-foreground">{msg}</p>
            <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["admin-vendors"] })}>
              Retry
            </Button>
          </Card>
        </div>
      </AppShell>
    );
  }

  const vendors = Array.isArray(data) ? data as VendorRow[] : [];

  const filtered = vendors.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      v.business_name?.toLowerCase().includes(q) ||
      getVendorCategories(v).some((category) => category.toLowerCase().includes(q)) ||
      v.city?.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q);
    const matchFilter =
      filter === "all" ||
      (filter === "active" && v.onboarding_completed) ||
      (filter === "incomplete" && !v.onboarding_completed) ||
      (filter === "verified" && v.is_verified);
    return matchSearch && matchFilter;
  });

  async function handleToggleBadge(vendor: VendorRow) {
    if (!vendor.onboarding_completed && !vendor.is_verified) {
      toast.error("Vendor profile is incomplete — cannot grant BridgeCheck badge");
      return;
    }
    setToggling(vendor.id);
    try {
      const result = await verifyFn({ data: { vendorProfileId: vendor.id, verify: !vendor.is_verified } });
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          vendor.is_verified
            ? `BridgeCheck™ badge removed from ${vendor.business_name}`
            : `BridgeCheck™ badge granted to ${vendor.business_name}`,
        );
        qc.invalidateQueries({ queryKey: ["admin-vendors"] });
      }
    } catch {
      toast.error("Could not update badge status");
    } finally {
      setToggling(null);
    }
  }

  const totalCount = vendors.length;
  const activeCount = vendors.filter(v => v.onboarding_completed).length;
  const incompleteCount = vendors.filter(v => !v.onboarding_completed).length;
  const verifiedCount = vendors.filter(v => v.is_verified).length;

  const filterTabs: { key: FilterState; label: string; count: number; color?: string }[] = [
    { key: "all", label: "All vendors", count: totalCount },
    { key: "active", label: "Active listings", count: activeCount, color: "text-emerald-600" },
    { key: "incomplete", label: "Incomplete", count: incompleteCount, color: "text-amber-600" },
    { key: "verified", label: "BridgeCheck™", count: verifiedCount, color: "text-primary" },
  ];

  return (
    <AppShell active="/admin/vendors">
      <div className="space-y-6">
        <PageHeader
          eyebrow="AdminOS™"
          title="Vendor Directory"
          description="All vendors on MelaBridge. Click any listing to open the public profile. Manage and moderate from here."
          icon={Store}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">← AdminOS</Link>
            </Button>
          }
        />

        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-1">
          {filterTabs.map(({ key, label, count, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filter === key
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <span className={`rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none ${
                filter === key && color ? color : ""
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-9"
            placeholder="Search by name, category, city, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <Card className="border-border/60 p-10 text-center shadow-soft">
            <Store className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-semibold">No vendors match</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search ? "Try a different search term." : "No vendors in this filter yet."}
            </p>
            {search && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSearch("")}>Clear search</Button>
            )}
          </Card>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{filtered.length} vendor{filtered.length !== 1 ? "s" : ""}</p>
            {filtered.map((v) => (
              <VendorDirectoryCard
                key={v.id}
                vendor={v}
                onToggleBadge={() => handleToggleBadge(v)}
                toggling={toggling === v.id}
                onViewProfile={() => {
                  if (v.onboarding_completed) {
                    navigate({ to: "/vendor-profile/$vendorId", params: { vendorId: v.id } });
                  }
                }}
                onManageUser={() => {
                  navigate({ to: "/admin/users" });
                }}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function VendorDirectoryCard({
  vendor: v,
  onToggleBadge,
  toggling,
  onViewProfile,
  onManageUser,
}: {
  vendor: VendorRow;
  onToggleBadge: () => void;
  toggling: boolean;
  onViewProfile: () => void;
  onManageUser: () => void;
}) {
  const canViewProfile = v.onboarding_completed;

  return (
    <Card
      className={`border-border/60 p-4 shadow-soft transition ${canViewProfile ? "cursor-pointer hover:border-primary/40 hover:shadow-elegant" : ""}`}
      onClick={canViewProfile ? onViewProfile : undefined}
      role={canViewProfile ? "button" : undefined}
      tabIndex={canViewProfile ? 0 : undefined}
      onKeyDown={canViewProfile ? (e) => e.key === "Enter" && onViewProfile() : undefined}
    >
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Business name — clickable if profile is live */}
            {canViewProfile ? (
              <span className="font-semibold truncate hover:text-primary transition-colors">
                {v.business_name || "Unnamed vendor"}
              </span>
            ) : (
              <span className="font-semibold truncate text-muted-foreground">
                {v.business_name || "Unnamed vendor"}
              </span>
            )}

            {v.is_verified && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> BridgeCheck™
              </Badge>
            )}
            {v.onboarding_completed ? (
              <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
                <Store className="h-3 w-3" aria-hidden="true" /> Listed
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                <Clock className="h-3 w-3" aria-hidden="true" /> Incomplete
              </Badge>
            )}
          </div>

          <p className="mt-0.5 text-sm text-muted-foreground">
            {getVendorCategories(v).join(" · ")}
            {(v.city || v.state) && ` · ${[v.city, v.state].filter(Boolean).join(", ")}`}
            {v.starting_price && ` · From $${Number(v.starting_price).toLocaleString()}`}
          </p>
          {v.email && <p className="mt-0.5 text-xs text-muted-foreground">{v.email}</p>}
          {v.business_description && (
            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{v.business_description}</p>
          )}
          {!canViewProfile && (
            <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
              Profile not published — vendor hasn't completed onboarding.
            </p>
          )}
        </div>

        {/* Actions — stop propagation so dropdown doesn't trigger card click */}
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={toggling}>
                <MoreHorizontal className="h-4 w-4" /> Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Vendor actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={onViewProfile}
                disabled={!canViewProfile}
                className={!canViewProfile ? "opacity-40 cursor-not-allowed" : ""}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {canViewProfile ? "View public profile" : "Profile not published"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>BridgeCheck™ badge</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={onToggleBadge}
                disabled={toggling || (!v.is_verified && !canViewProfile)}
              >
                {v.is_verified ? (
                  <><XCircle className="mr-2 h-4 w-4 text-destructive" /> Remove badge</>
                ) : (
                  <><BadgeCheck className="mr-2 h-4 w-4 text-emerald-600" /> Grant badge</>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onManageUser}>
                <UserCog className="mr-2 h-4 w-4" /> Manage user account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {v.verified_at && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          BridgeCheck granted {new Date(v.verified_at).toLocaleDateString()}
        </p>
      )}
    </Card>
  );
}
