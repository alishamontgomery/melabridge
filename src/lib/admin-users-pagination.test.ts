import { describe, expect, it, vi } from "vitest";
import { ADMIN_USERS_PAGE_SIZE, collectAdminUserPages } from "./admin-users-pagination";

describe("collectAdminUserPages", () => {
  it("continues past the 500-row API cap", async () => {
    const source = Array.from({ length: 1_201 }, (_, id) => ({ id }));
    const fetchPage = vi.fn(async (from: number, to: number) => ({
      data: source.slice(from, to + 1),
      error: null,
    }));

    const result = await collectAdminUserPages(fetchPage);

    expect(result.error).toBeNull();
    expect(result.data).toEqual(source);
    expect(fetchPage.mock.calls).toEqual([
      [0, ADMIN_USERS_PAGE_SIZE - 1],
      [ADMIN_USERS_PAGE_SIZE, ADMIN_USERS_PAGE_SIZE * 2 - 1],
      [ADMIN_USERS_PAGE_SIZE * 2, ADMIN_USERS_PAGE_SIZE * 3 - 1],
    ]);
  });

  it("fetches the empty page after an exact multiple of the cap", async () => {
    const source = Array.from({ length: 1_000 }, (_, id) => ({ id }));
    const fetchPage = vi.fn(async (from: number, to: number) => ({
      data: source.slice(from, to + 1),
      error: null,
    }));

    const result = await collectAdminUserPages(fetchPage);

    expect(result.data).toHaveLength(1_000);
    expect(fetchPage).toHaveBeenLastCalledWith(1_000, 1_499);
  });

  it("fails without returning a silently truncated dataset", async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({
        data: Array.from({ length: ADMIN_USERS_PAGE_SIZE }, (_, id) => ({ id })),
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: new Error("database unavailable") });

    const result = await collectAdminUserPages(fetchPage);

    expect(result.data).toEqual([]);
    expect(result.error).toBeInstanceOf(Error);
  });
});