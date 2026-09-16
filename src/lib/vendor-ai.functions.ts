import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAi, aiErrorMessage, hasAiProvider } from "@/lib/ai-client.server";

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
  context: z
    .object({
      businessName: z.string().trim().max(200).optional(),
      categories: z.array(z.string().trim().max(80)).max(20).optional(),
      description: z.string().trim().max(4000).optional(),
      services: z.array(z.string().trim().max(120)).max(40).optional(),
      highlights: z.array(z.string().trim().max(160)).max(30).optional(),
      location: z.string().trim().max(200).optional(),
      pricingContext: z.string().trim().max(200).optional(),
      packageDetails: z.array(z.string().trim().max(300)).max(20).optional(),
    })
    .optional(),
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

const PackageDescriptionInput = z.object({
  name: z.string().trim().max(200).optional(),
  serviceCategory: z.string().trim().max(120).optional(),
  features: z.array(z.string().trim().max(120)).max(40).default([]),
  addOns: z.array(z.string().trim().max(120)).max(30).default([]),
  price: z.string().trim().max(80).optional(),
  duration: z.string().trim().max(80).optional(),
  categoryFields: z.record(z.string(), z.unknown()).optional(),
});

/**
 * SSRF guard — validates that a URL is safe to fetch from the server.
 * Allows only public http/https on standard ports (80/443).
 * Blocks localhost, loopback, link-local, private CIDRs (RFC1918/RFC6890),
 * and resolves DNS to re-check the resolved IP (prevents DNS rebinding).
 * Fails closed on any parse or DNS error.
 */
async function isSafePublicUrl(urlString: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }

  // Only allow standard web protocols
  if (!["http:", "https:"].includes(parsed.protocol)) return false;

  // Only allow standard ports (empty string = default for the protocol)
  if (parsed.port !== "" && parsed.port !== "80" && parsed.port !== "443") return false;

  const hostname = parsed.hostname;

  // Blocklist patterns checked against the hostname literal
  if (isPrivateHostname(hostname)) return false;

  // Resolve DNS and check resolved IPs (prevents DNS rebinding attacks)
  try {
    const { lookup } = await import("node:dns/promises");
    const { address } = await lookup(hostname);
    if (isPrivateHostname(address)) return false;
  } catch {
    // DNS lookup failed — fail closed
    return false;
  }

  return true;
}

function isPrivateHostname(host: string): boolean {
  // Loopback / localhost
  if (/^(localhost|127\.\d+\.\d+\.\d+|::1|0\.0\.0\.0)$/i.test(host)) return true;
  // Link-local (IPv4 + IPv6)
  if (/^169\.254\.\d+\.\d+$/.test(host)) return true;
  if (/^fe80:/i.test(host)) return true;
  // RFC1918 private ranges
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  // IANA special-purpose / documentation ranges
  if (/^(100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+)$/.test(host)) return true; // CGNAT
  if (/^198\.(1[89])\.\d+\.\d+$/.test(host)) return true; // Benchmark
  if (/^198\.51\.100\.\d+$/.test(host)) return true; // TEST-NET-2
  if (/^203\.0\.113\.\d+$/.test(host)) return true; // TEST-NET-3
  if (/^(240|241|242|243|244|245|246|247|248|249|250|251|252|253|254|255)\.\d+\.\d+\.\d+$/.test(host)) return true; // Reserved
  return false;
}

