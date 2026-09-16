import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { legacyUserIdForClerkUser } from "@/lib/clerk-identity.server";
import { externalClerkClient } from "@/lib/clerk-config.server";
import { collectAdminUserPages } from "@/lib/admin-users-pagination";

export type AdminUserRow = {
  id: string; email: string | null; display_name: string | null; first_name: string | null;
  last_name: string | null; account_type: string | null; roles: string[];
  onboarding_completed: boolean | null; created_at: string | null; last_sign_in_at: string | null;
  banned_until: string | null; email_confirmed_at: string | null; invited_at: string | null;
};

type Role = "personal" | "organization" | "vendor" | "admin";

type AdminUserStatus = "all" | "active" | "suspended" | "pending";
type Admin = any;
const roles = new Set<Role>(["personal", "organization", "vendor", "admin"]);
const iso = (value: number | null | undefined) => value ? new Date(value).toISOString() : null;
const sanitizeRoleError = (message: string | null | undefined) =>
  /\bthe last remaining admin account\.?$/i.test((message ?? "").trim())
    ? (message ?? "") : "Could not update the user's role. Please try again.";

async function adminContext() {
  const session = await auth();
  if (!session.userId) throw new Error("Unauthorized");
  const userId = await legacyUserIdForClerkUser(session.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as Admin;
  const { data, error } = await admin.from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error || !data) throw new Error("Forbidden");
  return { userId, clerkUserId: session.userId, admin };
}

async function clerkIdForLegacyUser(admin: Admin, userId: string) {
  const { data, error } = await admin.from("clerk_identity_links").select("clerk_user_id")
    .eq("legacy_user_id", userId).eq("status", "active").maybeSingle();
  if (error || !data?.clerk_user_id) throw new Error("The selected account has no active Clerk identity.");
  return data.clerk_user_id as string;
}

async function rolesForUser(admin: Admin, userId: string): Promise<string[]> {
  const { data, error } = await admin.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Could not read the user's role.");
  return (data ?? []).map((row: any) => row.role);
}

