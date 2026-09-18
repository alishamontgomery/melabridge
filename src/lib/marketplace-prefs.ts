import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FAV_KEY = "mb.marketplace.favorites.v1";
const FAV_MIGRATION_KEY = "mb.marketplace.favorites.db-migrated.v1";
const CMP_KEY = "mb.marketplace.compare.v1";
const RV_KEY = "mb.marketplace.recent.v1";
const MAX_COMPARE = 4;
const MAX_RECENT = 8;

function safeRead(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed.filter((v) => typeof v === "string") as string[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(key: string, value: string[]) {
  if (typeof window === "undefined") return;
  try {
    if (key === FAV_KEY) window.localStorage.removeItem(FAV_MIGRATION_KEY);
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new StorageEvent("storage", { key }));
  } catch {
    /* ignore quota / private mode */
  }
}

function useLocalList(key: string, cap?: number) {
  const [list, setList] = useState<string[]>(() => safeRead(key));

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) setList(safeRead(key));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const update = useCallback(
    (next: string[]) => {
      const bounded = cap ? next.slice(0, cap) : next;
      setList(bounded);
      safeWrite(key, bounded);
    },
    [key, cap],
  );

  return [list, update] as const;
}

export function useFavorites() {
  const [list, setList] = useLocalList(FAV_KEY);
  const has = useCallback((id: string) => list.includes(id), [list]);
  const toggle = useCallback(
    (id: string) => setList(list.includes(id) ? list.filter((x) => x !== id) : [id, ...list]),
    [list, setList],
  );
  const clear = useCallback(() => setList([]), [setList]);
  return { list, has, toggle, clear };
}

// ── Vendor lookup shape (subset of VendorRow used by marketplace) ─────────────
type VendorLike = {
  id: string;
  business_name?: string | null;
  business_category?: string | null;
  business_categories?: string[] | null;
};

