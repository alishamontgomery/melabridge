export const VENDOR_OFFER_CATEGORIES = [
  "Photography", "Videography", "Photo Booth", "DJ", "MC/Host",
  "Venue", "Catering", "Food Truck", "Cake & Desserts", "Bartending",
  "Florist", "Balloon Decor", "Event Decor", "Rentals", "Event Planner",
  "Officiant", "Transportation/Limo", "Security", "Entertainment",
  "Hair & Makeup", "Invitations/Stationery", "Other",
] as const;

type VendorCategoryFields = {
  business_category?: string | null;
  business_categories?: string[] | null;
  custom_service_types?: string[] | null;
};

/** Returns one deduplicated service list, with legacy single-category data included. */
export function getVendorCategories(vendor: VendorCategoryFields): string[] {
  const categories = Array.isArray(vendor.business_categories)
    ? vendor.business_categories.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const primary = vendor.business_category?.trim();
  if (primary && !categories.some((category) => category.toLowerCase() === primary.toLowerCase())) {
    categories.unshift(primary);
  }
  return Array.from(new Map(categories.map((category) => [category.toLowerCase(), category])).values());
}

export function getPrimaryVendorCategory(vendor: VendorCategoryFields): string | null {
  return vendor.business_category?.trim() || getVendorCategories(vendor)[0] || null;
}

/** All searchable service names, including vendor-entered specialties. */
export function getVendorServiceTypes(vendor: VendorCategoryFields): string[] {
  const values = [
    ...getVendorCategories(vendor),
    ...(Array.isArray(vendor.custom_service_types) ? vendor.custom_service_types : []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  return Array.from(new Map(values.map((value) => [value.toLowerCase(), value])).values());
}

export function vendorOffersCategory(vendor: VendorCategoryFields, requested: string | null | undefined): boolean {
  const query = requested?.trim().toLowerCase();
  if (!query) return true;
  return getVendorServiceTypes(vendor).some((category) => {
    const normalized = category.toLowerCase();
    return normalized === query || normalized.includes(query) || query.includes(normalized);
  });
}