export const listAdminUsers = createServerFn({ method: "POST" })
  .validator((data: ListAdminUsersInput | undefined) => data ?? {})
  .handler(async ({ data }) => {
  let ctx: Awaited<ReturnType<typeof adminContext>>;
  try { ctx = await adminContext(); } catch { return { error: "Forbidden" } as const; }
  const search = data.search?.trim().slice(0, 200) ?? "";
  const roleFilter = data.role && data.role !== "all" && roles.has(data.role) ? data.role : null;
  const statusFilter: AdminUserStatus = data.status ?? "all";
  if (!["all", "active", "suspended", "pending"].includes(statusFilter)) {
    return { error: "Invalid status filter." } as const;
  }

  const [{ count: total, error: countError }, roleResult, linkResult] = await Promise.all([
    ctx.admin.from("profiles").select("id", { count: "exact", head: true }),
    collectAdminUserPages<any>((from, to) =>
      ctx.admin.from("user_roles").select("user_id,role")
        .order("user_id", { ascending: true }).order("role", { ascending: true }).range(from, to)
    ),
    collectAdminUserPages<any>((from, to) =>
      ctx.admin.from("clerk_identity_links").select("legacy_user_id,clerk_user_id,status")
        .order("legacy_user_id", { ascending: true }).order("clerk_user_id", { ascending: true }).range(from, to)
    ),
  ]);
  if (countError || roleResult.error || linkResult.error) return { error: "Could not load users." } as const;
  const roleRows = roleResult.data;
  const links = linkResult.data;

  const rolesByUser = new Map<string, string[]>();
  for (const row of roleRows ?? []) rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) ?? []), row.role]);
  const matchingRoleIds = roleFilter
    ? new Set((roleRows ?? []).filter((row: any) => row.role === roleFilter).map((row: any) => row.user_id))
    : null;

  const profileResult = await collectAdminUserPages<any>(async (from, to) => {
    let profilesQuery = ctx.admin.from("profiles")
      .select("id,email,display_name,account_type,onboarding_completed,created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    if (search) {
      const quotedSearch = search.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      profilesQuery = profilesQuery.or(`email.ilike."%${quotedSearch}%",display_name.ilike."%${quotedSearch}%"`);
    }
    return profilesQuery.range(from, to);
  });
  if (profileResult.error) return { error: "Could not load users." } as const;
  const profiles = profileResult.data.filter((profile: any) => {
    if (!matchingRoleIds) return true;
    return matchingRoleIds.has(profile.id) || (profile.account_type === roleFilter && !(rolesByUser.get(profile.id)?.length));
  });
  const clerkIdByLegacy = new Map<string, string>();
  const linkStatusByLegacy = new Map<string, string>();
  for (const link of links ?? []) {
    clerkIdByLegacy.set(link.legacy_user_id, link.clerk_user_id);
    linkStatusByLegacy.set(link.legacy_user_id, link.status);
  }
  const clerkUsers = new Map<string, any>();
  const invitationsByEmail = new Map<string, any>();
  const client = externalClerkClient();
  const clerkIds = [...new Set([...clerkIdByLegacy.values()])];
  for (let i = 0; i < clerkIds.length; i += 100) {
    const result = await client.users.getUserList({ userId: clerkIds.slice(i, i + 100), limit: 100 });
    for (const user of result.data) clerkUsers.set(user.id, user);
  }
  // Invitations do not create a user until accepted, so read them separately
  // to retain a meaningful Pending/invited status for linked profiles.
  for (let offset = 0; ; offset += 100) {
    const result = await client.invitations.getInvitationList({ limit: 100, offset });
    for (const invitation of result.data) {
      invitationsByEmail.set(invitation.emailAddress.toLowerCase(), invitation);
    }
    if (result.data.length < 100) break;
  }
  const users: AdminUserRow[] = profiles.map((profile) => {
    const linkedClerkId = clerkIdByLegacy.get(profile.id);
    const user = linkedClerkId ? clerkUsers.get(linkedClerkId) : undefined;
    const primaryAddress = user?.primaryEmailAddressId
      ? user.emailAddresses.find((address: any) => address.id === user.primaryEmailAddressId)
      : undefined;
    const email = primaryAddress?.emailAddress;
    const linkSuspended = linkStatusByLegacy.get(profile.id) === "suspended";
    return {
      id: profile.id, email: profile.email ?? email ?? null, display_name: profile.display_name ?? null,
      first_name: user?.firstName ?? null, last_name: user?.lastName ?? null, account_type: profile.account_type ?? null,
      roles: rolesByUser.get(profile.id) ?? [], onboarding_completed: profile.onboarding_completed ?? null,
      created_at: profile.created_at ?? iso(user?.createdAt), last_sign_in_at: iso(user?.lastSignInAt),
      banned_until: user?.banned || linkSuspended ? "9999-12-31T23:59:59.999Z" : null,
      email_confirmed_at: primaryAddress?.verification?.status === "verified" ? iso(user.updatedAt) : null,
      invited_at: profile.email ? iso(invitationsByEmail.get(profile.email.toLowerCase())?.createdAt) : null,
    };
  }).filter((user) => {
    if (statusFilter === "all") return true;
    const suspended = !!user.banned_until && new Date(user.banned_until) > new Date();
    const verified = !!user.email_confirmed_at;
    if (statusFilter === "active") return !suspended && verified;
    if (statusFilter === "suspended") return suspended;
    return !verified && !suspended;
  });
  return { users, total: total ?? 0, filteredTotal: users.length };
});

export const setUserRole = createServerFn({ method: "POST" }).validator((d: { userId: string; role: Role }) => d)
  .handler(async ({ data }) => {
    if (!roles.has(data.role)) return { ok: false, error: "Invalid role." };
    try {
      const { admin } = await adminContext();
      const { error } = await admin.rpc("replace_user_primary_role", { _user_id: data.userId, _new_role: data.role });
      return error ? { ok: false, error: sanitizeRoleError(error.message) } : { ok: true };
    } catch { return { ok: false, error: "Forbidden" }; }
  });

export const setUserBanned = createServerFn({ method: "POST" }).validator((d: { userId: string; suspend: boolean }) => d)
  .handler(async ({ data }) => {
    try {
      const ctx = await adminContext();
      if (data.suspend && ctx.userId === data.userId) return { ok: false, error: "You cannot suspend your own account." };
      const clerkId = await clerkIdForLegacyUser(ctx.admin, data.userId);
      if (data.suspend) await externalClerkClient().users.banUser(clerkId); else await externalClerkClient().users.unbanUser(clerkId);
      return { ok: true };
    } catch (error) { return { ok: false, error: error instanceof Error && error.message === "Forbidden" ? "Forbidden" : "Could not update the account status. Please try again." }; }
  });

