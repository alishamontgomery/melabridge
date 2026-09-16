import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Boxes,
  CheckCircle2,
  Eye,
  ImageIcon,
  Settings2,
  Store,
  Tags,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDisplayName } from "@/lib/use-display-name";

export const Route = createFileRoute("/_authenticated/vendor")({
  head: () => ({ meta: [{ title: "Vendor Dashboard — MelaBridge" }] }),
  component: VendorDashboardPage,
});

type VendorPhoto = { url: string; type: string };
type VendorProfileRow = {
  id: string;
  business_name: string | null;
  business_category: string | null;
  business_categories?: string[] | null;
  business_description: string | null;
  logo_url: string | null;
  portfolio_urls: string[] | null;
  vendor_photos?: VendorPhoto[] | null;
  virtual_services: string | null;
  onboarding_completed: boolean | null;
};
type PkgSummary = { id: string };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getServices(profile: VendorProfileRow | null) {
  if (!profile) return [];
  const categories = profile.business_categories?.filter(Boolean) ?? [];
  if (categories.length > 0) return categories;
  return profile.business_category ? [profile.business_category] : [];
}

function getProfileCompletion(profile: VendorProfileRow | null, packageCount: number) {
  if (!profile) return 0;
  const photoCount =
    (profile.vendor_photos?.filter((photo) => photo.url).length ?? 0) ||
    profile.portfolio_urls?.filter(Boolean).length ||
    0;
  const hasServices = getServices(profile).length > 0;
  const hasDescription = Boolean(profile.business_description?.trim());
  const hasBusinessName = Boolean(profile.business_name?.trim());
  const hasLogo = Boolean(profile.logo_url);
  const hasPackages = packageCount > 0;
  const hasPortfolio = photoCount > 0;
  return Math.round(
    ([hasBusinessName, hasServices, hasDescription, hasLogo, hasPortfolio, hasPackages].filter(Boolean).length / 6) * 100,
  );
}

function statusFor(profile: VendorProfileRow | null, completion: number) {
  if (profile?.onboarding_completed) return "Published" as const;
  if (completion >= 80) return "Ready to publish" as const;
  return "Draft" as const;
}

function VendorDashboardPage() {
  const { user } = useAuth();
  const { firstName, businessName } = useDisplayName();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["vendor-profile-snapshot", "dashboard", user?.id],
    queryFn: async (): Promise<VendorProfileRow | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("vendor_profiles")
        .select(
          "id,business_name,business_category,business_categories,business_description,logo_url,portfolio_urls,vendor_photos,virtual_services,onboarding_completed",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as VendorProfileRow | null;
    },
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const { data: packages = [], isLoading: packagesLoading } = useQuery({
    queryKey: ["vendor-packages-summary", profile?.id],
    queryFn: async (): Promise<PkgSummary[]> => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("vendor_packages")
        .select("id")
        .eq("vendor_id", profile.id);
      if (error) throw error;
      return (data ?? []) as PkgSummary[];
    },
    enabled: Boolean(profile?.id),
    staleTime: 30_000,
  });

  const loading = profileLoading || packagesLoading;
  const completion = getProfileCompletion(profile ?? null, packages.length);
  const status = statusFor(profile ?? null, completion);
  const services = getServices(profile ?? null);
  const photoCount =
    profile?.vendor_photos?.filter((photo) => photo.url).length ||
    profile?.portfolio_urls?.filter(Boolean).length ||
    0;

  const contextualAction = profile?.onboarding_completed
    ? { label: "View public listing", to: profile.id ? `/vendor-profile/${profile.id}` : "/vendor-profile-builder" }
    : { label: completion >= 80 ? "Review and publish" : "Continue setup", to: "/vendor-profile-builder" };

  return (
    <AppShell active="/vendor">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{greeting()},</p>
            <h1 className="mt-1 truncate font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {firstName}
            </h1>
            {businessName && <p className="mt-1 text-sm text-muted-foreground">{businessName}</p>}
          </div>
          <Button asChild variant="hero" className="shrink-0">
            <Link to={contextualAction.to as "/vendor-profile-builder"}>
              {status === "Published" ? <Eye className="mr-2 h-4 w-4" /> : <Store className="mr-2 h-4 w-4" />}
              {contextualAction.label}
            </Link>
          </Button>
        </section>

        <Card className="overflow-hidden border-border/70 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 bg-hero-radial p-5 sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Listing status</p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    status === "Published" ? "bg-emerald-500" : status === "Ready to publish" ? "bg-amber-500" : "bg-muted-foreground/50"
                  }`}
                  aria-hidden="true"
                />
                <h2 className="font-display text-xl font-semibold">{status}</h2>
              </div>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {status === "Published"
                  ? "Your listing is visible in the MelaBridge marketplace."
                  : status === "Ready to publish"
                    ? "Your profile has the essentials. Review the preview and publish when it looks right."
                    : "Build your profile in a few focused steps. Your work is saved as a private draft until you publish."}
              </p>
            </div>
            <div className="min-w-[9rem] text-right">
              <p className="font-display text-4xl font-semibold tabular-nums">{loading ? "—" : `${completion}%`}</p>
              <p className="text-xs text-muted-foreground">profile complete</p>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-label={`${completion}% profile complete`}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completion}%` }} />
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <CompletionItem label="Business details" complete={Boolean(profile?.business_name && services.length)} />
              <CompletionItem label="Description & photos" complete={Boolean(profile?.business_description && photoCount)} />
              <CompletionItem label="Packages" complete={packages.length > 0} />
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="border-border/60 p-5 shadow-soft sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your listing</p>
                <h2 className="mt-1 font-display text-lg font-semibold">What planners will see</h2>
              </div>
              <Store className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <SummaryValue icon={Tags} label="Services" value={loading ? "—" : String(services.length)} />
              <SummaryValue icon={Boxes} label="Packages" value={loading ? "—" : String(packages.length)} />
              <SummaryValue icon={ImageIcon} label="Photos" value={loading ? "—" : String(photoCount)} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {services.length > 0 ? services.slice(0, 5).map((service) => (
                <span key={service} className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">{service}</span>
              )) : <p className="text-sm text-muted-foreground">Add the services you offer to help planners find you.</p>}
            </div>
          </Card>

          <Card className="border-border/60 p-5 shadow-soft sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Quick actions</p>
            <div className="mt-4 grid gap-2">
              <ActionLink to="/vendor-profile-builder" icon={Store}>Edit profile</ActionLink>
              <ActionLink to="/vendor-packages" icon={Boxes}>Manage packages</ActionLink>
              <ActionLink to="/vendor-settings" icon={Settings2}>Contact & services</ActionLink>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function CompletionItem({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <CheckCircle2 className={`h-4 w-4 ${complete ? "text-emerald-500" : "text-muted-foreground/40"}`} aria-hidden="true" />
      <span className={complete ? "text-foreground" : ""}>{label}</span>
    </div>
  );
}

function SummaryValue({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 font-display text-xl font-semibold">{value}</p>
    </div>
  );
}

function ActionLink({
  to,
  icon: Icon,
  children,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to as "/vendor-profile-builder"}
      className="flex min-h-11 items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5 text-sm font-medium transition hover:border-primary/50 hover:bg-accent/50"
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      {children}
    </Link>
  );
}