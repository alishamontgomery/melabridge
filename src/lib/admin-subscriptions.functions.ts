import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findPlanByPriceId } from "@/lib/billing-config";

export type AdminSubscriptionRow = {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  product_id: string | null;
  price_id: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  environment: string | null;
  created_at: string | null;
  updated_at: string | null;
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

export type ListAdminSubscriptionsInput = {
  page?: number;
  pageSize?: number;
  status?: string | null;
  search?: string | null;
};

export type AdminSubscriptionSummary = {
  total: number;
  active: number;
  trialing: number;
  pastDue: number;
  canceled: number;
  activeCustomers: number;
  upgradesLast30Days: number;
  planBreakdown: Array<{ priceId: string; count: number }>;
  estimatedMonthlyRevenueCents: number;
  estimatedAnnualRevenueCents: number;
};

type CurrentPlanRow = {
  price_id: string | null;
  current_period_end: string | null;
  user_id: string | null;
};

export function summarizeCurrentPlanRows(rows: CurrentPlanRow[], nowIso: string) {
  const planCounts = new Map<string, number>();
  let estimatedMonthlyRevenueCents = 0;
  const currentRows = rows.filter(
    (row) => !row.current_period_end || row.current_period_end > nowIso,
  );

  for (const row of currentRows) {
    const priceId = row.price_id ?? "unknown";
    planCounts.set(priceId, (planCounts.get(priceId) ?? 0) + 1);
    const plan = findPlanByPriceId(priceId);
    if (plan?.price != null) {
      estimatedMonthlyRevenueCents +=
        plan.interval === "year"
          ? Math.round((plan.price * 100) / 12)
          : Math.round(plan.price * 100);
    }
  }

  return {
    activeCustomers: new Set(currentRows.map((row) => row.user_id).filter(Boolean)).size,
    planBreakdown: [...planCounts.entries()]
      .map(([priceId, count]) => ({ priceId, count }))
      .sort((a, b) => b.count - a.count),
    estimatedMonthlyRevenueCents,
    estimatedAnnualRevenueCents: estimatedMonthlyRevenueCents * 12,
  };
}

async function fetchAllCurrentPlanRows(supabaseAdmin: any): Promise<
  { data: CurrentPlanRow[]; error: null } | { data: null; error: { message: string } }
> {
  const pageSize = 1_000;
  const rows: CurrentPlanRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("price_id,current_period_end,user_id")
      .in("status", ["active", "trialing", "past_due"])
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) return { data: null, error };
    const page = (data ?? []) as CurrentPlanRow[];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}

export const getAdminSubscriptionSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminSubscriptionSummary | { error: string }> => {
    try {
      await assertAdmin(context);
    } catch {
      return { error: "Forbidden" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    const [
      totalResult,
      activeResult,
      trialingResult,
      pastDueResult,
      canceledResult,
      recentResult,
      planRowsResult,
    ] = await Promise.all([
      supabaseAdmin.from("subscriptions").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .or(`current_period_end.is.null,current_period_end.gt.${nowIso}`),
      supabaseAdmin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "trialing")
        .or(`current_period_end.is.null,current_period_end.gt.${nowIso}`),
      supabaseAdmin.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "past_due"),
      supabaseAdmin.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "canceled"),
      supabaseAdmin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      fetchAllCurrentPlanRows(supabaseAdmin),
    ]);

    const summaryError =
      totalResult.error ||
      activeResult.error ||
      trialingResult.error ||
      pastDueResult.error ||
      canceledResult.error ||
      recentResult.error ||
      planRowsResult.error;
    if (summaryError) return { error: summaryError.message };

    const planSummary = summarizeCurrentPlanRows(planRowsResult.data ?? [], nowIso);

    return {
      total: totalResult.count ?? 0,
      active: activeResult.count ?? 0,
      trialing: trialingResult.count ?? 0,
      pastDue: pastDueResult.count ?? 0,
      canceled: canceledResult.count ?? 0,
      upgradesLast30Days: recentResult.count ?? 0,
      ...planSummary,
    };
  });

