import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({ upsert })),
  },
}));

import { migrateLegacyMarketplaceFavorites } from "./marketplace-prefs";

function storageWith(initial: Record<string, string>) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
}

describe("legacy marketplace favorite migration", () => {
  beforeEach(() => {
    upsert.mockReset();
    upsert.mockResolvedValue({ error: null });
  });

  it("merges unique local favorites with conflict-ignore semantics", async () => {
    const storage = storageWith({
      "mb.marketplace.favorites.v1": JSON.stringify(["vendor-1", "vendor-1", "vendor-2"]),
    });

    await migrateLegacyMarketplaceFavorites("user-1", [], storage);

    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ entity_id: "vendor-1", user_id: "user-1" }),
        expect.objectContaining({ entity_id: "vendor-2", user_id: "user-1" }),
      ]),
      {
        onConflict: "user_id,entity_type,entity_id",
        ignoreDuplicates: true,
      },
    );
    expect(upsert.mock.calls[0][0]).toHaveLength(2);
    expect(storage.removeItem).toHaveBeenCalledWith("mb.marketplace.favorites.v1");
    expect(storage.setItem).toHaveBeenCalledWith("mb.marketplace.favorites.db-migrated.v1", "1");
  });

  it("preserves local favorites and does not mark a failed migration complete", async () => {
    const storage = storageWith({
      "mb.marketplace.favorites.v1": JSON.stringify(["vendor-1"]),
    });
    upsert.mockResolvedValue({ error: new Error("insert failed") });

    await expect(migrateLegacyMarketplaceFavorites("user-1", [], storage)).rejects.toThrow("insert failed");

    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("can migrate new guest favorites after the device marker is reset", async () => {
    const storage = storageWith({
      "mb.marketplace.favorites.db-migrated.v1": "1",
      "mb.marketplace.favorites.v1": JSON.stringify(["vendor-2"]),
    });

    await expect(migrateLegacyMarketplaceFavorites("user-1", [], storage)).resolves.toBe(false);
    expect(upsert).not.toHaveBeenCalled();

    storage.removeItem("mb.marketplace.favorites.db-migrated.v1");
    await migrateLegacyMarketplaceFavorites("user-1", [], storage);

    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert.mock.calls[0][0][0]).toEqual(expect.objectContaining({ entity_id: "vendor-2" }));
  });
});