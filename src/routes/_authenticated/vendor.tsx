import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Store, Inbox, Calendar, MessageSquare, FileText, ScrollText, Wallet,
  Building2, Image as ImageIcon, Star, BarChart3, Crown, Bell, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/vendor")({
  head: () => ({ meta: [{ title: "Vendor Dashboard — MelaBridge" }] }),
  component: VendorDashboardPage,
});

type VendorProfile = Tables<"vendor_profiles">;

const MODULES = [
  { to: "/vendor", label: "Dashboard", icon: Store },
  { to: "/vendor-portal", label: "Booking Requests", icon: Inbox },
  { to: "/vendor-portal", label: "Calendar & Availability", icon: Calendar },
  { to: "/messaging", label: "Messages", icon: MessageSquare },
  { to: "/vendor-portal", label: "Quotes & Proposals", icon: FileText },
  { to: "/vendor-portal", label: "Contracts", icon: ScrollText },
  { to: "/bridgepay", label: "Payments & Payouts", icon: Wallet },
  { to: "/profile", label: "Business Profile", icon: Building2 },
  { to: "/files", label: "Portfolio", icon: ImageIcon },
  { to: "/vendor-portal", label: "Reviews", icon: Star },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/subscription", label: "Subscription", icon: Crown },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/bridgepilot", label: "MelaAssist™", icon: Sparkles },
] as const;

function VendorDashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("vendor_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setLoading(false);
      });
  }, [user]);

  return (
    <AppShell active="/vendor">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vendor Workspace"
          icon={Store}
          title={profile ? profile.business_name : "Your vendor business"}
          description={
            profile
              ? `${profile.business_category}${profile.city ? ` · ${profile.city}${profile.state ? ", " + profile.state : ""}` : ""}`
              : "Set up your business profile to start receiving booking requests."
          }
        />

        <Card className="border-primary/30 bg-primary/5 p-5 shadow-soft">
          <div className="flex flex-wrap items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">MelaAssist™ for vendors</p>
              <p className="mt-1 text-muted-foreground">
                Optimize your profile, generate quotes, respond to inquiries, and spot slow booking periods.
              </p>
            </div>
            <Button asChild variant="hero" size="sm">
              <Link to="/bridgepilot">Open MelaAssist™</Link>
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Open requests", value: "0" },
            { label: "Upcoming bookings", value: "0" },
            { label: "Awaiting payout", value: "$0" },
            { label: "Profile views (30d)", value: "—" },
          ].map((s) => (
            <Card key={s.label} className="border-border/60 p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-display text-xl font-semibold">{s.value}</p>
            </Card>
          ))}
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold">Your workspace</h2>
          <p className="text-sm text-muted-foreground">Everything you need to run your event business.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(({ to, label, icon: Icon }) => (
              <Link
                key={label}
                to={to}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary hover:bg-primary/5"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {!loading && !profile && (
          <Card className="border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Complete your business profile to start showing up in the MelaBridge marketplace.
            </p>
            <Button asChild variant="hero" className="mt-3">
              <Link to="/onboarding" search={{ type: "vendor" }}>Complete profile</Link>
            </Button>
          </Card>
        )}

        {profile && (
          <Card className="border-border/60 p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">Marketplace status</p>
                <p className="text-xs text-muted-foreground">Visible to planners searching your category.</p>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-700">Active</Badge>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
