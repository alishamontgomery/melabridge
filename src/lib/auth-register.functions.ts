import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { externalClerkClient } from "@/lib/clerk-config.server";
import { resolveClerkUserId } from "@/lib/clerk-server-auth";

type Admin = any;

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const BOOTSTRAP_ADMIN_EMAIL = "hello@melabridge.com";
const ProvisionInput = z.object({
  sessionToken: z.string().min(1).max(16_384).optional(),
});
type DbAccountType = "personal" | "organization" | "vendor" | "admin";

export type ProvisionedClerkIdentity = {
  clerkUserId: string;
  userId: string;
  email: string;
  role: DbAccountType;
  onboardingCompleted: boolean;
  created: boolean;
};

async function authenticatedClerkUserId(sessionToken?: string): Promise<string> {
  return resolveClerkUserId(sessionToken);
}

async function findLegacyCandidates(admin: Admin, email: string): Promise<string[]> {
  const authMatches: string[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Unable to audit existing accounts: ${error.message}`);
    const users = data?.users ?? [];
    authMatches.push(
      ...users
        .filter((user: { email?: string }) => user.email && normalizeEmail(user.email) === email)
        .map((user: { id: string }) => user.id),
    );
    if (users.length < 1000) break;
  }

  const profileMatches: Array<{
    id: string;
    account_type?: string | null;
    onboarding_completed?: boolean | null;
  }> = [];
  for (let from = 0; ; from += 1000) {
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, email, account_type, onboarding_completed")
      .ilike("email", email)
      .range(from, from + 999);
    if (error) throw new Error(`Unable to audit existing profiles: ${error.message}`);
    profileMatches.push(
      ...(profiles ?? [])
        .filter((profile: { email?: string }) => profile.email && normalizeEmail(profile.email) === email)
        .map((profile: { id: string; account_type?: string | null; onboarding_completed?: boolean | null }) => ({
          id: profile.id,
          account_type: profile.account_type,
          onboarding_completed: profile.onboarding_completed,
        })),
    );
    if ((profiles ?? []).length < 1000) break;
  }

  const uniqueProfiles = [...new Map(profileMatches.map((profile) => [profile.id, profile])).values()];
  const canonicalAdminProfiles = uniqueProfiles.filter(
    (profile) => profile.account_type === "admin" && profile.onboarding_completed === true,
  );
  if (canonicalAdminProfiles.length === 1) {
    return [canonicalAdminProfiles[0].id];
  }

  const profileIds = uniqueProfiles.map((profile) => profile.id);
  const candidates = [...new Set([...authMatches, ...profileIds])];
  if (candidates.length > 1 || profileIds.some((id) => !authMatches.includes(id))) {
    throw new Error("We found conflicting existing accounts for this email. Please contact support.");
  }
  return candidates;
}

async function clerkUserWasDeleted(clerkUserId: string): Promise<boolean> {
  try {
    await externalClerkClient().users.getUser(clerkUserId);
    return false;
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: unknown }).status
      : undefined;
    const apiErrors = typeof error === "object" && error !== null && "errors" in error
      ? (error as { errors?: unknown }).errors
      : undefined;
    const isNotFound =
      status === 404 ||
      (Array.isArray(apiErrors) &&
        apiErrors.some(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            "code" in item &&
            (item as { code?: unknown }).code === "resource_not_found",
        ));
    if (isNotFound) return true;
    throw new Error("Unable to verify your existing account link. Please try again.");
  }
}

async function insertActiveLink(
  admin: Admin,
  clerkUserId: string,
  legacyUserId: string,
  options: { reassignExisting?: boolean } = {},
) {
  const { data: existingByLegacy, error: existingByLegacyError } = await admin
    .from("clerk_identity_links")
    .select("clerk_user_id,legacy_user_id,status")
    .eq("legacy_user_id", legacyUserId)
    .maybeSingle();
  if (existingByLegacyError) {
    throw new Error(`Unable to check your existing account link: ${existingByLegacyError.message}`);
  }
  if (existingByLegacy) {
    if (existingByLegacy.clerk_user_id === clerkUserId && existingByLegacy.status === "active") return;
    const canReclaimDeletedIdentity =
      existingByLegacy.clerk_user_id !== clerkUserId &&
      (await clerkUserWasDeleted(existingByLegacy.clerk_user_id));
    if (!options.reassignExisting || !canReclaimDeletedIdentity) {
      throw new Error("This MelaBridge profile is already linked to another sign-in.");
    }

    const { error: reassignError } = await admin
      .from("clerk_identity_links")
      .update({
        clerk_user_id: clerkUserId,
        status: "active",
        suspended_at: null,
      })
      .eq("legacy_user_id", legacyUserId);
    if (!reassignError) return;
    throw new Error(`Unable to repair your account link: ${reassignError.message}`);
  }

  const { error } = await admin.from("clerk_identity_links").insert({
    clerk_user_id: clerkUserId,
    legacy_user_id: legacyUserId,
    status: "active",
  });
  if (!error) return;

  // Concurrent callbacks for the same Clerk session are idempotent.
  const { data: established } = await admin
    .from("clerk_identity_links")
    .select("legacy_user_id,status")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (established?.status === "active" && established.legacy_user_id === legacyUserId) return;

  const { data: establishedByLegacy } = await admin
    .from("clerk_identity_links")
    .select("clerk_user_id,status")
    .eq("legacy_user_id", legacyUserId)
    .maybeSingle();
  if (establishedByLegacy?.clerk_user_id === clerkUserId && establishedByLegacy.status === "active") return;
  if (establishedByLegacy && options.reassignExisting) {
    const { error: reassignError } = await admin
      .from("clerk_identity_links")
      .update({
        clerk_user_id: clerkUserId,
        status: "active",
        suspended_at: null,
      })
      .eq("legacy_user_id", legacyUserId);
    if (!reassignError) return;
  }
  throw new Error(`Unable to link your account: ${error.message}`);
}

async function ensureProfileAndRole(
  admin: Admin,
  input: {
    userId: string;
    email: string;
    displayName: string;
    fallbackRole: DbAccountType;
  },
): Promise<{ role: DbAccountType; onboardingCompleted: boolean }> {
  const [{ data: profile, error: profileReadError }, { data: roles, error: rolesReadError }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("email,display_name,account_type,onboarding_completed")
        .eq("id", input.userId)
        .maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", input.userId),
    ]);

  if (profileReadError || rolesReadError) {
    throw new Error("Unable to verify your application profile.");
  }

  const existingRoles = (roles ?? [])
    .map((row: { role?: unknown }) => row.role)
    .filter((role: unknown): role is DbAccountType =>
      role === "personal" || role === "organization" || role === "vendor" || role === "admin",
    );
  const role: DbAccountType = input.fallbackRole === "admin"
    ? "admin"
    : existingRoles.includes("admin")
      ? "admin"
      : profile?.account_type === "personal" ||
          profile?.account_type === "organization" ||
          profile?.account_type === "vendor" ||
          profile?.account_type === "admin"
        ? profile.account_type
        : existingRoles[0] ?? input.fallbackRole;
  const onboardingCompleted = Boolean(profile?.onboarding_completed) || role === "admin";

  if (
    !profile ||
    profile.email !== input.email ||
    profile.account_type !== role ||
    profile.onboarding_completed !== onboardingCompleted
  ) {
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: input.userId,
        email: input.email,
        display_name: profile?.display_name || input.displayName,
        account_type: role,
        onboarding_completed: onboardingCompleted,
      },
      { onConflict: "id" },
    );
    if (profileError) throw new Error(`Unable to provision your profile: ${profileError.message}`);
  }

  const { data: roleRow, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", input.userId)
    .eq("role", role)
    .maybeSingle();
  if (roleError || !roleRow) {
    throw new Error(`Unable to provision your role: ${roleError?.message || "Role assignment did not complete."}`);
  }

  return { role, onboardingCompleted };
}

/**
 * Creates (or finds) the UUID compatibility identity for the signed-in Clerk
 * user. This is deliberately the only place new Supabase auth anchors are made:
 * they have an unguessable unavailable password and are never used to sign in.
 */
export const provisionClerkIdentity = createServerOnlyFn(async (sessionToken?: string): Promise<ProvisionedClerkIdentity> => {
    const clerkUserId = await authenticatedClerkUserId(sessionToken);

    const clerk = externalClerkClient();
    const clerkUser = await clerk.users.getUser(clerkUserId);
    const primary = clerkUser.primaryEmailAddressId
      ? clerkUser.emailAddresses.find((address) => address.id === clerkUser.primaryEmailAddressId)
      : undefined;
    if (!primary || primary.verification?.status !== "verified") {
      throw new Error("Please verify your primary email address before continuing.");
    }

    const email = normalizeEmail(primary.emailAddress);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as Admin;

    const { data: existingLink, error: linkError } = await admin
      .from("clerk_identity_links")
      .select("legacy_user_id, status")
      .eq("clerk_user_id", clerkUser.id)
      .maybeSingle();
    if (linkError) throw new Error(`Unable to check your account identity: ${linkError.message}`);
    if (existingLink?.status === "active" && existingLink.legacy_user_id) {
      const access = await ensureProfileAndRole(admin, {
        userId: existingLink.legacy_user_id,
        email,
        displayName:
          typeof clerkUser.unsafeMetadata?.display_name === "string"
            ? clerkUser.unsafeMetadata.display_name
            : clerkUser.firstName || email.split("@")[0],
        fallbackRole: email === BOOTSTRAP_ADMIN_EMAIL ? "admin" : "personal",
      });
      return {
        clerkUserId: clerkUser.id,
        userId: existingLink.legacy_user_id,
        email,
        created: false,
        ...access,
      };
    }
    if (existingLink) {
      throw new Error("This account identity is not active. Please contact support.");
    }

    const candidates = await findLegacyCandidates(admin, email);
    const restoringExisting = clerkUser.unsafeMetadata?.restore_existing === true;
    if (candidates.length === 1 && restoringExisting) {
      await insertActiveLink(admin, clerkUser.id, candidates[0], {
        reassignExisting: true,
      });
      const access = await ensureProfileAndRole(admin, {
        userId: candidates[0],
        email,
        displayName:
          typeof clerkUser.unsafeMetadata?.display_name === "string"
            ? clerkUser.unsafeMetadata.display_name
            : clerkUser.firstName || email.split("@")[0],
        fallbackRole: email === BOOTSTRAP_ADMIN_EMAIL ? "admin" : "personal",
      });
      return { clerkUserId: clerkUser.id, userId: candidates[0], email, created: false, ...access };
    }

    if (candidates.length === 1 && !restoringExisting) {
      const existingUserId = candidates[0];
      const access = await ensureProfileAndRole(admin, {
        userId: existingUserId,
        email,
        displayName:
          typeof clerkUser.unsafeMetadata?.display_name === "string"
            ? clerkUser.unsafeMetadata.display_name
            : clerkUser.firstName || email.split("@")[0],
        fallbackRole: email === BOOTSTRAP_ADMIN_EMAIL ? "admin" : "personal",
      });
      // A verified email is the safe recovery key for a single existing
      // profile. insertActiveLink only reassigns when any old linked Clerk
      // identity has been confirmed deleted, and is idempotent for the
      // current identity.
      await insertActiveLink(admin, clerkUser.id, existingUserId, {
        reassignExisting: true,
      });
      return {
        clerkUserId: clerkUser.id,
        userId: existingUserId,
        email,
        created: false,
        ...access,
      };
    }

    if (restoringExisting) {
      throw new Error("No existing MelaBridge profile was found for this email. Recovery stopped without creating an account.");
    }

    // Clerk invitations carry the DB role in public metadata. Only accepted
    // existing application roles are honored; arbitrary metadata fails closed.
    const invitedRole = clerkUser.publicMetadata?.invited_role;
    const accountType = clerkUser.unsafeMetadata?.account_type;
    const dbAccountType: DbAccountType = email === BOOTSTRAP_ADMIN_EMAIL
      ? "admin"
      : ["personal", "organization", "vendor", "admin"].includes(invitedRole as string)
        ? invitedRole as "personal" | "organization" | "vendor" | "admin"
        : accountType === "vendor"
          ? "vendor"
          : accountType === "planner" || accountType === "pro_planner"
            ? "organization"
            : "personal";
    const displayName =
      typeof clerkUser.unsafeMetadata?.display_name === "string"
        ? clerkUser.unsafeMetadata.display_name
        : clerkUser.firstName || email.split("@")[0];
    let anchorId: string | undefined;
    try {
      const { data: anchor, error: anchorError } = await admin.auth.admin.createUser({
        email,
        password: randomBytes(48).toString("base64url"),
        email_confirm: true,
        user_metadata: { external_identity_anchor: true },
      });
      if (anchorError || !anchor?.user) {
        // Another callback may have created the same email anchor first.
        const racedCandidates = await findLegacyCandidates(admin, email);
        if (racedCandidates.length === 1) {
          const racedUser = await admin.auth.admin.getUserById(racedCandidates[0]);
          const isFreshApplicationAnchor =
            racedUser.data?.user?.user_metadata?.external_identity_anchor === true;
          if (!restoringExisting && !isFreshApplicationAnchor) {
            throw new Error("An existing MelaBridge profile is associated with this email. Use Restore workspace access to recover it.");
          }
          await insertActiveLink(admin, clerkUser.id, racedCandidates[0], {
            reassignExisting: restoringExisting,
          });
          const access = await ensureProfileAndRole(admin, {
            userId: racedCandidates[0],
            email,
            displayName,
            fallbackRole: dbAccountType,
          });
          return {
            clerkUserId: clerkUser.id,
            userId: racedCandidates[0],
            email,
            created: false,
            ...access,
          };
        }
        throw new Error(anchorError?.message || "Unable to create account anchor.");
      }
      anchorId = anchor.user.id;
      const access = await ensureProfileAndRole(admin, {
        userId: anchor.user.id,
        email,
        displayName,
        fallbackRole: dbAccountType,
      });
      await insertActiveLink(admin, clerkUser.id, anchor.user.id);
      return { clerkUserId: clerkUser.id, userId: anchor.user.id, email, created: true, ...access };
    } catch (error) {
      // Only the new anchor is eligible for cleanup; legacy identities are never touched.
      if (anchorId) await admin.auth.admin.deleteUser(anchorId).catch(() => undefined);
      throw error;
    }
});

export const provisionCurrentClerkIdentity = createServerFn({ method: "POST" })
  .validator((data: unknown) => ProvisionInput.parse(data))
  .handler(async ({ data }) => provisionClerkIdentity(data.sessionToken));