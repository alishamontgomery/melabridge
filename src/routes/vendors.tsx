import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { RouteError } from "@/components/module-states";

export const Route = createFileRoute("/vendors")({
  head: () => ({
    meta: [
      { title: "Marketplace — MelaBridge" },
      { name: "description", content: "Discover event vendors on the MelaBridge Marketplace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VendorsAlias,
  errorComponent: RouteError,
});

/**
 * `/vendors` was the original authenticated-only directory. Keep the route as
 * a compatibility alias so saved links continue to work, but make the
 * Marketplace the only vendor-search surface.
 */
function VendorsAlias() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: "/marketplace", replace: true });
  }, [navigate]);

  return (
    <main className="flex min-h-[50vh] items-center justify-center px-6 py-16">
      <p className="text-sm text-muted-foreground">Opening the Marketplace…</p>
    </main>
  );
}