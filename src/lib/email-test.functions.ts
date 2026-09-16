import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  recipient: z.string().email().default("hello@melabridge.com"),
});

export const sendDomainTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => inputSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    // Admin gate
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) {
      return { ok: false as const, code: "forbidden" as const, message: "Admin role required." };
    }

    return {
      ok: false as const,
      code: "provider_not_configured" as const,
      message: "Transactional email is disabled because no email provider is configured.",
    };
  });
