import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ModuleError, ModuleLoading, RouteError } from "@/components/module-states";

export const Route = createFileRoute("/vendors")({
  head: () => ({
    meta: [
      { title: "Vendors — MelaBridge" },
      { name: "description", content: "Browse and manage the vendors on your event." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VendorsPage,
  errorComponent: RouteError,
});

type VendorRow = {
  id: string;
  business_name: string;
  business_category: string;
  city: string | null;
  starting_price: number | null;
};

function VendorsPage() {
  const vq = useQuery({
    queryKey: ["vendors-directory"],
    queryFn: async (): Promise<VendorRow[]> => {
      const { data, error } = await supabase
        .from("vendor_profiles_public")
        .select("id,business_name,business_category,city,starting_price")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).filter(
        (v): v is VendorRow => !!v.id && !!v.business_name && !!v.business_category,
      );
    },
  });

  const vendors = vq.data ?? [];

  return (
    <AppShell active="/vendors">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vendors"
          icon={Store}
          title="Vendor directory"
          description="Discover vendors on MelaBridge. Contract management and BridgeDNA™ matching launching soon."
        />

        {vq.isLoading ? (
          <ModuleLoading rows={3} showStats={false} />
        ) : vq.isError ? (
          <ModuleError error={vq.error} onRetry={() => vq.refetch()} />
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
