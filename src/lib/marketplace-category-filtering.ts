import {
  formatCategoryFieldSummary,
  getCategorySpec,
  type CatFieldDef,
} from "@/lib/vendor-category-fields";

export type CategoryFilterValue = number | string[] | boolean;
export type CategoryFilters = Record<string, CategoryFilterValue>;

export type PackageWithCategoryFields = {
  service_category: string | null;
  category_fields: Record<string, unknown> | null;
};

export const hasCategoryDetails = (filters: CategoryFilters): boolean =>
  Object.keys(filters).length > 0;

export async function loadAllMarketplacePackages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 500,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export function getPackageSpecChips(
  packages: PackageWithCategoryFields[],
  fallbackCategory: string | null,
): string[] {
  const summaryPackage = packages.find(
    (pkg) => Object.keys(pkg.category_fields ?? {}).length > 0,
  );
  const spec = getCategorySpec(summaryPackage?.service_category ?? fallbackCategory);
  return summaryPackage && spec
    ? formatCategoryFieldSummary(summaryPackage.category_fields ?? {}, spec)
    : [];
}

export function shouldShowExternalFallback(
  tab: "all" | "favorites" | "recent",
  nativeCount: number,
  externalCount: number,
  categoryDetailsActive: boolean,
): boolean {
  return tab === "all" && !categoryDetailsActive && nativeCount < 6 && externalCount > 0;
}

export function removeCategoryFilter(filters: CategoryFilters, key: string): CategoryFilters {
  const next = { ...filters };
  delete next[key];
  return next;
}

export function matchesCategoryFilters(
  fields: Record<string, unknown>,
  filters: CategoryFilters,
): boolean {
  return Object.entries(filters).every(([key, expected]) => {
    const actual = fields[key];
    if (typeof expected === "number") {
      const numeric = Number(actual);
      if (!Number.isFinite(numeric)) return false;
      if (key === "min_guests") return numeric <= expected;
      return numeric >= expected;
    }
    if (typeof expected === "boolean") return actual === expected;
    const actualValues = Array.isArray(actual) ? actual.map(String) : [];
    return expected.every((value) => actualValues.includes(value));
  });
}

export function formatActiveCategoryFilter(
  field: CatFieldDef,
  value: CategoryFilterValue,
): string {
  if (typeof value === "boolean") return field.label;
  if (Array.isArray(value)) return `${field.label}: ${value.join(", ")}`;
  const suffix = field.suffix ? ` ${field.suffix}` : "";
  if (
    field.key === "max_guests" ||
    field.key === "passenger_capacity" ||
    field.key === "num_servings"
  ) {
    return `${field.label}: ${value}+${suffix}`;
  }
  return `${field.label}: ${value}${suffix}`;
}