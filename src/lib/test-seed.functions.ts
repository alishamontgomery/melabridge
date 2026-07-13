import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROD_HOSTS = new Set(["melabridge.com", "www.melabridge.com", "melabridge.lovable.app"]);

const TEST_ACCOUNTS: Array<{
  key: "planner" | "vendor" | "attendee" | "guest" | "admin";
  email: string;
  password: string;
  display_name: string;
  account_type: string;
}> = [
  { key: "admin",    email: "admin@test.melabridge.com",    password: "MelaTest!2026", display_name: "Test Admin",    account_type: "planner"  },
  { key: "planner",  email: "planner@test.melabridge.com",  password: "MelaTest!2026", display_name: "Test Planner",  account_type: "planner"  },
  { key: "vendor",   email: "vendor@test.melabridge.com",   password: "MelaTest!2026", display_name: "Test Vendor",   account_type: "vendor"   },
  { key: "attendee", email: "attendee@test.melabridge.com", password: "MelaTest!2026", display_name: "Test Attendee", account_type: "attendee" },
  { key: "guest",    email: "guest@test.melabridge.com",    password: "MelaTest!2026", display_name: "Test Guest",    account_type: "guest"    },
];

type SeedResult =
  | { ok: true; accounts: Array<{ email: string; role: string; id: string; created: boolean }>; seedSummary: Record<string, unknown> }
  | { ok: false; error: string };

function isProductionHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase().split(":")[0];
  return PROD_HOSTS.has(h);
}

export const seedTestData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SeedResult> => {
    const { supabase, userId } = context;

    // 1. Admin gate (via RLS-respecting client)
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (roleErr || !isAdmin) return { ok: false, error: "Admin role required." };

    // 2. Non-production gate
    const { getWebRequest } = await import("@tanstack/react-start/server");
    const req = getWebRequest();
    const host = req?.headers.get("host") ?? req?.headers.get("x-forwarded-host");
    if (isProductionHost(host)) {
      return { ok: false, error: "Test data seeding is disabled on production." };
    }

    // 3. Admin client for auth.users management
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const results: Array<{ email: string; role: string; id: string; created: boolean }> = [];

    for (const acct of TEST_ACCOUNTS) {
      // Try to find existing user
      let userIdOut: string | null = null;
      let created = false;

      // listUsers is paginated — search by email via listUsers filter (v2 API)
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find((u) => u.email?.toLowerCase() === acct.email.toLowerCase());
      if (found) {
        userIdOut = found.id;
        // Reset password + confirm
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
        userIdOut = createRes.user.id;
        created = true;
      }

      // Ensure profile row exists (handle_new_user trigger may have created it)
      await supabaseAdmin.from("profiles").upsert(
        {
          id: userIdOut,
          email: acct.email,
          display_name: acct.display_name,
          account_type: acct.account_type,
          onboarding_completed: true,
          is_test_seed: true,
        },
        { onConflict: "id" },
      );

      // Assign role directly (attendee doesn't come from the profile→role trigger the same way)
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: userIdOut, role: acct.key === "admin" ? "admin" : (acct.key as any) },
        { onConflict: "user_id,role" },
      );

      results.push({ email: acct.email, role: acct.key, id: userIdOut, created });
    }

    const ids = Object.fromEntries(results.map((r) => [r.role, r.id])) as Record<string, string>;

    // 4. Call SQL seed function via RLS-respecting client (function itself re-checks admin)
    const { data: seedSummary, error: seedErr } = await supabase.rpc("seed_test_data", {
      planner_id: ids.planner,
      vendor_id: ids.vendor,
      attendee_id: ids.attendee,
      guest_id: ids.guest,
      admin_id: ids.admin,
    });
    if (seedErr) return { ok: false, error: `Seed: ${seedErr.message}` };

    return { ok: true, accounts: results, seedSummary: (seedSummary as any) ?? {} };
  });

export const wipeTestData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; error?: string }> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { ok: false, error: "Admin required." };

    const { getWebRequest } = await import("@tanstack/react-start/server");
    const req = getWebRequest();
    const host = req?.headers.get("host") ?? req?.headers.get("x-forwarded-host");
    if (isProductionHost(host)) return { ok: false, error: "Disabled on production." };

    const { error } = await supabase.rpc("wipe_test_data");
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