function systemPrompt(regenerate?: string) {
  const focus =
    regenerate && regenerate !== "all"
      ? `\n\nFocus this generation on the "${regenerate}" section only; other sections may be short placeholders.`
      : "";
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

function userPrompt(
  mode: string,
  input: string,
  category?: string,
  context?: z.infer<typeof DraftInput>["context"],
) {
  const cat = category ? `\nCategory hint: ${category}` : "";
  const contextLines = context
    ? [
        context.businessName ? `Business name: ${context.businessName}` : "",
        context.categories?.length ? `Selected services: ${context.categories.join(", ")}` : "",
        context.description ? `Existing profile description: ${context.description}` : "",
        context.services?.length ? `Existing services: ${context.services.join(", ")}` : "",
        context.highlights?.length ? `Existing highlights: ${context.highlights.join(", ")}` : "",
        context.location ? `Location/service area: ${context.location}` : "",
        context.pricingContext ? `Pricing context: ${context.pricingContext}` : "",
        context.packageDetails?.length ? `Existing package details:\n${context.packageDetails.join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const additionalContext = contextLines ? `\n\nAdditional vendor context:\n${contextLines}` : "";
  switch (mode) {
    case "website":
      return `Source: business website URL.${cat}\nURL: ${input}${additionalContext}\n\nInfer the business and draft the profile.`;
    case "business_name":
      return `Source: business name only.${cat}\nName: ${input}${additionalContext}\n\nDraft a plausible profile a real vendor with this name would use.`;
    case "description":
      return `Source: an existing business description.${cat}\nDescription:\n${input}${additionalContext}\n\nExpand this into a full profile draft.`;
    default:
      return `Source: vendor conversation.${cat}\nWhat they told MelaAssist:\n${input}${additionalContext}\n\nDraft the full profile.`;
  }
}

function trimGeneratedDescription(value: string): string {
  const cleaned = value
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= 500) return cleaned;
  const shortened = cleaned.slice(0, 500);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > 320 ? lastSpace : 500).trim()}…`;
}

/**
 * Generate only the editable package description. This is separate from the
 * profile draft flow so the package editor can apply the result immediately
 * without opening a second chat surface or saving anything automatically.
 */
export const generateVendorPackageDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => PackageDescriptionInput.parse(input))
  .handler(async ({ data }): Promise<{ description: string; degraded: boolean; message?: string }> => {
    if (!hasAiProvider()) {
      return {
        description: "",
        degraded: true,
        message: aiErrorMessage({ kind: "no_key" }),
      };
    }

    const categoryDetails = Object.entries(data.categoryFields ?? {})
      .filter(([, value]) => value != null && value !== "" && value !== false && !(Array.isArray(value) && value.length === 0))
      .map(([key, value]) => `${key.replace(/_/g, " ")}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
      .join("\n");

    const prompt = [
      "Write a useful, client-facing description for this event-service package.",
      "Return only the description as plain text: 2–3 sentences, no heading, no bullets, no quotation marks, and no invented testimonials, awards, guarantees, or exact claims not supplied below.",
      "Make the wording specific to the service category and package details. Explain the experience and value a client can expect.",
      `Package name: ${data.name || "Untitled package"}`,
      `Service category: ${data.serviceCategory || "Event service"}`,
      `Included features: ${data.features.length > 0 ? data.features.join(", ") : "Not specified"}`,
      `Available add-ons: ${data.addOns.length > 0 ? data.addOns.join(", ") : "None specified"}`,
      `Price: ${data.price || "Not specified"}`,
      `Duration: ${data.duration || "Not specified"}`,
      categoryDetails ? `Category-specific details:\n${categoryDetails}` : "",
    ].filter(Boolean).join("\n");

    const result = await callAi(
      [
        {
          role: "system",
          content: "You are MelaAssist, an expert event-vendor copywriter. Be concrete, warm, and accurate.",
        },
        { role: "user", content: prompt },
      ],
    );

    if (!result.ok) {
      return {
        description: "",
        degraded: true,
        message: aiErrorMessage(result.error),
      };
    }

    const description = trimGeneratedDescription(result.text);
    if (!description) {
      return {
        description: "",
        degraded: true,
        message: "MelaAssist returned an empty description. Please try again.",
      };
    }

    return { description, degraded: false };
  });

export const generateVendorProfileDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => DraftInput.parse(input))
  .handler(async ({ data }): Promise<{ draft: VendorProfileDraft | null; degraded: boolean; message?: string; errorKind?: string }> => {
    if (!hasAiProvider()) {
      console.error(
        "[MelaAssist] generateVendorProfileDraft: No AI provider key configured. " +
        "Add GEMINI_API_KEY to Replit Secrets.",
      );
      return {
        draft: null,
        degraded: true,
        errorKind: "no_key",
        message: "MelaAssist is temporarily unavailable. Please try again shortly.",
      };
    }

    // For website mode, fetch the page server-side so the model has real content to work from.
    // URL must pass SSRF validation before we make any outbound request.
    let effectiveInput = data.input;
    if (data.mode === "website") {
      const safe = await isSafePublicUrl(data.input);
      if (!safe) {
        console.warn("[MelaAssist] Website fetch blocked by SSRF guard.");
        // Fall through with URL-only — non-fatal; model will infer from the domain name
      } else {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(data.input, {
            headers: {
              "User-Agent": "MelaAssist/1.0 (vendor profile builder; +https://melabridge.com)",
              "Accept": "text/html,application/xhtml+xml",
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const html = await res.text();
            // Strip scripts, styles, and HTML tags; collapse whitespace
            const text = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
              .replace(/&nbsp;/gi, " ").replace(/&#?\w+;/gi, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 3000);
            if (text.length > 80) {
              effectiveInput = `URL: ${data.input}\n\nWebsite content (extracted):\n${text}`;
            }
          }
        } catch (fetchErr) {
          // Non-fatal — proceed with URL only
          console.warn("[MelaAssist] Website fetch failed:", fetchErr instanceof Error ? fetchErr.name : "unknown error");
        }
      }
    }

    const messages = [
      { role: "system" as const, content: systemPrompt(data.regenerateSection) },
      { role: "user" as const, content: userPrompt(data.mode, effectiveInput, data.category, data.context) },
    ];

    const result = await callAi(messages, {
      jsonMode: true,
      isAcceptable: (text) => {
        try {
          const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
          return Boolean(parsed && typeof parsed === "object");
        } catch {
          return false;
        }
      },
    });

    if (!result.ok) {
      console.error("[MelaAssist] generateVendorProfileDraft: AI call failed:", result.error);
      return {
        draft: null,
        degraded: true,
        errorKind: result.error.kind,
        message: aiErrorMessage(result.error),
      };
    }

    const raw = result.text;
    // Strip markdown fences in case the model adds them despite our instructions.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed: ReturnType<typeof DraftSchema.safeParse>;
    try {
      parsed = DraftSchema.safeParse(JSON.parse(cleaned));
    } catch (jsonErr) {
      console.error("[MelaAssist] generateVendorProfileDraft: Failed to parse AI response as JSON.", {
        provider: result.provider,
      });
      return {
        draft: null,
        degraded: true,
        message: "MelaAssist returned an unexpected response format — please try again.",
      };
    }

    if (!parsed.success) {
      console.error("[MelaAssist] generateVendorProfileDraft: response validation failed.");
      return {
        draft: null,
        degraded: true,
        message: "MelaAssist returned an unexpected response — please try again.",
      };
    }

    return { draft: parsed.data, degraded: false };
  });

/**
 * Save mapped columns to vendor_profiles.
 * Accepts both AI-draft fields and contact/business details.
 * Existing values are preserved unless the caller explicitly passes a value.
 */
export const SaveInput = z.object({
  // Core identity (AI-drafted)
  business_name: z.string().trim().min(1).max(200).optional(),
  business_category: z.string().trim().min(1).max(80).optional(),
  business_categories: z.array(z.string().trim().max(80)).max(20).optional(),
  custom_service_types: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  business_description: z.string().trim().max(4000).optional(),
  // Contact & location
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(200).optional(),
  website: z.string().trim().max(500).optional(),
  contact_visibility: z.object({
    phone: z.enum(["public", "private"]),
    email: z.enum(["public", "private"]),
    website: z.enum(["public", "private"]),
  }).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  zip_code: z.string().trim().max(20).optional(),
  business_address: z.string().trim().max(400).optional(),
  // Pricing & logistics
  starting_price: z.number().int().min(0).optional(),
  years_in_business: z.number().int().min(0).max(100).optional(),
  mobile_service: z.boolean().optional(),
  travel_radius: z.number().int().min(0).max(10000).optional(),
  // Media
  logo_url: z.string().trim().max(1000).optional(),
  // Photos with labels (portfolio, cover, backdrop, both)
  vendor_photos: z.array(z.object({
    url: z.string().max(1000),
    type: z.enum(["portfolio", "cover", "backdrop", "both"]),
  })).optional(),
  // Services stored as JSON string
  virtual_services: z.string().trim().max(10000).optional(),
  // Social links
  social_links: z.record(z.string()).optional(),
  // FAQs stored as JSONB
  faqs: z.array(z.object({
    question: z.string().max(500),
    answer: z.string().max(2000),
  })).optional(),
});

export const saveVendorProfileDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const updates: Record<string, unknown> = {};

    // Strings
    for (const k of [
      "business_name", "business_category", "business_description",
      "phone", "email", "website", "city", "state", "zip_code", "business_address",
      "logo_url", "virtual_services",
    ] as const) {
      const v = (data as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim().length > 0) updates[k] = v.trim();
    }
    // A supplied array is a replacement, including an intentional empty array.
    // Keep the legacy primary column synchronized when callers provide only one
    // side of the compatibility pair.
    if (Array.isArray(data.business_categories)) {
      const deduped = Array.from(
        new Map(
          data.business_categories
            .map((value) => value.trim())
            .filter(Boolean)
            .map((value) => [value.toLowerCase(), value] as const),
        ).values(),
      );
      updates.business_categories = deduped;
      if (data.business_category === undefined && deduped[0]) {
        updates.business_category = deduped[0];
      }
    } else if (data.business_category) {
      updates.business_categories = [data.business_category];
    }
    if (Array.isArray(data.custom_service_types)) {
      updates.custom_service_types = Array.from(
        new Map(
          data.custom_service_types
            .map((value) => value.trim())
            .filter(Boolean)
            .map((value) => [value.toLowerCase(), value] as const),
        ).values(),
      );
    }
    // Numbers
    if (data.starting_price != null) updates.starting_price = data.starting_price;
    if (data.years_in_business != null) updates.years_in_business = data.years_in_business;
    if (data.travel_radius != null) updates.travel_radius = data.travel_radius;
    // Booleans
    if (data.mobile_service != null) updates.mobile_service = data.mobile_service;
    // JSON
    if (data.social_links != null) updates.social_links = data.social_links;
    if (data.contact_visibility != null) updates.contact_visibility = data.contact_visibility;
    if (data.vendor_photos != null) updates.vendor_photos = data.vendor_photos;
    if (data.faqs != null) updates.faqs = data.faqs;

    if (Object.keys(updates).length === 0) return { saved: false };

    const { data: existing } = await supabase
      .from("vendor_profiles")
      .select("id, business_name, business_category")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("vendor_profiles").update(updates).eq("user_id", userId);
      if (error) {
        console.error("[saveVendorProfileDraft] update error:", error.message);
        throw new Error(error.message);
      }
    } else {
      const { error } = await supabase.from("vendor_profiles").insert({
        user_id: userId,
        business_name: (updates.business_name as string) ?? "New business",
        business_category: (updates.business_category as string) ?? "other",
        ...updates,
      });
      if (error) {
        console.error("[saveVendorProfileDraft] insert error:", error.message);
        throw new Error(error.message);
      }
    }
    // A profile save can make a vendor eligible for a previously unmatched
    // need. Matching is best-effort and never blocks the vendor's save.
    try {
      const { data: savedProfile } = await supabase
        .from("vendor_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (savedProfile?.id) {
        const { matchVendorDemandForVendor } = await import("@/lib/vendor-sourcing.functions");
        await matchVendorDemandForVendor(savedProfile.id);
      }
    } catch (error) {
      console.error("[saveVendorProfileDraft] vendor-demand matching failed", error instanceof Error ? error.message : "unknown error");
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
        "id, business_name, business_category, business_categories, custom_service_types, business_description, logo_url, portfolio_urls, vendor_photos, faqs, virtual_services, phone, email, website, contact_visibility, business_hours, starting_price, city, state, zip_code, business_address, social_links, travel_radius, onboarding_completed",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return { profile: null, completion: 0, missing: [] as string[], published: false };

    // Determine portfolio count from new vendor_photos system, falling back to legacy portfolio_urls
    const vendorPhotos = (data.vendor_photos as Array<{ url: string; type: string }> | null) ?? [];
    const portfolioCount = vendorPhotos.length > 0
      ? vendorPhotos.filter((p) => p.type === "portfolio" || p.type === "both").length
      : (Array.isArray(data.portfolio_urls) ? (data.portfolio_urls as string[]).length : 0);
    const { count: packageCount } = await supabase
      .from("vendor_packages")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", data.id)
      .eq("is_visible", true);

    const checks: Array<{ key: string; label: string; ok: boolean }> = [
      { key: "business_name",        label: "Business name",       ok: !!data.business_name },
      { key: "business_category",    label: "Category",            ok: !!data.business_category },
      { key: "business_description", label: "Business description", ok: !!data.business_description && data.business_description.length >= 40 },
      { key: "visible_package",      label: "At least one visible package", ok: (packageCount ?? 0) >= 1 },
      { key: "portfolio_photos",     label: "At least one portfolio photo", ok: portfolioCount >= 1 },
      { key: "city",                 label: "City",                ok: !!data.city },
    ];
    const total = checks.length;
    const passed = checks.filter((c) => c.ok).length;
    const completion = Math.round((passed / total) * 100);
    const missing = checks.filter((c) => !c.ok).map((c) => c.label);
    return {
      profile: data,
      completion,
      missing,
      published: data.onboarding_completed === true,
    };
  });

/**
 * Publish the calling vendor's listing after the same minimum profile checks
 * shown in the profile-strength UI. Publication is self-service; admin approval
 * is not part of the launch flow.
 */
export const publishVendorProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: profile, error: profileError } = await supabase
      .from("vendor_profiles")
      .select("id, business_name, business_category, portfolio_urls, vendor_photos, business_description, city")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("Create your vendor profile before publishing.");

    const vendorPhotos = (profile.vendor_photos as Array<{ url: string; type: string }> | null) ?? [];
    const portfolioCount = vendorPhotos.length > 0
      ? vendorPhotos.filter((p) => p.type === "portfolio" || p.type === "both").length
      : (Array.isArray(profile.portfolio_urls) ? profile.portfolio_urls.length : 0);
    const { count: packageCount, error: packageError } = await supabase
      .from("vendor_packages")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", profile.id)
      .eq("is_visible", true);
    if (packageError) throw new Error(packageError.message);
    const checks = [
      { label: "Business name", ok: !!profile.business_name },
      { label: "Category", ok: !!profile.business_category },
      { label: "Business description (40+ characters)", ok: (profile.business_description?.length ?? 0) >= 40 },
      { label: "At least one visible package", ok: (packageCount ?? 0) >= 1 },
      { label: "At least one portfolio photo", ok: portfolioCount >= 1 },
      { label: "City", ok: !!profile.city },
    ];
    const missing = checks.filter((check) => !check.ok).map((check) => check.label);
    if (missing.length > 0) {
      throw new Error(`Complete these before publishing: ${missing.join(", ")}.`);
    }

    const { error } = await supabase
      .from("vendor_profiles")
      .update({ onboarding_completed: true })
      .eq("id", profile.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { published: true };
  });
