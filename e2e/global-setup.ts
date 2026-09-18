import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import type { FullConfig } from "@playwright/test";
import { smokeConfig, type SmokeRole } from "./support/config";

type LegacyUser = { id: string; email?: string | null };
type AdminClient = SupabaseClient<any, "public", "public", any, any>;

const roleData: Record<
  SmokeRole,
  { accountType: string; dbRole: string; onboardingCompleted: boolean }
> = {
  host: { accountType: "personal", dbRole: "personal", onboardingCompleted: false },
  planner: { accountType: "organization", dbRole: "organization", onboardingCompleted: false },
  vendor: { accountType: "vendor", dbRole: "vendor", onboardingCompleted: false },
  admin: { accountType: "admin", dbRole: "admin", onboardingCompleted: true },
};

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const smoke = smokeConfig();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.service_role;
  if (!supabaseUrl || !serviceRole) {
    throw new Error(
      "[e2e] SUPABASE_URL and service_role are required to seed the compatibility identities.",
    );
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as AdminClient;
  const users = await listAllUsers(admin);

  for (const role of ["host", "planner", "vendor", "admin"] as const) {
    const account = smoke.accounts[role];
    const existing = users.find(
      (user) => user.email?.toLowerCase() === account.email.toLowerCase(),
    );
    let userId = existing?.id;
    if (!userId) {
      const created = await admin.auth.admin.createUser({
        email: account.email,
        password: randomBytes(24).toString("hex"),
        email_confirm: true,
        user_metadata: { display_name: `E2E ${role}` },
      });
      if (created.error || !created.data.user) {
        throw new Error(
          `[e2e] Could not create Supabase compatibility identity for ${role}: ${created.error?.message || "unknown error"}`,
        );
      }
      userId = created.data.user.id;
    }

    const data = roleData[role];
    const profile = await admin.from("profiles").upsert(
      {
        id: userId,
        email: account.email,
        display_name: `E2E ${role}`,
        account_type: data.accountType,
        onboarding_completed: data.onboardingCompleted,
        is_test_seed: true,
      },
      { onConflict: "id" },
    );
    if (profile.error) {
      throw new Error(`[e2e] Could not seed ${role} profile: ${profile.error.message}`);
    }

    const roleRow = await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.dbRole }, { onConflict: "user_id,role" });
    if (roleRow.error) {
      throw new Error(`[e2e] Could not seed ${role} role: ${roleRow.error.message}`);
    }
  }

  const event = await admin
    .from("events")
    .select("id")
    .eq("id", smoke.ticketEventId)
    .maybeSingle();
  if (event.error || !event.data) {
    throw new Error(
      `[e2e] E2E_TICKET_EVENT_ID must identify an existing seeded event: ${event.error?.message || "not found"}`,
    );
  }
  const ticketTypes = await admin
    .from("ticket_types")
    .select("name,price_cents")
    .eq("event_id", smoke.ticketEventId)
    .eq("is_active", true);
  if (ticketTypes.error) {
    throw new Error(`[e2e] Could not inspect ticket fixture: ${ticketTypes.error.message}`);
  }
  const hasFree = ticketTypes.data.some((ticket) => ticket.price_cents === 0);
  const hasPaid = ticketTypes.data.some((ticket) => ticket.price_cents > 0);
  if (!hasFree || !hasPaid) {
    throw new Error(
      "[e2e] The seeded ticket event must contain one active free ticket type and one active paid ticket type.",
    );
  }
}

async function listAllUsers(admin: AdminClient): Promise<LegacyUser[]> {
  const result: LegacyUser[] = [];
  for (let page = 1; ; page += 1) {
    const response = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (response.error) {
      throw new Error(`[e2e] Could not inspect Supabase compatibility users: ${response.error.message}`);
    }
    result.push(...(response.data.users as LegacyUser[]));
    if (response.data.users.length < 1000) return result;
  }
}