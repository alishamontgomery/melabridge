import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MelaBridge" },
      { name: "description", content: "Sign in or create your MelaBridge account." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "At least 8 characters").max(128);
const nameSchema = z.string().trim().min(1, "Enter your name").max(80);

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!loading && user) navigate({ to: "/events" });
  }, [loading, user, navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const em = emailSchema.parse(email);
      const pw = passwordSchema.parse(password);
      const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
      if (error) throw error;
      toast.success("Welcome back");
      navigate({ to: "/events" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const em = emailSchema.parse(email);
      const pw = passwordSchema.parse(password);
      const nm = nameSchema.parse(name);
      const { data, error } = await supabase.auth.signUp({
        email: em,
        password: pw,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: { display_name: nm },
        },
      });
      if (error) throw error;
      if (!data.session) {
        // Email confirmation still required — try password sign-in as fallback
        const { data: signIn, error: siErr } = await supabase.auth.signInWithPassword({
          email: em,
          password: pw,
        });
        if (siErr || !signIn.session) {
          toast.success("Check your email to confirm your account before signing in.");
          setTab("signin");
          return;
        }
      }
      toast.success("Account created — welcome to MelaBridge");
      navigate({ to: "/onboarding" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) throw result.error;
      if (!result.redirected) navigate({ to: "/events" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  async function handleForgot() {
    try {
      const em = emailSchema.parse(email);
      const { error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enter your email above first");
    }
  }

  return (
    <div className="min-h-screen bg-hero-radial px-4 py-10">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-display text-xl font-semibold">MelaBridge</span>
        </Link>

        <Card className="border-border/60 p-6 shadow-soft">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input id="signin-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <button type="button" onClick={handleForgot} className="text-xs text-primary hover:underline">
                      Forgot?
                    </button>
                  </div>
                  <Input id="signin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">Your name</Label>
                  <Input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input id="signup-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={handleGoogle}>
            Continue with Google
          </Button>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/terms" className="underline">Terms</Link> and{" "}
          <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
