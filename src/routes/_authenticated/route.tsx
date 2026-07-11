import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await Promise.race([
      supabase.auth.getUser(),
      new Promise<Awaited<ReturnType<typeof supabase.auth.getUser>>>((resolve) => {
        window.setTimeout(() => resolve({ data: { user: null }, error: new Error("Authentication timed out") }), 10_000);
      }),
    ]);
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
