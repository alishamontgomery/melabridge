import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export type SmokeRole = "host" | "planner" | "vendor" | "admin";

export type SmokeAccount = {
  role: SmokeRole;
  email: string;
  password: string;
  initialPath: string;
  completedPath: string;
};

export type SmokeConfig = {
  accounts: Record<SmokeRole, SmokeAccount>;
  ticketEventId: string;
  paidSessionId: string;
  paidAccessToken: string;
  stripeEnvironment: "sandbox" | "live";
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `[e2e] Missing ${name}. The launch gate needs pre-verified Clerk test users and a real sandbox payment session; see e2e/README.md.`,
    );
  }
  return value;
}

function account(role: SmokeRole): SmokeAccount {
  const upper = role.toUpperCase();
  const password = process.env[`E2E_${upper}_PASSWORD`]?.trim() || required("E2E_TEST_PASSWORD");
  return {
    role,
    email: required(`E2E_${upper}_EMAIL`),
    password,
    initialPath:
      role === "admin" ? "/admin" : role === "vendor" ? "/vendor" : `/onboarding?type=${role}`,
    completedPath: role === "vendor" ? "/vendor" : role === "admin" ? "/admin" : "/dashboard",
  };
}

export function smokeConfig(): SmokeConfig {
  const stripeEnvironment = (process.env.E2E_STRIPE_ENVIRONMENT || "sandbox").trim();
  if (stripeEnvironment !== "sandbox" && stripeEnvironment !== "live") {
    throw new Error("[e2e] E2E_STRIPE_ENVIRONMENT must be sandbox or live.");
  }
  return {
    accounts: {
      host: account("host"),
      planner: account("planner"),
      vendor: account("vendor"),
      admin: account("admin"),
    },
    ticketEventId: required("E2E_TICKET_EVENT_ID"),
    paidSessionId: required("E2E_PAID_SESSION_ID"),
    paidAccessToken: required("E2E_PAID_ACCESS_TOKEN"),
    stripeEnvironment,
  };
}

export async function signIn(page: Page, accountToUse: SmokeAccount): Promise<void> {
  await page.goto("/auth?intent=signin");
  await page.locator("#signin-email").fill(accountToUse.email);
  await page.locator("#signin-password").fill(accountToUse.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 45_000 });
}

export async function resetOnboarding(role: SmokeRole): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.service_role;
  if (!supabaseUrl || !serviceRole) throw new Error("[e2e] Supabase service configuration is missing.");
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = smokeConfig().accounts[role].email;
  const { data: profile, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (lookupError || !profile) throw new Error(`[e2e] Could not reset ${role} onboarding state.`);
  const { error } = await admin
    .from("profiles")
    .update({ onboarding_completed: false })
    .eq("id", profile.id);
  if (error) throw new Error(`[e2e] Could not reset ${role} onboarding state: ${error.message}`);
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/auth(?:$|\?)/, { timeout: 30_000 });
}
