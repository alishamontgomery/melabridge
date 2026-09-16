import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DeleteVendorBusinessInput = z.object({
  confirmation: z.literal("DELETE BUSINESS"),
});

function storagePathFromPublicUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const configuredOrigin = process.env.SUPABASE_URL;
    if (!configuredOrigin || parsed.origin !== new URL(configuredOrigin).origin) return null;
    const prefix = "/storage/v1/object/public/vendor-assets/";
    if (!parsed.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(parsed.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

async function listStorageFiles(storage: any, folder: string): Promise<string[]> {
  const { data, error } = await storage.list(folder, { limit: 1000, offset: 0 });
  if (error) throw new Error("We couldn't prepare the business files for deletion.");

  const paths: string[] = [];
  for (const item of data ?? []) {
    const path = `${folder}/${item.name}`;
    // Supabase Storage represents folders with a null id. Recurse only into
    // folders inside this vendor-owned namespace.
    if (item.id == null) {
      paths.push(...await listStorageFiles(storage, path));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

async function removeStorageFiles(storage: any, paths: string[]) {
  for (let index = 0; index < paths.length; index += 100) {
    const batch = paths.slice(index, index + 100);
    if (!batch.length) continue;
    const { error } = await storage.remove(batch);
    if (error) throw new Error("We couldn't remove all business files safely. Nothing else was deleted.");
  }
}

/**
 * Permanently removes only the signed-in user's vendor business.
 *
 * This intentionally does not delete profiles, user_roles, Clerk identities,
 * personal events, or personal workspace data. The vendor role remains in
 * place so the account can be re-onboarded as a vendor later if needed.
 */
export const deleteVendorBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => DeleteVendorBusinessInput.parse(input))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const userId = (context as { userId: string }).userId;
    const storage = admin.storage.from("vendor-assets");

    const { data: vendor, error: vendorError } = await admin
      .from("vendor_profiles")
      .select("id, logo_url, portfolio_urls, vendor_photos")
      .eq("user_id", userId)
      .maybeSingle();
    if (vendorError) throw new Error("We couldn't verify your vendor business.");
    if (!vendor) throw new Error("No vendor business was found to delete.");

    const { data: packages, error: packageError } = await admin
      .from("vendor_packages")
      .select("photos")
      .eq("vendor_id", vendor.id);
    if (packageError) throw new Error("We couldn't verify your business packages.");

    // Remove only files in vendor-owned folders. The URL list covers legacy
    // references; folder listing catches orphaned uploads from interrupted saves.
    const referencedPaths = [
      vendor.logo_url,
      ...(Array.isArray(vendor.portfolio_urls) ? vendor.portfolio_urls : []),
      ...(Array.isArray(vendor.vendor_photos) ? vendor.vendor_photos.map((photo: { url?: string }) => photo.url) : []),
      ...(packages ?? []).flatMap((pkg: { photos?: string[] | null }) => pkg.photos ?? []),
    ]
      .filter((value): value is string => typeof value === "string")
      .map(storagePathFromPublicUrl)
      .filter((value): value is string => Boolean(value));

    const folderPaths = await Promise.all([
      listStorageFiles(storage, `logos/${userId}`),
      listStorageFiles(storage, `photos/${userId}`),
      listStorageFiles(storage, `package-photos/${vendor.id}`),
    ]);
    const paths = [...new Set([...referencedPaths, ...folderPaths.flat()])];
    await removeStorageFiles(storage, paths);

    const { error: deleteError } = await admin
      .from("vendor_profiles")
      .delete()
      .eq("id", vendor.id)
      .eq("user_id", userId);
    if (deleteError) {
      console.error("[vendor-business-delete] database delete failed:", deleteError.message);
      throw new Error("We couldn't delete the business safely. Nothing else was changed.");
    }

    console.info("[vendor-business-delete] deleted vendor business");
    return { deleted: true };
  });