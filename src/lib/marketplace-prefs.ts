import { useCallback, useEffect, useState } from "react";

const FAV_KEY = "mb.marketplace.favorites.v1";
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