export async function migrateLegacyMarketplaceFavorites(
  userId: string,
  vendors: VendorLike[],
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
) {
  if (storage.getItem(FAV_MIGRATION_KEY)) return false;

  const raw = storage.getItem(FAV_KEY);
  let legacyIds: string[] = [];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    legacyIds = Array.isArray(parsed)
      ? Array.from(new Set(parsed.filter((value): value is string => typeof value === "string")))
      : [];
  } catch {
    legacyIds = [];
  }

  if (legacyIds.length > 0) {
    const rows = legacyIds.map((vendorId) => {
      const vendor = vendors.find((candidate) => candidate.id === vendorId);
      return {
        user_id: userId,
        entity_type: "vendor",
        entity_id: vendorId,
        title: vendor?.business_name ?? vendorId,
        subtitle: [vendor?.business_category, ...(vendor?.business_categories ?? [])]
          .filter(Boolean)
          .filter((value, index, values) => values.indexOf(value) === index)
          .join(", ") || null,
        href: `/vendor-profile/${vendorId}`,
      };
    });
    const { error } = await supabase
      .from("search_favorites")
      .upsert(rows, {
        onConflict: "user_id,entity_type,entity_id",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }

  storage.removeItem(FAV_KEY);
  storage.setItem(FAV_MIGRATION_KEY, "1");
  return true;
}

/**
 * DB-backed favorites for the Marketplace page.
 * - Authenticated users: reads/writes to the `search_favorites` table (persists across devices).
 * - Unauthenticated users: falls back to localStorage so the page stays functional.
 *
 * The `toggle(id)` signature is kept the same as the old useFavorites() so
 * callers don't need to change. Pass `vendors` so the hook can look up the
 * vendor's name/category when writing a new DB row.
 */
export function useMarketplaceFavorites(
  userId: string | undefined,
  vendors: VendorLike[],
) {
  const qc = useQueryClient();
  const QUERY_KEY = useMemo(() => ["marketplace-favorites", userId], [userId]);

  // ── DB path (authenticated) ─────────────────────────────────────────────────
  const { data: dbIds = [], isLoading: dbLoading } = useQuery({
    queryKey: QUERY_KEY,
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("search_favorites")
        .select("entity_id")
        .eq("user_id", userId!)
        .eq("entity_type", "vendor");
      if (error) throw error;
      return (data ?? []).map((r) => r.entity_id);
    },
  });

  const addMut = useMutation({
    mutationFn: async (vendorId: string) => {
      const v = vendors.find((x) => x.id === vendorId);
      const { error } = await supabase.from("search_favorites").upsert(
        {
          user_id: userId!,
          entity_type: "vendor",
          entity_id: vendorId,
          title: v?.business_name ?? vendorId,
          subtitle: [v?.business_category, ...(v?.business_categories ?? [])].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ") || null,
          href: `/vendor-profile/${vendorId}`,
        },
        { onConflict: "user_id,entity_type,entity_id" },
      );
      if (error) throw error;
    },
    onMutate: async (vendorId) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<string[]>(QUERY_KEY) ?? [];
      qc.setQueryData<string[]>(QUERY_KEY, [vendorId, ...prev]);
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev);
      toast.error("Couldn't save favorite");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const removeMut = useMutation({
    mutationFn: async (vendorId: string) => {
      const { error } = await supabase
        .from("search_favorites")
        .delete()
        .eq("user_id", userId!)
        .eq("entity_type", "vendor")
        .eq("entity_id", vendorId);
      if (error) throw error;
    },
    onMutate: async (vendorId) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<string[]>(QUERY_KEY) ?? [];
      qc.setQueryData<string[]>(QUERY_KEY, prev.filter((id) => id !== vendorId));
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev);
      toast.error("Couldn't remove favorite");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  // ── localStorage path (unauthenticated) ────────────────────────────────────
  const [localList, setLocalList] = useLocalList(FAV_KEY);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    let cancelled = false;

    const migrateLegacyFavorites = async () => {
      const migrated = await migrateLegacyMarketplaceFavorites(userId, vendors, window.localStorage);
      if (cancelled) return;
      if (!migrated) return;
      setLocalList([]);
      await qc.invalidateQueries({ queryKey: QUERY_KEY });
    };

    void migrateLegacyFavorites().catch(() => {
      // Keep the legacy entries so a later marketplace visit can retry.
    });

    return () => {
      cancelled = true;
    };
  }, [userId, vendors, qc, QUERY_KEY, setLocalList]);

  // ── Unified interface ───────────────────────────────────────────────────────
  const list = userId ? dbIds : localList;

  const has = useCallback((id: string) => list.includes(id), [list]);

  const toggle = useCallback(
    (id: string) => {
      if (!userId) {
        // localStorage path
        setLocalList(localList.includes(id) ? localList.filter((x) => x !== id) : [id, ...localList]);
        return;
      }
      if (dbIds.includes(id)) {
        removeMut.mutate(id);
      } else {
        addMut.mutate(id);
      }
    },
    [userId, dbIds, localList, setLocalList, addMut, removeMut],
  );

  const clear = useCallback(() => {
    if (!userId) {
      setLocalList([]);
      return;
    }
    // Remove all current favorites one by one via optimistic batch
    dbIds.forEach((id) => removeMut.mutate(id));
  }, [userId, dbIds, setLocalList, removeMut]);

  return { list, has, toggle, clear, isLoading: userId ? dbLoading : false };
}

export function useCompare() {
  const [list, setList] = useLocalList(CMP_KEY, MAX_COMPARE);
  const has = useCallback((id: string) => list.includes(id), [list]);
  const toggle = useCallback(
    (id: string) => {
      if (list.includes(id)) setList(list.filter((x) => x !== id));
      else if (list.length >= MAX_COMPARE) return "full" as const;
      else setList([...list, id]);
      return undefined;
    },
    [list, setList],
  );
  const remove = useCallback((id: string) => setList(list.filter((x) => x !== id)), [list, setList]);
  const clear = useCallback(() => setList([]), [setList]);
  return { list, has, toggle, remove, clear, max: MAX_COMPARE };
}

export function useRecentlyViewed() {
  const [list, setList] = useLocalList(RV_KEY, MAX_RECENT);
  const push = useCallback(
    (id: string) => setList([id, ...list.filter((x) => x !== id)]),
    [list, setList],
  );
  return { list, push };
}
