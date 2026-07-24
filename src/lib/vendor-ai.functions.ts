import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * MelaAssist Vendor Profile Builder — draft generation only.
 *
 * These server functions NEVER write to the database. They return structured
 * draft content that the UI renders as editable cards. Saving is a separate,
 * explicit user action handled by the existing profile save endpoints.
 */

const DraftInput = z.object({
  mode: z.enum(["website", "business_name", "description", "conversation"]),
  input: z.string().trim().min(2).max(4000),
  category: z.string().trim().max(80).optional(),
  regenerateSection: z
    .enum([
      "description",
      "short_bio",
      "long_bio",
      "services",
      "highlights",
      "faqs",
      "policies",
      "service_areas",
      "cta",
      "social_bio",
      "packages",
      "all",
    ])
    .optional(),
});

const PackageSchema = z.object({
  name: z.string(),
  description: z.string(),
  inclusions: z.array(z.string()).default([]),
  price_placeholder: z.string().default(""),
  duration: z.string().default(""),
  upgrades: z.array(z.string()).default([]),
});

const FAQSchema = z.object({ question: z.string(), answer: z.string() });

const DraftSchema = z.object({
  business_name: z.string().default(""),
  business_category: z.string().default(""),
  description: z.string().default(""),
  short_bio: z.string().default(""),
  long_bio: z.string().default(""),
  services: z.array(z.string()).default([]),
  highlights: z.array(z.string()).default([]),
  faqs: z.array(FAQSchema).default([]),
  policies: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
  service_areas: z.array(z.string()).default([]),
  cta: z.string().default(""),
  social_bio: z.string().default(""),
  packages: z.array(PackageSchema).default([]),
  suggestions: z.array(z.string()).default([]),
});

export type VendorProfileDraft = z.infer<typeof DraftSchema>;

function systemPrompt(regenerate?: string) {
  const focus = regenerate && regenerate !== "all" ? `\n\nFocus this generation on the "${regenerate}" section only; other sections may be short placeholders.` : "";
  return `You are MelaAssist, a warm, expert business consultant helping event vendors build a professional public profile.

Voice: friendly, confident, specific. Never robotic. Never generic marketing fluff. No emojis.

You will draft a complete vendor profile as valid JSON matching this exact shape:
{
  "business_name": string,
  "business_category": string,
  "description": string (60-120 words, punchy),
  "short_bio": string (1-2 sentences),
  "long_bio": string (2-3 short paragraphs),
  "services": string[] (5-8 concrete services),
  "highlights": string[] (4-6 short bullet-length credibility points),
  "faqs": { "question": string, "answer": string }[] (6-8 real FAQs),
  "policies": { "title": string, "body": string }[] (deposit, cancellation, travel, custom work),
  "service_areas": string[] (5-10 realistic areas — cities/regions),
  "cta": string (single sentence call to action),
  "social_bio": string (Instagram-length, under 150 chars),
  "packages": {
    "name": string,
    "description": string,
    "inclusions": string[],
    "price_placeholder": string ("Starting at $..." — placeholder only),
    "duration": string,
    "upgrades": string[]
  }[] (3-5 packages tailored to the category),
  "suggestions": string[] (3-6 profile-improvement recommendations — upload photos, add hours, etc.)
}

Rules:
- Everything must be a plausible, professional draft the vendor can edit.
- Never invent real client names, testimonials, awards, or prices — use "Starting at $X" placeholders.
- Tailor packages, services, and FAQs to the vendor's category.
- Return ONLY valid JSON — no markdown fences, no prose before or after.${focus}`;
}

function userPrompt(mode: string, input: string, category?: string) {
  const cat = category ? `\nCategory hint: ${category}` : "";
  switch (mode) {
    case "website":
      return `Source: business website URL.${cat}\nURL: ${input}\n\nInfer the business and draft the profile.`;
    case "business_name":
      return `Source: business name only.${cat}\nName: ${input}\n\nDraft a plausible profile a real vendor with this name would use.`;
    case "description":
      return `Source: an existing business description.${cat}\nDescription:\n${input}\n\nExpand this into a full profile draft.`;
    default:
      return `Source: vendor conversation.${cat}\nWhat they told MelaAssist:\n${input}\n\nDraft the full profile.`;
  }
}

