import { BrandMark } from "@/components/brand-logo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useServerFn } from "@tanstack/react-start";
import { provisionCurrentClerkIdentity } from "@/lib/auth-register.functions";
import { consumeIntendedPath } from "@/lib/auth-helpers";
import { postAuthDestination } from "@/lib/auth-flow-policy";
import { useAuth as useClerkAuth, useClerk } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallbackPage });
function AuthCallbackPage() {
  const provision = useServerFn(provisionCurrentClerkIdentity);
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const { signOut } = useClerk();
  const callbackStarted = useRef(false);
  const [message, setMessage] = useState("Finalizing your secure sign-in..."); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!isLoaded) return;
    if (callbackStarted.current) return;
    callbackStarted.current = true;
    let cancelled = false; void (async () => {
    try {
      const attemptKey = "melabridge.auth.callback_attempts";
      const attempts = Number(window.sessionStorage.getItem(attemptKey) || "0") + 1;
      window.sessionStorage.setItem(attemptKey, String(attempts));
      if (attempts > 2) {
        setMessage("Resetting an expired browser session...");
        window.sessionStorage.removeItem(attemptKey);
        await signOut({ redirectUrl: "/auth" });
        return;
      }
       if (!isSignedIn) throw new Error("No active Clerk session was created.");
       setMessage("Confirming your secure session...");
       const sessionToken = await getToken({ skipCache: true });
       if (!sessionToken) throw new Error("No active Clerk session was created.");
      if (cancelled) return;

      setMessage("Setting up your MelaBridge workspace...");
      const result = await provision({ data: { sessionToken } });
      if (cancelled) return;
      const destination = postAuthDestination(result.role, result.onboardingCompleted);
      if (destination.kind === "admin") {
        window.sessionStorage.removeItem(attemptKey);
        window.location.replace("/admin"); return;
      }
      if (destination.kind === "vendor") {
        window.sessionStorage.removeItem(attemptKey);
        window.location.replace("/vendor"); return;
      }
      if (destination.kind === "onboarding") {
        window.sessionStorage.removeItem(attemptKey);
        window.location.replace(`/onboarding?type=${encodeURIComponent(destination.type)}`); return;
      }
      window.sessionStorage.removeItem(attemptKey);
      window.location.replace(consumeIntendedPath(destination.route, destination.role));
    } catch {
      window.sessionStorage.removeItem("melabridge.auth.callback_attempts");
      if (!cancelled) setError("We couldn't finish signing you in. Please try again.");
    }
  })(); return () => { cancelled = true; }; }, [getToken, isLoaded, isSignedIn, provision, signOut]);
  return <div className="min-h-screen bg-hero-radial px-4 py-10"><div className="mx-auto max-w-md"><Link to="/" className="mb-8 flex items-center justify-center gap-2"><BrandMark size="lg" /><span className="font-display text-xl font-semibold">MelaBridge</span></Link><Card className="p-6 text-center shadow-soft">{error ? <div className="space-y-5 text-left"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Sign-in could not finish</AlertTitle><AlertDescription>{error}</AlertDescription></Alert><Button asChild className="w-full"><Link to="/auth">Try again</Link></Button></div> : <div className="space-y-4"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p role="status">{message}</p></div>}</Card></div></div>;
}