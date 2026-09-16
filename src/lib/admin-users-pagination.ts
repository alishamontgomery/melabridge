export const ADMIN_USERS_PAGE_SIZE = 500;

export async function collectAdminUserPages<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const data: T[] = [];

  for (let from = 0; ; from += ADMIN_USERS_PAGE_SIZE) {
    const page = await fetchPage(from, from + ADMIN_USERS_PAGE_SIZE - 1);
    if (page.error) return { data: [], error: page.error };
    const rows = page.data ?? [];
    data.push(...rows);
    if (rows.length < ADMIN_USERS_PAGE_SIZE) return { data, error: null };
  }
}