export const listAdminSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => d as ListAdminSubscriptionsInput)
  .handler(
    async ({ data, context }): Promise<
      | {
          subscriptions: AdminSubscriptionRow[];
          total: number;
          page: number;
          pageSize: number;
        }
      | { error: string }
    > => {
      try {
        await assertAdmin(context);
      } catch {
        return { error: "Forbidden" };
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const page = Math.max(1, data?.page ?? 1);
      const pageSize = Math.min(100, Math.max(10, data?.pageSize ?? 50));
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const search = data?.search?.trim().toLowerCase() ?? "";

      let query = supabaseAdmin
        .from("subscriptions")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      // Server-side status filter
      const status = data?.status;
      if (status && status !== "all") {
        if (status === "other") {
          query = query.not("status", "in", '("active","trialing","past_due","canceled")');
        } else {
          query = query.eq("status", status);
        }
      }

      if (search) {
        const escaped = search.replace(/[%_]/g, (value) => `\\${value}`);
        const { data: matchingProfiles, error: profileSearchError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .or(`email.ilike.%${escaped}%,display_name.ilike.%${escaped}%`)
          .limit(500);
        if (profileSearchError) return { error: profileSearchError.message };
        const matchingIds = (matchingProfiles ?? []).map((profile: { id: string }) => profile.id);
        if (matchingIds.length > 0) {
          query = query.in("user_id", matchingIds);
        } else {
          query = query.ilike("stripe_subscription_id", `%${escaped}%`);
        }
      }

      // Apply pagination
      query = query.range(from, to);

      const { data: subs, count, error } = await query;

      if (error) return { error: error.message };

      const userIds = [...new Set((subs ?? []).map((s: any) => s.user_id).filter(Boolean))];

      let profiles: any[] = [];
      if (userIds.length) {
        const { data: p } = await supabaseAdmin
          .from("profiles")
          .select("id, email, display_name")
          .in("id", userIds);
        profiles = p ?? [];
      }

      const profileMap = new Map<string, { email: string | null; display_name: string | null }>();
      profiles.forEach((p: any) => profileMap.set(p.id, p));

      const subscriptions: AdminSubscriptionRow[] = (subs ?? []).map((s: any) => {
        const profile = profileMap.get(s.user_id);
        return {
          id: s.id,
          user_id: s.user_id,
          email: profile?.email ?? null,
          display_name: profile?.display_name ?? null,
          stripe_subscription_id: s.stripe_subscription_id ?? null,
          stripe_customer_id: s.stripe_customer_id ?? null,
          product_id: s.product_id ?? null,
          price_id: s.price_id ?? null,
          status: s.status ?? null,
          current_period_start: s.current_period_start ?? null,
          current_period_end: s.current_period_end ?? null,
          cancel_at_period_end: s.cancel_at_period_end ?? false,
          environment: s.environment ?? null,
          created_at: s.created_at ?? null,
          updated_at: s.updated_at ?? null,
        };
      });

      return {
        subscriptions,
        total: count ?? 0,
        page,
        pageSize,
      };
    },
  );

export const getStripePortalLinkForCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => d as { stripeCustomerId: string; returnUrl?: string })
  .handler(
    async ({ data, context }): Promise<{ url: string } | { error: string }> => {
      try {
        await assertAdmin(context);
      } catch {
        return { error: "Forbidden" };
      }

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return { error: "Stripe not configured" };

      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" } as any);
        const session = await stripe.billingPortal.sessions.create({
          customer: data.stripeCustomerId,
          return_url: data.returnUrl ?? "https://melabridge.com/admin/subscriptions",
        });
        return { url: session.url };
      } catch (e: any) {
        return { error: e?.message ?? "Failed to create portal session" };
      }
    },
  );