export const generateVendorProfileDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DraftInput.parse(input))
  .handler(async ({ data }): Promise<{ draft: VendorProfileDraft | null; degraded: boolean; message?: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { draft: null, degraded: true, message: "MelaAssist is temporarily unavailable." };

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt(data.regenerateSection) },
            { role: "user", content: userPrompt(data.mode, data.input, data.category) },
          ],
        }),
      });
      if (resp.status === 429) return { draft: null, degraded: true, message: "MelaAssist is busy — please try again shortly." };
      if (resp.status === 402) return { draft: null, degraded: true, message: "MelaAssist is temporarily paused on this workspace." };
      if (!resp.ok) return { draft: null, degraded: true, message: "MelaAssist couldn't reach the planning engine." };
      const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = (json.choices?.[0]?.message?.content ?? "").trim();
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
      const parsed = DraftSchema.safeParse(JSON.parse(cleaned));
      if (!parsed.success) return { draft: null, degraded: true, message: "MelaAssist returned an unexpected response — please try again." };
      return { draft: parsed.data, degraded: false };
    } catch {
      return { draft: null, degraded: true, message: "MelaAssist couldn't reach the planning engine." };
    }
  });

/**
 * Save only mapped columns to vendor_profiles.
 * Existing values are preserved unless the caller explicitly passes a value.
 * Never overwrites without an explicit user action.
 */
const SaveInput = z.object({
  business_name: z.string().trim().min(1).max(200).optional(),
  business_category: z.string().trim().min(1).max(80).optional(),
  business_description: z.string().trim().max(4000).optional(),
});

export const saveVendorProfileDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "string" && v.trim().length > 0) updates[k] = v.trim();
    }
    if (Object.keys(updates).length === 0) return { saved: false };

    const { data: existing } = await supabase
      .from("vendor_profiles")
      .select("id, business_name, business_category")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("vendor_profiles").update(updates).eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("vendor_profiles").insert({
        user_id: userId,
        business_name: updates.business_name ?? "New business",
        business_category: updates.business_category ?? "other",
        business_description: updates.business_description ?? null,
      });
      if (error) throw new Error(error.message);
    }
    return { saved: true };
  });

/**
 * Load current vendor profile completeness. Read-only.
 */
export const getVendorProfileSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data } = await supabase
      .from("vendor_profiles")
      .select(
        "business_name, business_category, business_description, logo_url, portfolio_urls, phone, email, website, business_hours, starting_price, city, state, business_address, social_links, travel_radius",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return { profile: null, completion: 0, missing: [] as string[] };

    const checks: Array<{ key: string; label: string; ok: boolean }> = [
      { key: "business_name", label: "Business name", ok: !!data.business_name },
      { key: "business_category", label: "Category", ok: !!data.business_category },
      { key: "business_description", label: "Business description", ok: !!data.business_description && data.business_description.length > 40 },
      { key: "logo_url", label: "Logo", ok: !!data.logo_url },
      { key: "portfolio_urls", label: "Portfolio photos", ok: Array.isArray(data.portfolio_urls) && data.portfolio_urls.length >= 3 },
      { key: "phone", label: "Phone number", ok: !!data.phone },
      { key: "email", label: "Contact email", ok: !!data.email },
      { key: "website", label: "Website", ok: !!data.website },
      { key: "business_hours", label: "Business hours", ok: !!data.business_hours },
      { key: "starting_price", label: "Starting price", ok: data.starting_price != null },
      { key: "city", label: "City", ok: !!data.city },
      { key: "social_links", label: "Social links", ok: !!data.social_links && Object.keys(data.social_links as object).length > 0 },
    ];
    const total = checks.length;
    const passed = checks.filter((c) => c.ok).length;
    const completion = Math.round((passed / total) * 100);
    const missing = checks.filter((c) => !c.ok).map((c) => c.label);
    return { profile: data, completion, missing };
  });
