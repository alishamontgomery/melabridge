export function normalizeMarketplaceSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Match every meaningful keyword against the combined searchable fields.
 * This lets "photo booth" match a category while also allowing a query such
 * as "Madison photography" to match across city and service fields.
 */
export function matchesMarketplaceKeywords(
  query: string | null | undefined,
  fields: Array<string | null | undefined>,
) {
  const normalizedQuery = normalizeMarketplaceSearchText(query);
  if (!normalizedQuery) return true;
  const searchableText = normalizeMarketplaceSearchText(fields.filter(Boolean).join(" "));
  return normalizedQuery.split(" ").every((keyword) => searchableText.includes(keyword));
}