import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  account_type: string | null;
  roles: string[];
  onboarding_completed: boolean | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  email_confirmed_at: string | null;
  invited_at: string | null;
};

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ users: AdminUserRow[]; total: number } | { error: string }> => {
    try {
      await assertAdmin(context);
    } catch {
      return { error: "Forbidden" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles, count }, { data: allRoles }, { data: authList }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,email,display_name,account_type,onboarding_completed,created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 }),
    ]);

    const rolesByUser = new Map<string, string[]>();
    (allRoles ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    const authByUser = new Map<string, any>();
    (authList?.users ?? []).forEach((u: any) => authByUser.set(u.id, u));

    const users: AdminUserRow[] = (profiles ?? []).map((p: any) => {
      const au = authByUser.get(p.id);
      const meta = au?.user_metadata ?? {};
      return {
        id: p.id,
        email: p.email ?? au?.email ?? null,
        display_name: p.display_name,
        first_name: meta.first_name ?? null,
        last_name: meta.last_name ?? null,
        account_type: p.account_type,
        roles: rolesByUser.get(p.id) ?? [],
        onboarding_completed: p.onboarding_completed,
        created_at: p.created_at,
        last_sign_in_at: au?.last_sign_in_at ?? null,
        banned_until: au?.banned_until ?? null,
        email_confirmed_at: au?.email_confirmed_at ?? au?.confirmed_at ?? null,
        invited_at: au?.invited_at ?? null,
      };
    });

    return { users, total: count ?? users.length };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "personal" | "organization" | "vendor" | "admin" }) => d)
  .handler(async ({ data, context }) => {
    try { await assertAdmin(context); } catch { return { ok: false, error: "Forbidden" }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Replace primary role: delete existing then insert the new one (idempotent)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const setUserBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; suspend: boolean }) => d)
  .handler(async ({ data, context }) => {
    try { await assertAdmin(context); } catch { return { ok: false, error: "Forbidden" }; }
    if (context.userId === data.userId && data.suspend) {
      return { ok: false, error: "You cannot suspend your own account." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.suspend ? "876000h" : "none",
    } as any);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const inviteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; role: "personal" | "organization" | "vendor" | "admin"; message?: string }) => d)
  .handler(async ({ data, context }) => {
    try { await assertAdmin(context); } catch { return { ok: false, error: "Forbidden" }; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return { ok: false, error: "Invalid email" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { invited_role: data.role, invite_message: data.message ?? null },
    });
    if (error) return { ok: false, error: error.message };
    if (invite?.user?.id) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: invite.user.id, role: data.role }, { onConflict: "user_id,role" });
    }
    return { ok: true, userId: invite?.user?.id ?? null };
  });

export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    try { await assertAdmin(context); } catch { return { ok: false, error: "Forbidden" }; }
    if (context.userId === data.userId) {
      return { ok: false, error: "You cannot delete your own account while signed in." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Protect the final remaining admin
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = new Set((admins ?? []).map((r: any) => r.user_id));
    if (adminIds.has(data.userId) && adminIds.size <= 1) {
      return { ok: false, error: "Cannot delete the last remaining admin account." };
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) return { ok: false, error: error.message };
    // Profiles & user_roles cascade on auth user delete (FK on auth.users)
    return { ok: true };
  });

export const resetAdminUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => d)
  .handler(async ({ data, context }) => {
    try { await assertAdmin(context); } catch { return { ok: false, error: "Forbidden" }; }
    if (!data.email) return { ok: false, error: "Missing email" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    } as any);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const resendAdminUserVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; email: string }) => d)
  .handler(async ({ data, context }) => {
    try { await assertAdmin(context); } catch { return { ok: false, error: "Forbidden" }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // For unverified users created via invite, re-invite; otherwise generate signup link
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
    if (error) {
      // Fallback: generate a signup magic link (triggers email via hook)
      const { error: gErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: data.email,
      } as any);
      if (gErr) return { ok: false, error: gErr.message };
    }
    return { ok: true };
  });

export const updateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    userId: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    role?: "personal" | "organization" | "vendor" | "admin" | null;
    suspend?: boolean | null;
  }) => d)
  .handler(async ({ data, context }) => {
    try { await assertAdmin(context); } catch { return { ok: false, error: "Forbidden" }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Update profile display name
    if (data.display_name !== undefined) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ display_name: data.display_name })
        .eq("id", data.userId);
      if (error) return { ok: false, error: error.message };
    }

    // Update auth user metadata (first/last) and suspension
    const authPatch: any = {};
    if (data.first_name !== undefined || data.last_name !== undefined) {
      authPatch.user_metadata = {
        ...(data.first_name !== undefined ? { first_name: data.first_name } : {}),
        ...(data.last_name !== undefined ? { last_name: data.last_name } : {}),
      };
    }
    if (data.suspend !== undefined && data.suspend !== null) {
      if (context.userId === data.userId && data.suspend) {
        return { ok: false, error: "You cannot suspend your own account." };
      }
      authPatch.ban_duration = data.suspend ? "876000h" : "none";
    }
    if (Object.keys(authPatch).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, authPatch);
      if (error) return { ok: false, error: error.message };
    }

    // Update role
    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error) return { ok: false, error: error.message };
    }

    return { ok: true };
  });
