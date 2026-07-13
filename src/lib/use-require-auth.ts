import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

/**
 * Redirect unauthenticated visitors to /auth once the auth state resolves.
 * Use in top-level routes that live outside the `_authenticated/` layout
 * but still require a signed-in user. Returns the same shape as useAuth().
 */
export function useRequireAuth() {
  const auth = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!auth.loading && !auth.user) {
      navigate({ to: "/auth", replace: true });
    }
  }, [auth.loading, auth.user, navigate]);
  return auth;
}
