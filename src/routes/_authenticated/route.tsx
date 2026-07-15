import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const result = await Promise.race([
      supabase.auth.getUser().then(({ data, error }) => ({ user: data.user, error: error?.message ?? null })),
      new Promise<{ user: null; error: string }>((resolve) => {
        window.setTimeout(() => resolve({ user: null, error: "Authentication timed out" }), 10_000);
      }),
    ]);
    if (result.error || !result.user) {
      // Preserve the intended destination so we can return the user here after sign-in.
      if (typeof window !== "undefined") {
        const intended = `${location.pathname}${location.searchStr ?? ""}`;
        if (intended.startsWith("/") && !intended.startsWith("//") && intended !== "/auth") {
          window.sessionStorage.setItem("melabridge.auth.next", intended);
        }
      }
      throw redirect({ to: "/auth" });
    }
    return { user: result.user };
  },
  component: () => <Outlet />,
});
