import { BrandMark } from "@/components/brand-logo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — MelaBridge" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [touched, setTouched] = useState(false);
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "missing">("checking");

  const strength = useMemo(() => getPasswordStrength(pw), [pw]);
  const passwordError = pw.length === 0 ? "New password is required" : z.string().min(8).max(128).safeParse(pw).success ? null : "Use at least 8 characters";
  const matchError = confirmPw.length === 0 ? "Confirm your new password" : pw === confirmPw ? null : "Passwords must match";
  const formValid = !passwordError && !matchError && sessionState === "ready";

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const search = new URLSearchParams(window.location.search);
    const errorDescription = hash.get("error_description") || search.get("error_description");
    if (errorDescription) {
      setError("This password reset link is invalid or expired. Please request a new reset email.");
      setSessionState("missing");
      return;
    }

    // Supabase fires PASSWORD_RECOVERY when the recovery token in the URL is exchanged for a session.
    // We must have that session before calling updateUser — otherwise the update would either fail
    // or, worse, mutate the currently signed-in user's password on a shared device.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) setSessionState("ready");
    });

    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setSessionState("ready");
      } else {
        // Give Supabase a moment to exchange the URL token for a session on first load.
        window.setTimeout(async () => {
          if (cancelled) return;
          const { data: retry } = await supabase.auth.getSession();
          if (retry.session) setSessionState("ready");
          else {
            setSessionState("missing");
            setError("This password reset link is invalid or expired. Please request a new reset email.");
          }
        }, 1500);
      }
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!formValid) return;
    setBusy(true);
    setError(null);
    setStatus("Updating your password...");
    const timeout = window.setTimeout(() => {
      setBusy(false);
      setStatus("");
      setError("This is taking longer than expected. Please try again.");
    }, 10_000);
    try {
      const password = z.string().min(8).max(128).parse(pw);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      window.clearTimeout(timeout);
      toast.success("Password updated");
      // Sign the recovery session out so the user must sign in fresh with the new password.
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
    } catch (err) {
      window.clearTimeout(timeout);
      const message = err instanceof Error ? err.message : "Could not update password";
      setError(message.toLowerCase().includes("auth") ? "Open the latest reset email and try again." : message);
      toast.error(message);
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="min-h-screen bg-hero-radial px-4 py-10">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <BrandMark size="lg" />
          <span className="font-display text-xl font-semibold">MelaBridge</span>
        </Link>
        <Card className="mt-16 border-border/60 p-6 shadow-soft">
          <h1 className="font-display text-xl font-semibold">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter a new password for your account.</p>
          {error && (
            <Alert variant="destructive" className="mt-5">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Password reset needs attention</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {busy && (
            <div className="mt-5 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" />
              {status}
            </div>
          )}
          <form onSubmit={handle} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New password</Label>
              <PasswordField id="new-pw" value={pw} onChange={setPw} visible={showPw} onToggle={() => setShowPw((v) => !v)} onBlur={() => setTouched(true)} />
              {touched && passwordError && <FieldError>{passwordError}</FieldError>}
              <PasswordStrength score={strength.score} label={strength.label} active={pw.length > 0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-new-pw">Confirm new password</Label>
              <PasswordField id="confirm-new-pw" value={confirmPw} onChange={setConfirmPw} visible={showConfirmPw} onToggle={() => setShowConfirmPw((v) => !v)} onBlur={() => setTouched(true)} />
              {touched && matchError && <FieldError>{matchError}</FieldError>}
            </div>
            <Button type="submit" disabled={busy || !formValid} className="w-full">
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function getPasswordStrength(password: string) {
  const checks = [password.length >= 8, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password), password.length >= 12];
  const score = checks.filter(Boolean).length;
  const label = score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : score === 4 ? "Strong" : "Excellent";
  return { score, label };
}

function PasswordField({ id, value, onChange, visible, onToggle, onBlur }: { id: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void; onBlur: () => void }) {
  return (
    <div className="relative">
      <Input id={id} type={visible ? "text" : "password"} value={value} onBlur={onBlur} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" className="pr-11" required />
      <button type="button" onClick={onToggle} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" aria-label={visible ? "Hide password" : "Show password"}>
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="flex items-center gap-1.5 text-xs text-destructive"><AlertCircle className="h-3 w-3" />{children}</p>;
}

function PasswordStrength({ score, label, active }: { score: number; label: string; active: boolean }) {
  const normalized = active ? Math.max(1, score) : 0;
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map((step) => <div key={step} className={`h-1.5 rounded-full transition-colors ${normalized >= step ? normalized <= 2 ? "bg-destructive" : normalized === 3 ? "bg-gold" : "bg-primary" : "bg-muted"}`} />)}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {active && score >= 3 ? <CheckCircle2 className="h-3 w-3 text-primary" /> : null}
        Password strength: {active ? label : "Add at least 8 characters"}
      </p>
    </div>
  );
}
