import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || user) return;
    const search = typeof location.search === "string" ? location.search : "";
    const intended = `${location.pathname}${search}`;
    if (
      intended.startsWith("/") &&
      !intended.startsWith("//") &&
      !intended.startsWith("/auth")
    ) {
      window.sessionStorage.setItem("melabridge.auth.next", intended);
    }
    navigate({ to: "/auth", replace: true });
  }, [loading, location.pathname, location.search, navigate, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
          Checking your secure session…
        </div>
      </div>
    );
  }

  return <Outlet />;
}