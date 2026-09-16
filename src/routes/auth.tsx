import { BrandMark } from "@/components/brand-logo";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useAuth as useClerkAuth, useClerk } from "@clerk/tanstack-react-start";
import { useSignIn, useSignUp } from "@clerk/tanstack-react-start/legacy";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { saveIntendedPath } from "@/lib/auth-helpers";
import { ProfileTypeChoices } from "@/components/profile-type-choices";
import {
  publicToClerkAccountType,
  type PublicProfileType,
} from "@/lib/profile-types";
import {
  emailSchema,
  NEW_PASSWORD_MINIMUM,
  newPasswordSchema,
  type SignupField,
  type SignupFieldErrors,
  validateSignupFields,
} from "@/lib/auth-form-validation";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({
    type: z.enum(["vendor", "planner", "host"]).optional(),
    intent: z.enum(["signin", "signup", "restore"]).optional(),
    next: z.string().optional(),
    billing: z.enum(["monthly", "annual"]).optional(),
    token: z.string().min(1).max(4096).optional(),
  }).parse,
  component: AuthRoute,
});
const signInPasswordSchema = z.string().min(1).max(128);
const AUTH_OPERATION_TIMEOUT_MS = 30_000;
type AccountType = PublicProfileType;

function AuthRoute() { const location = useLocation(); return location.pathname === "/auth/callback" ? <Outlet /> : <AuthPage />; }
function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Unable to complete that request.");
  const details = error as {
    errors?: Array<{ code?: unknown; message?: unknown; long_message?: unknown }>;
  };
  const clerkError = details?.errors?.[0];
  const code = typeof clerkError?.code === "string" ? clerkError.code : "";
  const clerkMessage = [clerkError?.long_message, clerkError?.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const detail = `${code} ${clerkMessage} ${message}`;
  if (/captcha|turnstile|bot.?protection|human verification/i.test(detail)) {
    return "We couldn't complete the security check. Refresh the page and try again.";
  }
  if (/timed out|did not respond|timeout/i.test(detail)) {
    return "We couldn't finish that request. Refresh the page and try again.";
  }
  if (/failed to fetch|network|infinite redirect loop|instance keys|frontend api|configuration/i.test(detail)) {
    return "Authentication could not connect to Clerk. Refresh the page and try again.";
  }
  if (/password.*(pwn|breach|comprom|hibp)|compromised|breached|pwned/i.test(detail)) {
    return "That password has appeared in a data breach. Choose a new password that you do not use on another site.";
  }
  if (/password.*(length|short)|form_password_length/i.test(detail)) {
    return `New passwords must be at least ${NEW_PASSWORD_MINIMUM} characters long.`;
  }
  if (/form_password_incorrect|incorrect password|password.*(doesn't|does not) match|invalid password/i.test(detail)) {
    return "We couldn't sign you in. Check your email and password or reset your password.";
  }
  if (/form_identifier_exists|already exists|already registered|email.*(taken|in use)/i.test(detail)) {
    return "An account already exists for this email. Use Sign in or Forgot password instead.";
  }
  if (/verification|code/i.test(detail)) return "That code is invalid or expired. Request a new code and try again.";
  if (/form_identifier_not_found|identifier|email|user/i.test(detail)) {
    return "We couldn't sign you in. Check your email and password or create an account.";
  }
  if (/password/i.test(detail)) {
    return "Clerk rejected that password. Try a unique password and try again.";
  }
  return "We couldn't complete that request. Please try again.";
}

async function activateSessionAndContinue(
  setActive: (options: { session: string }) => Promise<void>,
  sessionId: string,
) {
  await setActive({ session: sessionId });
  // setActive is Clerk's supported browser session handoff. The callback
  // waits for the provider's isLoaded/isSignedIn state before provisioning.
  window.location.replace("/auth/callback");
}

function AuthPage() {
  const search = Route.useSearch();
  const restoringExisting = search.intent === "restore";
  const { isLoaded: clerkLoaded, isSignedIn } = useClerkAuth();
  const { isLoaded: signInLoaded, signIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const { setActive, signOut } = useClerk();
  const [tab, setTab] = useState<"signin" | "signup">(
    search.intent === "signup" || search.intent === "restore" || !!search.type ? "signup" : "signin",
  );
  const [email, setEmail] = useState(restoringExisting ? "hello@melabridge.com" : ""); const [password, setPassword] = useState(""); const [name, setName] = useState(restoringExisting ? "Alisha Ford" : "");
  const [accountType, setAccountType] = useState<AccountType | null>(search.type ?? (restoringExisting ? "host" : null));
  const [selectionConfirmed, setSelectionConfirmed] = useState(restoringExisting);
  const [code, setCode] = useState(""); const [stage, setStage] = useState<"form" | "verify-signup" | "verify-signin" | "reset-code">("form");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const ready = signInLoaded && signUpLoaded;
  const ticketConsumed = useRef(false);
  function clearAuthError() {
    setError(null);
  }
  function clearFieldError(field: SignupField) {
    setFieldErrors((current) => current[field] ? { ...current, [field]: undefined } : current);
  }
  useEffect(() => {
    if (search.next) saveIntendedPath(search.next);
  }, [search.next]);
  useEffect(() => {
    // TanStack navigation can preserve this component, and Safari can restore
    // it from the back-forward cache. Do not carry a failed auth message into
    // a fresh auth view or a different requested auth mode.
    clearAuthError();
    setFieldErrors({});
    setStage("form");
    setCode("");
    if (search.intent === "signup" || search.intent === "restore" || search.type) setTab("signup");
    else if (search.intent === "signin") setTab("signin");
    if (search.type && !restoringExisting) {
      setAccountType(search.type);
      setSelectionConfirmed(false);
    } else if (search.intent === "restore") {
      setEmail("hello@melabridge.com");
      setName("Alisha Ford");
      setAccountType("host");
      setSelectionConfirmed(true);
    } else if (search.intent === "signin") {
      setAccountType(null);
      setSelectionConfirmed(false);
    }
  }, [search.intent, search.type]);
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) clearAuthError();
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);
  const execute = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    clearAuthError();
    let timeoutId: number | undefined;
    try {
      await Promise.race([
        action(),
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error("Authentication request timed out while waiting for Clerk.")),
            AUTH_OPERATION_TIMEOUT_MS,
          );
        }),
      ]);
      clearAuthError();
    } catch (e) {
      const rawMessage = e instanceof Error ? e.message : String(e || "");
      const notFound = /couldn't find your account|account.*not found|identifier.*not found/i.test(rawMessage);
      setError(
        notFound
          ? "We couldn't sign you in. Check your email and password or create an account."
          : errorMessage(e),
      );
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (!search.token || !ready || !signIn || !setActive || ticketConsumed.current) return;
    ticketConsumed.current = true;
    void execute(async () => {
      window.sessionStorage.removeItem("melabridge.auth.callback_attempts");
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      const result = await signIn.create({ strategy: "ticket", ticket: search.token });
      if (result.status !== "complete" || !result.createdSessionId) {
        throw new Error("This sign-in ticket is no longer valid.");
      }
      await activateSessionAndContinue(setActive, result.createdSessionId);
    });
  }, [execute, ready, search.token, setActive, signIn]);
  async function submitSignIn(e: FormEvent) {
    e.preventDefault();
    if (!emailSchema.safeParse(email).success || !signInPasswordSchema.safeParse(password).success) return;
    if (!signIn || !setActive) {
      setError("Sign-in is still loading. Please try again in a moment.");
      return;
    }
    await execute(async () => {
    window.sessionStorage.removeItem("melabridge.auth.callback_attempts");
    if (isSignedIn) { window.location.replace("/auth/callback"); return; }
    const result = await signIn.create({ identifier: email.trim(), password });
    if (result.status === "needs_client_trust") {
      const factor = result.supportedSecondFactors?.find(
        (item) => item.strategy === "email_code" && "emailAddressId" in item,
      );
      if (!factor || !("emailAddressId" in factor)) {
        throw new Error("This sign-in requires a verification method that is not available.");
      }
      await signIn.prepareSecondFactor({
        strategy: "email_code",
        emailAddressId: factor.emailAddressId,
      });
      setCode("");
      setStage("verify-signin");
      return;
    }
    if (result.status !== "complete" || !result.createdSessionId) {
      throw new Error("This sign-in requires another verification step that is not available.");
    }
    await activateSessionAndContinue(setActive, result.createdSessionId);
    });
  }
  async function submitSignUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    // Read the native form controls at submit time. Safari and password
    // managers can visibly fill controlled inputs without firing React's
    // onChange, leaving the state values stale.
    const formData = new FormData(e.currentTarget);
    const submittedName = restoringExisting
      ? name.trim()
      : String(formData.get("name") ?? "").trim();
    const submittedEmail = String(formData.get("email") ?? "").trim();
    const submittedPassword = String(formData.get("password") ?? "");

    setName(submittedName);
    setEmail(submittedEmail);
    setPassword(submittedPassword);

    const nextFieldErrors = validateSignupFields({
      name: submittedName,
      email: submittedEmail,
      password: submittedPassword,
    });
    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }
    if (!accountType || !selectionConfirmed) {
      setError("Choose and confirm a profile type before creating your account.");
      return;
    }
    if (!signUp) {
      setError("Signup is still loading. Please try again in a moment.");
      return;
    }

    await execute(async () => {
      window.sessionStorage.removeItem("melabridge.auth.callback_attempts");
      if (isSignedIn) { window.location.replace("/auth/callback"); return; }
      const type = publicToClerkAccountType(accountType);
      await signUp.create({
        emailAddress: submittedEmail,
        password: submittedPassword,
        unsafeMetadata: {
          display_name: submittedName,
          account_type: type,
          ...(restoringExisting ? { restore_existing: true } : {}),
        },
      });
      setFieldErrors({});
      setError(null);
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStage("verify-signup");
    });
  }
  async function verifySignup(e: FormEvent) { e.preventDefault(); if (!signUp || !setActive || !code) return; await execute(async () => {
    const result = await signUp.attemptEmailAddressVerification({ code });
    if (result.status !== "complete" || !result.createdSessionId) throw new Error("Email verification is not complete yet.");
      await activateSessionAndContinue(setActive, result.createdSessionId);
  }); }
  async function verifySignIn(e: FormEvent) { e.preventDefault(); if (!signIn || !setActive || !code) return; await execute(async () => {
    const result = await signIn.attemptSecondFactor({ strategy: "email_code", code });
    if (result.status !== "complete" || !result.createdSessionId) throw new Error("Sign-in verification is not complete yet.");
    await activateSessionAndContinue(setActive, result.createdSessionId);
  }); }
  async function resend() { await execute(async () => {
    if (stage === "verify-signin") {
      if (!signIn) throw new Error("Sign-in verification is unavailable.");
      const factor = signIn.supportedSecondFactors?.find(
        (item) => item.strategy === "email_code" && "emailAddressId" in item,
      );
      if (!factor || !("emailAddressId" in factor)) throw new Error("Email verification is unavailable.");
      await signIn.prepareSecondFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
      return;
    }
    if (!signUp) throw new Error("Email verification is unavailable.");
    await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
  }); }
  async function forgot() { if (!signIn || !emailSchema.safeParse(email).success) { clearAuthError(); setError("Enter your email address first."); return; } await execute(async () => {
    const attempt = await signIn.create({ identifier: email.trim() });
    const factor = attempt.supportedFirstFactors?.find(
      (item) => item.strategy === "reset_password_email_code",
    );
    if (!factor || !("emailAddressId" in factor)) throw new Error("Password reset is unavailable for this account.");
    await signIn.prepareFirstFactor({ strategy: "reset_password_email_code", emailAddressId: factor.emailAddressId }); setStage("reset-code");
  }); }
  async function reset(e: FormEvent) { e.preventDefault(); if (!signIn || !setActive || !code || !newPasswordSchema.safeParse(password).success) return; await execute(async () => {
    const result = await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code, password });
    if (result.status !== "complete" || !result.createdSessionId) throw new Error("Password reset is not complete yet.");
     await activateSessionAndContinue(setActive, result.createdSessionId);
  }); }
  async function signInWithGoogle() {
    if (!signIn) {
      setError("Sign-in is still loading. Please try again in a moment.");
      return;
    }
    await execute(async () => {
      window.sessionStorage.removeItem("melabridge.auth.callback_attempts");
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/auth/callback",
        redirectUrlComplete: "/auth/callback",
      });
    });
  }
  const verification = stage === "verify-signup" || stage === "verify-signin" || stage === "reset-code";
  if (clerkLoaded && isSignedIn) {
    return <div className="min-h-screen bg-hero-radial px-4 py-10"><div className="mx-auto max-w-md"><Link to="/" className="mb-8 flex items-center justify-center gap-2"><BrandMark size="lg" /><span className="font-display text-xl font-semibold">MelaBridge</span></Link><Card className="space-y-4 p-6 text-center shadow-soft"><h1 className="font-display text-xl font-semibold">You’re already signed in</h1><p className="text-sm text-muted-foreground">Continue to your workspace, or reset this browser session if sign-in is not finishing.</p><Button className="w-full" onClick={() => window.location.replace("/auth/callback")}>Continue</Button><Button variant="outline" className="w-full" onClick={() => void execute(async () => { window.sessionStorage.removeItem("melabridge.auth.callback_attempts"); await signOut({ redirectUrl: "/auth" }); })}>{busy ? <Loader2 className="animate-spin" /> : "Reset browser session"}</Button></Card></div></div>;
  }
  return <div className="min-h-screen bg-hero-radial px-4 py-10"><div className="mx-auto max-w-md"><Link to="/" className="mb-8 flex items-center justify-center gap-2"><BrandMark size="lg" /><span className="font-display text-xl font-semibold">MelaBridge</span></Link><Card className="p-6 shadow-soft">
       {error && <div role="alert" className="mb-5 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground">{error}</div>}
       {verification ? <form onSubmit={stage === "verify-signup" ? verifySignup : stage === "verify-signin" ? verifySignIn : reset} className="space-y-4"><div><h1 className="font-display text-xl font-semibold">{stage === "verify-signup" ? "Verify your email" : stage === "verify-signin" ? "Verify this sign-in" : "Reset your password"}</h1><p className="mt-1 text-sm text-muted-foreground">Enter the code Clerk sent to {email}.</p></div><div><Label htmlFor="code">Email code</Label><Input id="code" value={code} onChange={e => { setCode(e.target.value); clearAuthError(); }} autoComplete="one-time-code" required /></div>{stage === "reset-code" && <div><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" value={password} onChange={e => { setPassword(e.target.value); clearAuthError(); }} autoComplete="new-password" minLength={NEW_PASSWORD_MINIMUM} required /><p className="mt-1 text-xs text-muted-foreground">Use at least {NEW_PASSWORD_MINIMUM} characters. Avoid a password you use on another site.</p></div>}<Button className="w-full" disabled={busy || !ready}>{busy ? <Loader2 className="animate-spin" /> : "Continue"}</Button>{(stage === "verify-signup" || stage === "verify-signin") && <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={resend}>Resend code</Button>}</form> :
        <>{restoringExisting && <Alert className="mb-5 border-primary/30 bg-primary/5"><CheckCircle2 className="h-4 w-4 text-primary" /><AlertTitle>Restore your existing workspace</AlertTitle><AlertDescription>Enter the email associated with your MelaBridge profile. We'll verify it before continuing.</AlertDescription></Alert>}{!restoringExisting && <div className="grid grid-cols-2 rounded-lg bg-muted p-1"><button type="button" onClick={() => { setTab("signin"); setStage("form"); setCode(""); clearAuthError(); }} className={tab === "signin" ? "rounded bg-background py-2 shadow" : "py-2"}>Sign in</button><button type="button" onClick={() => { setTab("signup"); setStage("form"); setCode(""); clearAuthError(); }} className={tab === "signup" ? "rounded bg-background py-2 shadow" : "py-2"}>Create account</button></div>}
          {!restoringExisting && tab === "signin" ? <form onSubmit={submitSignIn} className="mt-6 space-y-4"><div><Label htmlFor="signin-email">Email</Label><Input id="signin-email" type="email" value={email} onChange={e => { setEmail(e.target.value); clearAuthError(); }} autoComplete="username" required /></div><div><div className="flex justify-between"><Label htmlFor="signin-password">Password</Label><button type="button" className="text-xs text-primary" onClick={forgot}>Forgot?</button></div><Input id="signin-password" type="password" value={password} onChange={e => { setPassword(e.target.value); clearAuthError(); }} autoComplete="current-password" required /></div><Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button><Button type="button" variant="outline" className="w-full" disabled={busy || !ready} onClick={() => void signInWithGoogle()}>Continue with Google</Button></form> :
       <form onSubmit={submitSignUp} className="mt-6 space-y-4">
          {!restoringExisting && <fieldset>
           <legend className="text-sm font-medium">What brings you to MelaBridge?</legend>
           <p className="mt-1 text-xs text-muted-foreground">Choose the experience that best matches how you plan to use MelaBridge.</p>
           <div className="mt-3">
             <ProfileTypeChoices
               value={accountType}
                  onChange={(value) => { setAccountType(value); setSelectionConfirmed(false); clearAuthError(); }}
               disabled={busy}
             />
           </div>
          </fieldset>}
         {accountType && !selectionConfirmed && (
           <Alert className="border-primary/30 bg-primary/5">
             <CheckCircle2 className="h-4 w-4 text-primary" />
             <AlertTitle>Confirm your profile choice</AlertTitle>
             <AlertDescription className="space-y-3">
                <p>
                 {accountType === "host"
                   ? "You’re creating a Host workspace for events you’re organizing yourself."
                    : accountType === "planner"
                      ? "You’re creating a professional planner business profile for events you manage for paying clients."
                      : "You’re creating a professional event-services business profile for the services you provide."}
               </p>
               <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => { setSelectionConfirmed(true); clearAuthError(); }}>
                    Use this profile
                 </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setAccountType(null); setSelectionConfirmed(false); clearAuthError(); }}>
                    Choose a different profile
                 </Button>
               </div>
             </AlertDescription>
           </Alert>
         )}
          {selectionConfirmed && (
           <>
              {!restoringExisting && <div>
               <Label htmlFor="signup-name">Your name</Label>
                <Input id="signup-name" name="name" value={name} onChange={e => { setName(e.target.value); clearFieldError("name"); clearAuthError(); }} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "signup-name-error" : undefined} required />
                <p className="mt-1 text-xs text-muted-foreground">Professional planners and event vendors can use their own name or business name.</p>
                 {fieldErrors.name && <p id="signup-name-error" role="alert" className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>}
              </div>}
               {restoringExisting && <p className="text-sm text-muted-foreground">Create a new secure password to continue. Your existing workspace data remains unchanged.</p>}
                 <div><Label htmlFor="signup-email">Email</Label><Input id="signup-email" name="email" type="email" value={email} onChange={e => { setEmail(e.target.value); clearFieldError("email"); clearAuthError(); }} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "signup-email-error" : undefined} autoComplete="email" required />{fieldErrors.email && <p id="signup-email-error" role="alert" className="mt-1 text-xs text-destructive">{fieldErrors.email}</p>}</div>
                  <div><Label htmlFor="signup-password">{restoringExisting ? "New password" : "Password"}</Label><Input id="signup-password" name="password" type="password" value={password} onChange={e => { setPassword(e.target.value); clearFieldError("password"); clearAuthError(); }} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "signup-password-error" : undefined} autoComplete="new-password" minLength={NEW_PASSWORD_MINIMUM} required /><p className="mt-1 text-xs text-muted-foreground">Use at least {NEW_PASSWORD_MINIMUM} characters. Avoid a password you use on another site.</p>{fieldErrors.password && <p id="signup-password-error" role="alert" className="mt-1 text-xs text-destructive">{fieldErrors.password}</p>}</div>
             <div id="clerk-captcha" />
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating account…" : restoringExisting ? "Restore workspace access" : "Create account"}</Button>
           </>
         )}
       </form>}
     </>}
  </Card></div></div>;
}