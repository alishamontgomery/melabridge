/**
 * Shared auth helpers — single source of truth for:
 *  - account_type / role mapping (host | pro_planner | vendor | personal → DB values)
 *  - profile provisioning (profiles table only — no client writes to user_roles)
 *  - post-auth routing (landing route + safe intended-path redirect)
 *
 * All helpers are client-safe (no server-only imports).
 */

import { supabase } from "@/integrations/supabase/client";
import { canRoleAccessPath, roleHome } from "@/lib/role-access";
import type { AppRole } from "@/lib/use-role";
import { getToken } from "@clerk/tanstack-react-start";
import { getCurrentClerkIdentity } from "@/lib/clerk-auth.functions";
import type { CompatibleUser } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";

// ─── Type mapping ────────────────────────────────────────────────────────────

/**
 * Maps the fine-grained metadata `account_type` stored at sign-up to the
 * DB-compatible `account_type` written to `profiles.account_type`.
 *
 * DB enum values (app_role): personal | organization | vendor | admin
 *
 *   host        → personal       (personal event host)
 *   pro_planner → organization   (professional planner, same DB role)
 *   vendor      → vendor
 *   organization→ organization   (legacy direct value)
 *   personal    → personal
 *   <anything else> → personal   (safe default)
 */
export function metaToDbAccountType(
  metaAccountType: string | undefined,
): "personal" | "organization" | "vendor" {
  switch (metaAccountType) {
    case "host":
      return "personal";
    case "pro_planner":
    case "organization":
      return "organization";
    case "vendor":
      return "vendor";
    default:
      return "personal";
  }
}

/**
 * Maps the fine-grained metadata `account_type` to the DB role value
 * used in `user_roles.role`.  Returns null when no mapping is needed
 * (the DB trigger `sync_role_from_profile` handles it via the profile upsert).
 *
 * Keeping this here for documentation / future server-side use; the client
 * no longer writes to `user_roles` directly.
 */
export function metaToDbRole(
  metaAccountType: string | undefined,
): "personal" | "organization" | "vendor" | null {
  switch (metaAccountType) {
    case "host":
      return "personal";
    case "pro_planner":
    case "organization":
      return "organization";
    case "vendor":
      return "vendor";
    case "personal":
      return "personal";
    default:
      return null;
  }
}

// ─── Profile provisioning ────────────────────────────────────────────────────

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/**
 * Upsert the `profiles` row for a freshly authenticated user.
 *
 * Intentionally does NOT write to `user_roles` from the client — that table
 * is admin-write-only (RLS: only admins may INSERT/UPDATE/DELETE rows).
 * The `sync_role_from_profile` DB trigger assigns the role when
 * `profiles.account_type` is set.
 *
 * @param user         Authenticated Supabase user
 * @param displayName  Optional override (used right after sign-up when the
 *                     user's display_name hasn't been written to metadata yet)
 */
export async function ensureProfile(user: User, displayName?: string): Promise<void> {
  const fallbackName =
    displayName ||
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "MelaBridge user";

  const metaAccountType = user.user_metadata?.account_type as string | undefined;
  const dbAccountType = metaToDbAccountType(metaAccountType);

  const upsertPayload = {
    id: user.id,
    email: user.email ?? "",
    display_name: fallbackName,
    account_type: dbAccountType,
  };

  let { error } = await supabase.from("profiles").upsert(upsertPayload, { onConflict: "id" });

  if (error) {
    // "JWT issued at future" is a transient clock-skew error — retry once.
    const isClockSkew =
      error.message?.toLowerCase().includes("jwt") ||
      error.message?.toLowerCase().includes("future") ||
      error.code === "PGRST301";
    if (isClockSkew) {
      await wait(1200);
      const { error: retryErr } = await supabase
        .from("profiles")
        .upsert(upsertPayload, { onConflict: "id" });
      error = retryErr;
    }
  }

  if (error) {
    throw new Error(`Your account was created, but workspace setup failed: ${error.message}`);
  }
  // NOTE: user_roles is populated by the sync_role_from_profile DB trigger
  // (fires on INSERT OR UPDATE OF account_type on profiles). No client write needed.
}

