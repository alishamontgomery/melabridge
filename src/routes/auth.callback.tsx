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
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < maxMs) {
    const { data, error } = await supabase.auth.getUser();
    if (data.user) return data.user;
    if (error) lastError = error;
    await wait(300);
  }
  throw lastError instanceof Error ? lastError : new Error("We couldn't confirm your secure session.");
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

function safeNextPath() {
  const stored = window.sessionStorage.getItem("melabridge.auth.next");
  window.sessionStorage.removeItem("melabridge.auth.next");
  if (!stored || !stored.startsWith("/") || stored.startsWith("//")) return "/events";
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
        navigate({ to: safeNextPath() as "/events", replace: true });
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
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
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