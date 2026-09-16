import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ClaimInput = z.object({
  source: z.literal("google_places"),
  externalId: z.string().trim().min(3).max(240),
  businessName: z.string().trim().min(1).max(240),
  websiteUri: z.string().url().max(1000).nullable().optional(),
  googleMapsUri: z.string().url().max(1000),
});

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

function hostname(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function matchesBusinessDomain(email: string, websiteUri: string | null | undefined): boolean {
  const emailDomain = email.split("@")[1]?.toLowerCase();
  const siteDomain = hostname(websiteUri);
  if (!emailDomain || !siteDomain || PUBLIC_EMAIL_DOMAINS.has(emailDomain)) return false;
  return siteDomain === emailDomain || siteDomain.endsWith(`.${emailDomain}`) || emailDomain.endsWith(`.${siteDomain}`);
}

export const requestExternalVendorClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ClaimInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    if (profileError || !profile?.email) {
      return { error: "We couldn't verify the signed-in account email. Please try again." };
    }

    const email = profile.email.trim().toLowerCase();
    const ownershipVerified = matchesBusinessDomain(email, data.websiteUri);
    const verificationMethod = ownershipVerified ? "email_domain_match" : "manual_review_required";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const claimsTable = (supabaseAdmin as any).from("vendor_claim_requests");
    const { data: existing } = await claimsTable
      .select("id,status,ownership_verified")
      .eq("source", data.source)
      .eq("external_id", data.externalId)
      .eq("claimant_user_id", userId)
      .maybeSingle();

    if (existing?.status === "pending_review") {
      return {
        ok: true,
        status: "pending_review" as const,
        ownershipVerified: Boolean(existing.ownership_verified),
      };
    }

    const { error } = await claimsTable.upsert(
      {
        source: data.source,
        external_id: data.externalId,
        business_name: data.businessName,
        website_uri: data.websiteUri ?? null,
        google_maps_uri: data.googleMapsUri,
        claimant_user_id: userId,
        claimant_email: email,
        ownership_verified: ownershipVerified,
        verification_method: verificationMethod,
        status: "pending_review",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source,external_id,claimant_user_id" },
    );
    if (error) return { error: "We couldn't save the claim request. Please try again." };

    return {
      ok: true,
      status: "pending_review" as const,
      ownershipVerified,
    };
  });