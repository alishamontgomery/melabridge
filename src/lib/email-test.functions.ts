import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  recipient: z.string().email().default("hello@melabridge.com"),
});

export const sendDomainTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data ?? {}))
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

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, code: "no_api_key" as const, message: "Email API key not configured." };
    }

    const { EmailAPIError, sendLovableEmail } = await import("@lovable.dev/email-js");

    const SENDER_DOMAIN = "notify.melabridge.com";
    const FROM_DOMAIN = "notify.melabridge.com";
    const SITE_NAME = "MelaBridge";
    const subject = "MelaBridge · Test email from notify.melabridge.com";
    const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#111">
      <h2 style="margin:0 0 12px">✅ MelaBridge email delivery is working</h2>
      <p>This test message was sent from <strong>${SENDER_DOMAIN}</strong> at ${new Date().toISOString()}.</p>
      <p>If you received it, DNS verification and Lovable managed sending are healthy.</p>
    </body></html>`;
    const text = `MelaBridge test email from ${SENDER_DOMAIN} at ${new Date().toISOString()}. Delivery is working.`;

    try {
      await sendLovableEmail(
        {
          to: data.recipient,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          purpose: "transactional",
          label: "admin-domain-test",
          idempotency_key: `domain-test:${Date.now()}`,
        },
        { apiKey, sendUrl: process.env.LOVABLE_SEND_URL },
      );
      return { ok: true as const, recipient: data.recipient };
    } catch (error) {
      if (error instanceof EmailAPIError) {
        return {
          ok: false as const,
          code: error.code ?? "send_failed",
          message: error.message,
          status: error.status,
        };
      }
      return {
        ok: false as const,
        code: "send_failed" as const,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
