import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MelaBridge" },
      { name: "description", content: "Sign in or create your MelaBridge account." },
    ],
  }),
  component: AuthRoute,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "At least 8 characters").max(128);
const nameSchema = z.string().trim().min(1, "Enter your name").max(80);
type AuthOperation = "signin" | "signup" | "google" | "reset";

function AuthRoute() {
  const location = useLocation();
  if (location.pathname === "/auth/callback") return <Outlet />;
  return <AuthPage />;
}

function getPasswordStrength(password: string) {
  const checks = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
    password.length >= 12,
  ];
  const score = checks.filter(Boolean).length;
  const label = score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : score === 4 ? "Strong" : "Excellent";
  return { score, label };
}

function friendlyAuthError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "Authentication failed");
  const message = raw.toLowerCase();
  if (message.includes("already registered") || message.includes("already exists")) {
    return "An account already exists with this email. Sign in instead or reset your password.";
  }
  if (message.includes("weak") || message.includes("easy to guess") || message.includes("password")) {
    return "Choose a stronger password that is unique to MelaBridge and not commonly used.";
  }
  if (message.includes("invalid login") || message.includes("invalid credentials")) {
    return "We couldn't sign you in with those details. Check your email and password, then try again.";
  }
  if (message.includes("email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }
  if (message.includes("failed to fetch") || message.includes("network") || message.includes("timeout")) {
    return "The secure sign-in request took too long. Check your connection and try again.";
  }
  if (message.includes("popup") || message.includes("oauth")) {
    return "Google sign-in could not finish. Please try again and allow the secure sign-in window to complete.";
  }
  return raw;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function safeNextPath() {
  const stored = window.sessionStorage.getItem("melabridge.auth.next");
  window.sessionStorage.removeItem("melabridge.auth.next");
  if (!stored || !stored.startsWith("/") || stored.startsWith("//")) return "/events";
  return stored;
}

async function waitForAuthenticatedUser(maxMs = 4500) {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < maxMs) {
    const { data, error } = await supabase.auth.getUser();
    if (data.user) return data.user;
    if (error) lastError = error;
    await wait(250);
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("We couldn't confirm your session. Please try again.");
}

async function ensureProfile(user: User, displayName?: string) {
  const fallbackName =
    displayName ||
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "MelaBridge planner";
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      display_name: fallbackName,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`Your account was created, but workspace setup failed: ${error.message}`);
}

type SignupAccountType = "planner" | "vendor" | "guest";

async function landingRouteForUser(userId: string): Promise<"/events" | "/vendor"> {
  const { data } = await supabase.from("profiles").select("account_type").eq("id", userId).maybeSingle();
  return data?.account_type === "vendor" ? "/vendor" : "/events";
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [activeOperation, setActiveOperation] = useState<AuthOperation | null>(null);
  const [lastOperation, setLastOperation] = useState<AuthOperation | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<SignupAccountType>("planner");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const timedOutRef = useRef(false);
  const callbackHandledRef = useRef(false);

  const busy = activeOperation !== null;

  const emailError = email.length === 0 ? "Email is required" : emailSchema.safeParse(email).success ? null : "Enter a valid email address";
  const nameError = name.trim().length === 0 ? "Your name is required" : nameSchema.safeParse(name).success ? null : "Enter your name";
  const passwordError = password.length === 0 ? "Password is required" : passwordSchema.safeParse(password).success ? null : "Use at least 8 characters";
  const confirmPasswordError = confirmPassword.length === 0 ? "Confirm your password" : password === confirmPassword ? null : "Passwords must match";
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);
  const isSigninValid = !emailError && password.length > 0;
  const isSignupValid = !nameError && !emailError && !passwordError && !confirmPasswordError;

  useEffect(() => {
    if (!loading && user) {
      void landingRouteForUser(user.id).then((to) => navigate({ to }));
    }
  }, [loading, user, navigate]);

  async function runAuthOperation(operation: AuthOperation, message: string, action: () => Promise<void>) {
    if (busy) return;
    timedOutRef.current = false;
    setLastOperation(operation);
    setActiveOperation(operation);
    setStatusMessage(message);
    setAuthError(null);

    const timeout = window.setTimeout(() => {
      timedOutRef.current = true;
      setActiveOperation(null);
      setStatusMessage("");
      const timeoutMessage = "This is taking longer than expected. Please try again.";
      setAuthError(timeoutMessage);
      toast.error(timeoutMessage);
    }, 10_000);

    try {
      await action();
    } catch (err) {
      if (!timedOutRef.current) {
        const message = friendlyAuthError(err);
        setAuthError(message);
        toast.error(message);
      }
    } finally {
      window.clearTimeout(timeout);
      if (!timedOutRef.current) {
        setActiveOperation(null);
        setStatusMessage("");
      }
    }
  }

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    const errorDescription = hashParams.get("error_description") || searchParams.get("error_description");
    const isCallback = window.location.pathname === "/auth/callback";
    if (errorDescription) {
      setAuthError(friendlyAuthError(new Error(errorDescription)));
      return;
    }
    if (!isCallback || callbackHandledRef.current) return;
    callbackHandledRef.current = true;
    void runAuthOperation("google", "Finalizing your secure sign-in...", async () => {
      const signedInUser = await waitForAuthenticatedUser(9000);
      setStatusMessage("Setting up your workspace...");
      await ensureProfile(signedInUser);
      toast.success("Signed in successfully");
      const landing = await landingRouteForUser(signedInUser.id);
      const next = safeNextPath();
      navigate({ to: (next === "/events" ? landing : next) as "/events", replace: true });
    });
    // Run once on mount so OAuth callbacks cannot loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitSignIn() {
    setTouched((current) => ({ ...current, signinEmail: true, signinPassword: true }));
    if (!isSigninValid) return;
    await runAuthOperation("signin", "Signing you in...", async () => {
      const em = emailSchema.parse(email);
      const { error } = await supabase.auth.signInWithPassword({ email: em, password });
      if (error) throw error;
      setStatusMessage("Restoring your workspace...");
      const signedInUser = await waitForAuthenticatedUser();
      await ensureProfile(signedInUser);
      toast.success("Welcome back");
      navigate({ to: await landingRouteForUser(signedInUser.id) });
    });
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    await submitSignIn();
  }

  async function submitSignUp() {
    setTouched((current) => ({ ...current, name: true, signupEmail: true, signupPassword: true, confirmPassword: true }));
    if (!isSignupValid) return;
    await runAuthOperation("signup", "Creating your account...", async () => {
      const em = emailSchema.parse(email);
      const pw = passwordSchema.parse(password);
      const nm = nameSchema.parse(name);
      const { data, error } = await supabase.auth.signUp({
        email: em,
        password: pw,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { display_name: nm },
        },
      });
      if (error) throw error;
      if (!data.session) {
        setStatusMessage("Confirming your secure session...");
        const { data: signIn, error: siErr } = await supabase.auth.signInWithPassword({
          email: em,
          password: pw,
        });
        if (siErr || !signIn.session) {
          toast.success("Check your email to confirm your account before signing in.");
          setTab("signin");
          return;
        }
        await ensureProfile(signIn.session.user, nm);
      } else {
        setStatusMessage("Setting up your workspace...");
        await ensureProfile(data.session.user, nm);
      }
      toast.success("Account created — welcome to MelaBridge");
      navigate({ to: "/onboarding", search: { type: accountType } });
    });
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    await submitSignUp();
  }

  async function handleGoogle() {
    window.sessionStorage.setItem("melabridge.auth.next", "/events");
    await runAuthOperation("google", "Opening Google sign-in...", async () => {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth/callback",
        extraParams: { prompt: "select_account" },
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      setStatusMessage("Finalizing your secure Google session...");
      const signedInUser = await waitForAuthenticatedUser();
      await ensureProfile(signedInUser);
      toast.success("Signed in with Google");
      navigate({ to: await landingRouteForUser(signedInUser.id) });
    });
  }

  async function handleForgot() {
    setTouched((current) => ({ ...current, signinEmail: true }));
    if (emailError) {
      setAuthError("Enter a valid email address first, then request a reset link.");
      return;
    }
    await runAuthOperation("reset", "Sending your password reset link...", async () => {
      const em = emailSchema.parse(email);
      const { error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent");
    });
  }

  function retryLastOperation() {
    if (lastOperation === "signin") void submitSignIn();
    if (lastOperation === "signup") void submitSignUp();
    if (lastOperation === "google") void handleGoogle();
    if (lastOperation === "reset") void handleForgot();
  }

  return (
    <div className="min-h-screen bg-hero-radial px-4 py-10">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <BrandMark size="lg" />
          <span className="font-display text-xl font-semibold">MelaBridge</span>
        </Link>

        <Card className="border-border/60 p-6 shadow-soft">
          {authError && (
            <Alert variant="destructive" className="mb-5">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sign-in needs attention</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{authError}</p>
                {lastOperation && (
                  <Button type="button" variant="outline" size="sm" onClick={retryLastOperation} disabled={busy}>
                    Try again
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {busy && (
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="grid w-full grid-cols-2 rounded-lg bg-muted p-1" role="tablist" aria-label="Authentication options">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "signin"}
              onClick={() => setTab("signin")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                tab === "signin" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "signup"}
              onClick={() => setTab("signup")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                tab === "signup" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create account
            </button>
          </div>

          {tab === "signin" ? (
            <div className="mt-6" role="tabpanel" aria-label="Sign in">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onBlur={() => setTouched((current) => ({ ...current, signinEmail: true }))}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(touched.signinEmail && emailError)}
                    aria-describedby="signin-email-error"
                    required
                  />
                  {touched.signinEmail && emailError && <FieldError id="signin-email-error">{emailError}</FieldError>}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <button type="button" onClick={handleForgot} className="text-xs text-primary hover:underline">
                      Forgot?
                    </button>
                  </div>
                  <PasswordInput
                    id="signin-password"
                    value={password}
                    onChange={setPassword}
                    visible={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                    autoComplete="current-password"
                    onBlur={() => setTouched((current) => ({ ...current, signinPassword: true }))}
                    invalid={Boolean(touched.signinPassword && password.length === 0)}
                    describedBy="signin-password-error"
                  />
                  {touched.signinPassword && password.length === 0 && <FieldError id="signin-password-error">Password is required</FieldError>}
                </div>
                <Button type="submit" disabled={busy || !isSigninValid} className="w-full">
                  {activeOperation === "signin" ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </div>
          ) : (
            <div className="mt-6" role="tabpanel" aria-label="Create account">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label>I want to…</Label>
                  <div className="grid gap-2">
                    {([
                      { v: "planner", t: "Plan an Event", d: "I'm organizing one or more events." },
                      { v: "vendor", t: "Join as a Vendor", d: "I provide products or services for events." },
                      { v: "guest", t: "Join an Event", d: "I received an invitation to an event." },
                    ] as const).map((opt) => (
                      <label
                        key={opt.v}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
                          accountType === opt.v ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="account-type"
                          value={opt.v}
                          checked={accountType === opt.v}
                          onChange={() => setAccountType(opt.v)}
                          className="mt-1 accent-primary"
                        />
                        <span>
                          <span className="block font-medium">{opt.t}</span>
                          <span className="block text-xs text-muted-foreground">{opt.d}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">Your name</Label>
                  <Input
                    id="signup-name"
                    value={name}
                    onBlur={() => setTouched((current) => ({ ...current, name: true }))}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={Boolean(touched.name && nameError)}
                    aria-describedby="signup-name-error"
                    required
                  />
                  {touched.name && nameError && <FieldError id="signup-name-error">{nameError}</FieldError>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onBlur={() => setTouched((current) => ({ ...current, signupEmail: true }))}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(touched.signupEmail && emailError)}
                    aria-describedby="signup-email-error"
                    required
                  />
                  {touched.signupEmail && emailError && <FieldError id="signup-email-error">{emailError}</FieldError>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <PasswordInput
                    id="signup-password"
                    value={password}
                    onChange={setPassword}
                    visible={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                    autoComplete="new-password"
                    onBlur={() => setTouched((current) => ({ ...current, signupPassword: true }))}
                    invalid={Boolean(touched.signupPassword && passwordError)}
                    describedBy="signup-password-error signup-strength"
                  />
                  {touched.signupPassword && passwordError && <FieldError id="signup-password-error">{passwordError}</FieldError>}
                  <PasswordStrength score={passwordStrength.score} label={passwordStrength.label} active={password.length > 0} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-confirm-password">Confirm password</Label>
                  <PasswordInput
                    id="signup-confirm-password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    visible={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((v) => !v)}
                    autoComplete="new-password"
                    onBlur={() => setTouched((current) => ({ ...current, confirmPassword: true }))}
                    invalid={Boolean(touched.confirmPassword && confirmPasswordError)}
                    describedBy="signup-confirm-password-error"
                  />
                  {touched.confirmPassword && confirmPasswordError && <FieldError id="signup-confirm-password-error">{confirmPasswordError}</FieldError>}
                </div>
                <Button type="submit" disabled={busy || !isSignupValid} className="w-full">
                  {activeOperation === "signup" ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </div>
          )}

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" className="w-full transition hover:-translate-y-0.5 hover:shadow-soft" disabled={busy} onClick={handleGoogle}>
            {activeOperation === "google" ? "Opening Google…" : "Continue with Google"}
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

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-xs text-destructive">
      <AlertCircle className="h-3 w-3" />
      {children}
    </p>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  onBlur,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
  onBlur: () => void;
  invalid: boolean;
  describedBy: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
        className="pr-11"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        required
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function PasswordStrength({ score, label, active }: { score: number; label: string; active: boolean }) {
  const normalized = active ? Math.max(1, score) : 0;
  return (
    <div id="signup-strength" className="space-y-1.5" aria-live="polite">
      <div className="grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`h-1.5 rounded-full transition-colors ${
              normalized >= step
                ? normalized <= 2
                  ? "bg-destructive"
                  : normalized === 3
                  ? "bg-gold"
                  : "bg-primary"
                : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {active && score >= 3 ? <CheckCircle2 className="h-3 w-3 text-primary" /> : null}
        Password strength: {active ? label : "Add at least 8 characters"}
      </p>
    </div>
  );
}