// ─── Landing route ───────────────────────────────────────────────────────────

/**
 * Resolves the user's exact role and matching post-login route. Role lookup
 * failures are fatal rather than falling through to Personal.
 */
export async function landingAccessForUser(
  userId: string,
): Promise<{ role: AppRole; route: "/dashboard" | "/vendor" | "/admin" }> {
  const [rolesRes, profileRes, vendorRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("account_type").eq("id", userId).maybeSingle(),
    supabase.from("vendor_profiles").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  if (rolesRes.error || profileRes.error) {
    throw new Error("Unable to verify account access");
  }
  const roles = (rolesRes.data ?? []).map((r) => r.role as string);
  const profileRole = profileRes.data?.account_type as AppRole | undefined;
  const validProfileRole =
    profileRole && ["personal", "organization", "vendor", "admin"].includes(profileRole)
      ? profileRole
      : null;
  const role: AppRole | null = roles.includes("admin")
    ? "admin"
    : validProfileRole
      ? validProfileRole
      : roles.includes("vendor")
        ? "vendor"
        : roles.includes("organization")
          ? "organization"
          : roles.includes("personal")
            ? "personal"
            : vendorRes.data?.id
              ? "vendor"
              : null;
  if (!role) throw new Error("Unable to verify account access");
  return { role, route: roleHome(role) };
}

// ─── Intended-path redirect ───────────────────────────────────────────────────

const NEXT_KEY = "melabridge.auth.next";

/**
 * Saves the current path as the intended destination before redirecting to /auth.
 * Only saves paths that are not /auth itself.
 */
export function saveIntendedPath(pathname: string, search?: string): void {
  try {
    const path = pathname + (search ?? "");
    if (
      path.length <= 2048 &&
      path.startsWith("/") &&
      !path.startsWith("//") &&
      !path.startsWith("/auth")
    ) {
      window.sessionStorage.setItem(NEXT_KEY, path);
    }
  } catch {
    // sessionStorage may be blocked in some contexts — safe to ignore.
  }
}

/**
 * Reads and clears the saved intended path.
 *
 * @param fallback Route to return when no valid intended path is stored.
 * @param role Exact resolved role used to validate the stored route.
 */
export function consumeIntendedPath(fallback: string, role: AppRole): string {
  try {
    const stored = window.sessionStorage.getItem(NEXT_KEY);
    window.sessionStorage.removeItem(NEXT_KEY);
    if (
      stored &&
      stored.startsWith("/") &&
      !stored.startsWith("//") &&
      !stored.startsWith("/auth")
    ) {
      return canRoleAccessPath(role, stored) ? stored : fallback;
    }
  } catch {
    // sessionStorage blocked — return fallback.
  }
  return fallback;
}

// ─── Session polling ──────────────────────────────────────────────────────────

/**
 * Waits up to `maxMs` for Clerk and returns the legacy UUID compatibility
 * shape used by existing profile-routing code. Supabase Auth is never read.
 */
export async function waitForAuthenticatedUser(maxMs = 6000): Promise<CompatibleUser> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (await getToken()) {
      const identity = await getCurrentClerkIdentity();
      const clerkUser = (window as typeof window & {
        Clerk?: {
          user?: {
            primaryEmailAddress?: { emailAddress?: string | null } | null;
            unsafeMetadata?: Record<string, unknown>;
            publicMetadata?: Record<string, unknown>;
          } | null;
        };
      }).Clerk?.user;
      return {
        id: identity.userId,
        email: clerkUser?.primaryEmailAddress?.emailAddress ?? undefined,
        aud: "authenticated",
        created_at: "",
        user_metadata: clerkUser?.unsafeMetadata ?? clerkUser?.publicMetadata ?? {},
        app_metadata: {},
      };
    }
    await new Promise((resolve) => window.setTimeout(resolve, 300));
  }
  throw new Error("We couldn't confirm your Clerk session. Please try again.");
}
