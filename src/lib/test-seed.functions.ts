import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Guard: seeding is only allowed when this env var is present.
// Unset on production, set (to any value) on dev/preview.
function seedingAllowed(): boolean {
  return process.env.SEED_TEST_DATA_ALLOWED === "true" || process.env.NODE_ENV !== "production";
}

const TEST_ACCOUNTS = [
  { key: "admin",   email: "admin@test.melabridge.com",   password: "MelaTest!2026", display_name: "Test Admin",   account_type: "personal" },
  { key: "planner", email: "planner@test.melabridge.com", password: "MelaTest!2026", display_name: "Test Planner", account_type: "personal" },
  { key: "vendor",  email: "vendor@test.melabridge.com",  password: "MelaTest!2026", display_name: "Test Vendor",  account_type: "vendor"   },
] as const;

type AccountResult = { email: string; role: string; id: string; created: boolean };
type SeedResult =
  | { ok: true; accounts: AccountResult[]; events: number; guests: number; notifications: number }
  | { ok: false; error: string };

const ROLE_BY_KEY: Record<string, "personal" | "vendor" | "admin"> = {
  admin: "admin",
  planner: "personal",
  vendor: "vendor",
};

export const seedTestData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SeedResult> => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc as any;

    const { data: isAdmin, error: roleErr } = await rpc("has_role", { _user_id: userId, _role: "admin" });
    if (roleErr || !isAdmin) return { ok: false, error: "Admin role required." };

    if (!seedingAllowed()) return { ok: false, error: "Test data seeding is disabled on production." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: AccountResult[] = [];

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });

    for (const acct of TEST_ACCOUNTS) {
      const found = list?.users?.find((u) => u.email?.toLowerCase() === acct.email.toLowerCase());
      let outId: string;
      let created = false;
      if (found) {
        outId = found.id;
        await supabaseAdmin.auth.admin.updateUserById(found.id, {
          password: acct.password,
          email_confirm: true,
          user_metadata: { display_name: acct.display_name },
        });
      } else {
        const { data: createRes, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: acct.email,
          password: acct.password,
          email_confirm: true,
          user_metadata: { display_name: acct.display_name },
        });
        if (createErr || !createRes.user) return { ok: false, error: `Create ${acct.email}: ${createErr?.message ?? "unknown error"}` };
        outId = createRes.user.id;
        created = true;
      }

      await supabaseAdmin.from("profiles").upsert(
        {
          id: outId,
          email: acct.email,
          display_name: acct.display_name,
          account_type: acct.account_type,
          onboarding_completed: true,
          is_test_seed: true,
        },
        { onConflict: "id" },
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from("user_roles") as any).upsert(
        { user_id: outId, role: ROLE_BY_KEY[acct.key] },
        { onConflict: "user_id,role" },
      );

      results.push({ email: acct.email, role: acct.key, id: outId, created });
    }

    const ids = Object.fromEntries(results.map((r) => [r.role, r.id])) as Record<string, string>;

    // seed_test_data is service_role only — invoke via admin client.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminRpc = supabaseAdmin.rpc as any;
    const { data: seedSummary, error: seedErr } = await adminRpc("seed_test_data", {
      planner_id: ids.planner,
      vendor_id: ids.vendor,
      admin_id: ids.admin,
    });
    if (seedErr) return { ok: false, error: `Seed: ${seedErr.message}` };

    const s = (seedSummary as { events?: number; guests?: number; notifications?: number } | null) ?? {};
    return { ok: true, accounts: results, events: s.events ?? 0, guests: s.guests ?? 0, notifications: s.notifications ?? 0 };
  });

export const wipeTestData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; error?: string }> => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc as any;
    const { data: isAdmin } = await rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { ok: false, error: "Admin required." };
    if (!seedingAllowed()) return { ok: false, error: "Disabled on production." };
    const { error } = await rpc("wipe_test_data");
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
