import { BrandMark } from "@/components/brand-logo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing in — MelaBridge" }] }),
  component: AuthCallbackPage,
});

function friendlyAuthError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "Authentication failed");
  const message = raw.toLowerCase();
  if (message.includes("invalid") || message.includes("expired")) return "This sign-in link is invalid or expired. Please start again.";
  if (message.includes("failed to fetch") || message.includes("network") || message.includes("timeout")) return "The secure sign-in request took too long. Please try again.";
  return raw;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function waitForAuthenticatedUser(maxMs = 9000) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user;
  return await new Promise<User>((resolve, reject) => {
    let settled = false;
    const finish = (u: User | null) => {
      if (settled) return;
      settled = true;
      sub.unsubscribe();
      window.clearInterval(poll);
      window.clearTimeout(timer);
      if (u) resolve(u); else reject(new Error("We couldn't confirm your secure session."));
    };
    const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) finish(session.user);
    });
    const poll = window.setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) finish(data.session.user);
    }, 300);
    const timer = window.setTimeout(() => finish(null), maxMs);
  });
}

async function ensureProfile(user: User) {
  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "MelaBridge planner";
  const { error } = await supabase.from("profiles").upsert(
    { id: user.id, email: user.email ?? "", display_name: displayName },
    { onConflict: "id" },
  );
  if (error) throw new Error(`Workspace setup failed: ${error.message}`);
}

async function landingRouteForUser(userId: string): Promise<"/dashboard" | "/vendor" | "/admin"> {
  const [rolesRes, profileRes, vendorRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("account_type").eq("id", userId).maybeSingle(),
    supabase.from("vendor_profiles").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  const roles = (rolesRes.data ?? []).map((r) => r.role as string);
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("vendor")) return "/vendor";
  if (profileRes.data?.account_type === "vendor") return "/vendor";
  if (vendorRes.data?.id) return "/vendor";
  return "/dashboard";
}

function safeNextPath(fallback: string) {
  const stored = window.sessionStorage.getItem("melabridge.auth.next");
  window.sessionStorage.removeItem("melabridge.auth.next");
  if (!stored || !stored.startsWith("/") || stored.startsWith("//")) return fallback;
  return stored;
}

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Finalizing your secure sign-in...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setError("This is taking longer than expected. Please try signing in again.");
    }, 10_000);

    async function finishAuth() {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const searchParams = new URLSearchParams(window.location.search);
        const errorDescription = hashParams.get("error_description") || searchParams.get("error_description");
        if (errorDescription) throw new Error(errorDescription);

        setMessage("Creating your MelaBridge session...");
        const user = await waitForAuthenticatedUser();
        setMessage("Setting up your workspace...");
        await ensureProfile(user);
        if (cancelled) return;
        window.clearTimeout(timeout);
        const landing = await landingRouteForUser(user.id);
        navigate({ to: safeNextPath(landing) as "/dashboard", replace: true });
      } catch (err) {
        if (!cancelled) {
          window.clearTimeout(timeout);
          setError(friendlyAuthError(err));
        }
      }
    }

    void finishAuth();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-hero-radial px-4 py-10">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <BrandMark size="lg" />
          <span className="font-display text-xl font-semibold">MelaBridge</span>
        </Link>

        <Card className="border-border/60 p-6 text-center shadow-soft">
          {error ? (
            <div className="space-y-5 text-left">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Sign-in could not finish</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button asChild className="w-full">
                <Link to="/auth">Try again</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold">Signing you in</h1>
                <p className="mt-1 text-sm text-muted-foreground" role="status" aria-live="polite">
                  {message}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}