export const inviteAdminUser = createServerFn({ method: "POST" })
  .validator((d: { email: string; role: Role; message?: string }) => d).handler(async ({ data }) => {
    try {
      await adminContext();
      if (!roles.has(data.role) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return { ok: false, error: "Invalid email" };
       const siteUrl = (process.env.SITE_URL ?? "https://melabridge.com").replace(/\/$/, "");
       await externalClerkClient().invitations.createInvitation({
         emailAddress: data.email.trim().toLowerCase(), redirectUrl: `${siteUrl}/auth`,
        publicMetadata: { invited_role: data.role, invite_message: data.message?.trim() || null },
      });
      return { ok: true, userId: null };
    } catch (error) { return { ok: false, error: error instanceof Error && error.message === "Forbidden" ? "Forbidden" : "Could not send the Clerk invitation. Please try again." }; }
  });

export const deleteAdminUser = createServerFn({ method: "POST" }).validator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    try {
      const ctx = await adminContext();
      if (ctx.userId === data.userId) return { ok: false, error: "You cannot delete your own account while signed in." };
      const { error: guardError } = await ctx.admin.rpc("assert_admin_deletable", { _user_id: data.userId });
      if (guardError) return { ok: false, error: sanitizeRoleError(guardError.message) === guardError.message ? guardError.message : "Cannot delete the last remaining admin account." };
      const clerkId = await clerkIdForLegacyUser(ctx.admin, data.userId);
      await externalClerkClient().users.deleteUser(clerkId);
      const { error } = await ctx.admin.from("clerk_identity_links").update({ status: "suspended" })
        .eq("legacy_user_id", data.userId).eq("clerk_user_id", clerkId);
      if (error) return { ok: false, error: "Clerk identity was removed, but its application link could not be suspended. Contact support." };
      return { ok: true };
    } catch (error) { return { ok: false, error: error instanceof Error && error.message === "Forbidden" ? "Forbidden" : "Could not delete the Clerk identity. Please try again." }; }
  });

export const resetAdminUserPassword = createServerFn({ method: "POST" }).validator((d: { email: string }) => d)
  .handler(async () => {
    try { await adminContext(); return { ok: false, error: "Clerk does not support admin-triggered password resets. Ask the user to use Forgot password on the sign-in page." }; }
    catch { return { ok: false, error: "Forbidden" }; }
  });

export const resendAdminUserVerification = createServerFn({ method: "POST" })
  .validator((d: { userId: string; email: string }) => d).handler(async ({ data }) => {
    try {
      const ctx = await adminContext();
      const userRoles = await rolesForUser(ctx.admin, data.userId);
      const role = (userRoles.find((value) => roles.has(value as Role)) ?? "personal") as Role;
      const siteUrl = (process.env.SITE_URL ?? "https://melabridge.com").replace(/\/$/, "");
      await externalClerkClient().invitations.createInvitation({ emailAddress: data.email, ignoreExisting: true, redirectUrl: `${siteUrl}/auth`, publicMetadata: { invited_role: role } });
      return { ok: true };
    } catch (error) { return { ok: false, error: error instanceof Error && error.message === "Forbidden" ? "Forbidden" : "Could not resend the Clerk invitation. Please try again." }; }
  });

export const updateAdminUser = createServerFn({ method: "POST" }).validator((d: {
  userId: string; first_name?: string | null; last_name?: string | null; display_name?: string | null; role?: Role | null; suspend?: boolean | null;
}) => d).handler(async ({ data }) => {
  try {
    const ctx = await adminContext();
    if (data.suspend && ctx.userId === data.userId) return { ok: false, error: "You cannot suspend your own account." };
    const clerkId = await clerkIdForLegacyUser(ctx.admin, data.userId);
    if (data.display_name !== undefined) {
      const { error } = await ctx.admin.from("profiles").update({ display_name: data.display_name }).eq("id", data.userId);
      if (error) return { ok: false, error: "Could not update the user profile. Please try again." };
    }
    if (data.first_name !== undefined || data.last_name !== undefined) await externalClerkClient().users.updateUser(clerkId, {
      ...(data.first_name !== undefined ? { firstName: data.first_name ?? "" } : {}),
      ...(data.last_name !== undefined ? { lastName: data.last_name ?? "" } : {}),
    });
    if (data.suspend !== undefined && data.suspend !== null) {
      if (data.suspend) await externalClerkClient().users.banUser(clerkId); else await externalClerkClient().users.unbanUser(clerkId);
    }
    if (data.role) {
      if (!roles.has(data.role)) return { ok: false, error: "Invalid role." };
      const { error } = await ctx.admin.rpc("replace_user_primary_role", { _user_id: data.userId, _new_role: data.role });
      if (error) return { ok: false, error: sanitizeRoleError(error.message) };
    }
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error && error.message === "Forbidden" ? "Forbidden" : "Could not update the account. Please try again." }; }
});

type ListAdminUsersInput = {
  search?: string;
  role?: "all" | Role;
  status?: AdminUserStatus;
};
