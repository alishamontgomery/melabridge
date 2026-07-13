import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Briefcase, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/vendor-portal")({
  head: () => ({
    meta: [
      { title: "Vendor Portal — MelaBridge" },
      { name: "description", content: "Your leads, bookings, contracts, and payouts in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VendorPortalPage,
});

function VendorPortalPage() {
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("vendor_profiles")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();
      if (cancelled) return;
      setHasProfile(!!data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell active="/vendor-portal">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vendor Portal"
          title="Your bookings & leads"
          description="Track incoming leads, confirmed bookings, deliverables, and payouts."
          icon={Briefcase}
        />

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : !hasProfile ? (
          <Card className="p-8 text-center">
            <Briefcase className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h3 className="font-display text-lg font-semibold">Set up your vendor profile first</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              You need a business profile before leads and bookings can flow into your portal.
            </p>
            <Button asChild className="mt-4">
              <Link to="/profile">Complete vendor profile</Link>
            </Button>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h3 className="font-display text-lg font-semibold">No leads or bookings yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              As planners contact you through MelaBridge, leads and bookings will appear here. Manage active conversations in your inbox.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button asChild variant="outline"><Link to="/messaging">Open inbox</Link></Button>
              <Button asChild><Link to="/bridgepilot">Open MelaAssist™</Link></Button>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
