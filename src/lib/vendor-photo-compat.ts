export type CompatibleVendorPhoto = {
  url: string;
  type: "portfolio" | "cover" | "backdrop" | "both";
};

export function mergeVendorPhotoSources(
  labeledPhotos: CompatibleVendorPhoto[],
  legacyPortfolioUrls: string[],
): CompatibleVendorPhoto[] {
  const existingUrls = new Set(labeledPhotos.map((photo) => photo.url).filter(Boolean));
  const merged: CompatibleVendorPhoto[] = [...labeledPhotos];

  for (const url of legacyPortfolioUrls) {
    if (!url || existingUrls.has(url)) continue;
    merged.push({ url, type: "portfolio" });
    existingUrls.add(url);
  }

  return merged;
}

export function countPortfolioPhotos(
  labeledPhotos: CompatibleVendorPhoto[],
  legacyPortfolioUrls: string[],
): number {
  return portfolioUrlsForSave(labeledPhotos, legacyPortfolioUrls).length;
}

export function portfolioUrlsForSave(
  photos: CompatibleVendorPhoto[],
  preservedLegacyUrls: Iterable<string>,
): string[] {
  const urls = new Set<string>();
  for (const url of preservedLegacyUrls) {
    if (url) urls.add(url);
  }
  for (const photo of photos) {
    if (photo.url && (photo.type === "portfolio" || photo.type === "both")) {
      urls.add(photo.url);
    }
  }
  return Array.from(urls).slice(0, 10);
}