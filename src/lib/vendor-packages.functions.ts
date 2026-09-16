import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getVendorCategories } from "@/lib/vendor-categories";

export type VendorPackage = {
  id: string;
  vendor_id: string;
  name: string;
  price_type: "fixed" | "starting_at" | "contact";
  price_cents: number | null;
  price_basis: "flat_rate" | "per_person" | "per_hour" | "per_event" | "per_item" | "custom_unit" | "custom_quote" | null;
  price_unit: string | null;
  description: string;
  inclusions: string[];
  duration: string;
  add_ons: string[];
  service_category: string | null;
  is_featured: boolean;
  sort_order: number;
  category_fields: Record<string, any>;
  photos: string[];
  is_visible: boolean;
  created_at: string;
  updated_at: string;
};

const PackageUpsertInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  price_type: z.enum(["fixed", "starting_at", "contact"]),
  price_cents: z.number().int().min(0).nullable(),
  price_basis: z.enum(["flat_rate", "per_person", "per_hour", "per_event", "per_item", "custom_unit", "custom_quote"]).nullable().optional(),
  price_unit: z.string().trim().max(60).nullable().optional(),
  description: z.string().trim().max(2000).default(""),
  inclusions: z.array(z.string().trim().max(200)).default([]),
  duration: z.string().trim().max(100).default(""),
  add_ons: z.array(z.string().trim().max(200)).default([]),
  is_featured: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  category_fields: z.record(z.any()).default({}),
  service_category: z.string().trim().max(80).nullable().default(null),
  photos: z.array(z.string().url()).max(3).default([]),
  is_visible: z.boolean().optional(),
});

function packagePhotoStoragePath(
  url: string,
  vendorId: string,
  packageId: string,
): string | null {
  try {
    const parsed = new URL(url);
    const expectedOrigin = process.env.SUPABASE_URL;
    if (!expectedOrigin || parsed.origin !== new URL(expectedOrigin).origin) return null;
    const prefix = "/storage/v1/object/public/vendor-assets/";
    if (!parsed.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(parsed.pathname.slice(prefix.length));
    return path.startsWith(`package-photos/${vendorId}/${packageId}/`) ? path : null;
  } catch {
    return null;
  }
}

async function processPackagePhotoCleanup(supabase: any, vendorId: string) {
  const [jobsResult, packagesResult] = await Promise.all([
    supabase
      .from("package_photo_cleanup_jobs")
      .select("id, storage_path, photo_url")
      .eq("vendor_id", vendorId),
    supabase
      .from("vendor_packages")
      .select("photos")
      .eq("vendor_id", vendorId),
  ]);
  if (jobsResult.error) throw new Error(jobsResult.error.message);
  if (packagesResult.error) throw new Error(packagesResult.error.message);
  const jobs = jobsResult.data;
  const packages = packagesResult.data;
  if (!jobs?.length) return;

  const activeUrls = new Set(
    (packages ?? []).flatMap((pkg: { photos: string[] | null }) => pkg.photos ?? []),
  );
  const staleJobIds = jobs
    .filter((job: { photo_url: string }) => activeUrls.has(job.photo_url))
    .map((job: { id: string }) => job.id);
  if (staleJobIds.length) {
    await supabase.from("package_photo_cleanup_jobs").delete().in("id", staleJobIds);
  }

  for (const job of jobs.filter(
    (item: { photo_url: string }) => !activeUrls.has(item.photo_url),
  )) {
    const { error } = await supabase.storage
      .from("vendor-assets")
      .remove([job.storage_path]);
    if (!error) {
      await supabase.from("package_photo_cleanup_jobs").delete().eq("id", job.id);
    }
  }
}

async function queuePhotoCleanup(
  supabase: any,
  vendorId: string,
  packageId: string,
  urls: string[],
) {
  const jobs = urls.flatMap((url) => {
    const storagePath = packagePhotoStoragePath(url, vendorId, packageId);
    return storagePath
      ? [{ vendor_id: vendorId, package_id: packageId, storage_path: storagePath, photo_url: url }]
      : [];
  });
  if (!jobs.length) return;
  const { error } = await supabase
    .from("package_photo_cleanup_jobs")
    .upsert(jobs, { onConflict: "vendor_id,storage_path" });
  if (error) throw new Error(error.message);
}

/** Return the calling vendor's backdrop photo URLs for the photo booth package builder.
 *  Reads from vendor_photos (type=backdrop or type=both) first; falls back to portfolio_urls. */
export const getVendorPortfolioUrls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ urls: string[] }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data } = await supabase
      .from("vendor_profiles")
      .select("portfolio_urls, vendor_photos")
      .eq("user_id", userId)
      .maybeSingle();

    // Prefer labeled backdrop images from the new vendor_photos column
    const vendorPhotos = (data?.vendor_photos as Array<{ url: string; type: string }> | null) ?? [];
    const backdropUrls = vendorPhotos
      .filter((p) => p.type === "backdrop" || p.type === "both")
      .map((p) => p.url);
    if (backdropUrls.length > 0) return { urls: backdropUrls };

    // Fallback: legacy portfolio_urls (all treated as potential backdrops)
    return { urls: (data?.portfolio_urls as string[] | null) ?? [] };
  });

/** Return the calling vendor's service categories (used by package creation/editing). */
export const getVendorCategory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    category: string | null;
    categories: string[];
    vendorId: string | null;
  }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data } = await supabase
      .from("vendor_profiles")
      .select("id, business_category, business_categories")
      .eq("user_id", userId)
      .maybeSingle();
    const { getVendorCategories } = await import("@/lib/vendor-categories");
    return {
      category: data?.business_category ?? null,
      categories: getVendorCategories(data ?? {}),
      vendorId: data?.id ?? null,
    };
  });

