import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  account_type: string | null;
  roles: string[];
  onboarding_completed: boolean | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
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
      return {
        id: p.id,
        email: p.email ?? au?.email ?? null,
        display_name: p.display_name,
        account_type: p.account_type,
        roles: rolesByUser.get(p.id) ?? [],
        onboarding_completed: p.onboarding_completed,
        created_at: p.created_at,
        last_sign_in_at: au?.last_sign_in_at ?? null,
        banned_until: au?.banned_until ?? null,
      };
    });

    return { users, total: count ?? users.length };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "planner" | "vendor" | "guest" | "admin" }) => d)
  .handler(async ({ data, context }) => {
    try { await assertAdmin(context); } catch { return { ok: false, error: "Forbidden" }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const setUserBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; suspend: boolean }) => d)
  .handler(async ({ data, context }) => {
    try { await assertAdmin(context); } catch { return { ok: false, error: "Forbidden" }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.suspend ? "876000h" : "none",
    } as any);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const inviteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; role: "planner" | "vendor" | "guest" | "admin"; message?: string }) => d)
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
