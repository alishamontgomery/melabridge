import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/vendors")({
  head: () => ({
    meta: [
      { title: "Vendors — MelaBridge" },
      { name: "description", content: "Browse and manage the vendors on your event." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VendorsPage,
});

type VendorRow = {
  id: string;
  business_name: string;
  business_category: string;
  city: string | null;
  starting_price: number | null;
};

function VendorsPage() {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<VendorRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("vendor_profiles_public")
        .select("id,business_name,business_category,city,starting_price")
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setVendors(data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell active="/vendors">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vendors"
          icon={Store}
          title="Vendor directory"
          description="Discover vendors on MelaBridge. Contract management and BridgeDNA™ matching launching soon."
        />

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading vendors…
          </div>
        ) : vendors.length === 0 ? (
          <Card className="p-8 text-center">
            <Store className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h3 className="font-display text-lg font-semibold">No vendors listed yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              As vendors join MelaBridge, they'll appear in the directory. Invite vendors you already work with to join.
            </p>
            <Button asChild className="mt-4"><Link to="/marketplace">Explore marketplace</Link></Button>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {vendors.map((v) => (
              <Card key={v.id} className="p-4">
                <p className="font-semibold">{v.business_name}</p>
                <p className="text-xs text-muted-foreground">
                  {v.business_category}
                  {v.city ? ` · ${v.city}` : ""}
                </p>
                {v.starting_price != null && (
                  <p className="mt-2 text-sm">From ${v.starting_price.toLocaleString()}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