/** Return all packages for the calling vendor, ordered by sort_order. */
export const listVendorPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VendorPackage[]> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: vp } = await supabase
      .from("vendor_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!vp) return [];
    await processPackagePhotoCleanup(supabase, vp.id);
    const { data, error } = await supabase
      .from("vendor_packages")
      .select("*")
      .eq("vendor_id", vp.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      ...row,
      category_fields: row.category_fields ?? {},
      photos: row.photos ?? [],
    })) as VendorPackage[];
  });

/** Create or update a package. */
export const upsertVendorPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => PackageUpsertInput.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: vp } = await supabase
      .from("vendor_profiles")
      .select("id, business_category, business_categories")
      .eq("user_id", userId)
      .maybeSingle();
    if (!vp) throw new Error("No vendor profile found");

    if (data.service_category) {
      const allowedCategories = getVendorCategories(vp);
      const belongsToVendor = allowedCategories.some(
        (category) => category.toLowerCase() === data.service_category!.toLowerCase(),
      );
      if (!belongsToVendor) {
        throw new Error("Choose a service category from your vendor profile.");
      }
    }

    if (data.photos.length > 0 && !data.id) {
      throw new Error("Create the package before attaching photos");
    }
    if (
      data.id &&
      data.photos.some((url) => !packagePhotoStoragePath(url, vp.id, data.id!))
    ) {
      throw new Error("Package photos must belong to this package");
    }

    const now = new Date().toISOString();
    const payload = {
      vendor_id: vp.id,
      name: data.name,
      price_type: data.price_type,
      price_cents: data.price_cents,
      ...(data.price_basis !== undefined ? { price_basis: data.price_basis } : {}),
      ...(data.price_unit !== undefined ? { price_unit: data.price_unit } : {}),
      description: data.description,
      inclusions: data.inclusions,
      duration: data.duration,
      add_ons: data.add_ons,
      is_featured: data.is_featured,
      sort_order: data.sort_order,
      category_fields: data.category_fields,
      service_category: data.service_category,
      photos: data.photos,
      ...(data.is_visible !== undefined ? { is_visible: data.is_visible } : (!data.id ? { is_visible: true } : {})),
      updated_at: now,
    };

    // Enforce single-featured invariant: if this package is being featured,
    // unfeature every other package for this vendor first.
    if (data.is_featured) {
      const unfeatQuery = supabase
        .from("vendor_packages" as any)
        .update({ is_featured: false, updated_at: now })
        .eq("vendor_id", vp.id)
        .eq("is_featured", true);
      // Exclude the package being updated so we don't race-unfeature it.
      if (data.id) unfeatQuery.neq("id", data.id);
      await unfeatQuery;
    }

    if (data.id) {
      const { data: existing, error: existingError } = await supabase
        .from("vendor_packages")
        .select("photos")
        .eq("id", data.id)
        .eq("vendor_id", vp.id)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (!existing) throw new Error("Package not found");

      const removedUrls = ((existing.photos as string[] | null) ?? [])
        .filter((url) => !data.photos.includes(url));
      await queuePhotoCleanup(supabase, vp.id, data.id, removedUrls);

      const { error } = await supabase
        .from("vendor_packages" as any)
        .update(payload)
        .eq("id", data.id)
        .eq("vendor_id", vp.id);
      if (error) throw new Error(error.message);

      await processPackagePhotoCleanup(supabase, vp.id);
      return { id: data.id };
    } else {
      const { data: created, error } = await supabase
        .from("vendor_packages" as any)
        .insert({ ...payload, created_at: now })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: created.id };
    }
  });

/** Delete a package. */
export const deleteVendorPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: vp } = await supabase
      .from("vendor_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!vp) throw new Error("No vendor profile found");

    const { data: existing, error: existingError } = await supabase
      .from("vendor_packages")
      .select("photos")
      .eq("id", data.id)
      .eq("vendor_id", vp.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("Package not found");

    await queuePhotoCleanup(
      supabase,
      vp.id,
      data.id,
      (existing.photos as string[] | null) ?? [],
    );

    const { error } = await supabase
      .from("vendor_packages")
      .delete()
      .eq("id", data.id)
      .eq("vendor_id", vp.id);
    if (error) throw new Error(error.message);
    await processPackagePhotoCleanup(supabase, vp.id);
    return { deleted: true };
  });

/** Queue uploaded objects for durable cleanup after a failed package save. */
export const queuePackagePhotoCleanup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({
      packageId: z.string().uuid(),
      urls: z.array(z.string().url()).max(3),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: vp } = await supabase
      .from("vendor_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!vp) throw new Error("No vendor profile found");
    const { data: pkg } = await supabase
      .from("vendor_packages")
      .select("id")
      .eq("id", data.packageId)
      .eq("vendor_id", vp.id)
      .maybeSingle();
    if (!pkg) throw new Error("Package not found");
    await queuePhotoCleanup(supabase, vp.id, data.packageId, data.urls);
    await processPackagePhotoCleanup(supabase, vp.id);
    return { queued: true };
  });

/** Reorder packages by assigning sort_order based on the provided id order. */
export const reorderVendorPackages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ orderedIds: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: vp } = await supabase
      .from("vendor_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!vp) throw new Error("No vendor profile found");
    const now = new Date().toISOString();
    await Promise.all(
      data.orderedIds.map((id, idx) =>
        supabase
          .from("vendor_packages")
          .update({ sort_order: idx, updated_at: now })
          .eq("id", id)
          .eq("vendor_id", vp.id),
      ),
    );
    return { reordered: true };
  });
