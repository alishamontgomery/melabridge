import { useEffect, useState } from "react";

const FAV_KEY = "melabridge.inspiration.favorites.v1";
const BOARD_KEY = "melabridge.inspiration.board.v1";
const NOTES_KEY = "melabridge.inspiration.notes.v1";

type SetOp = "add" | "remove" | "toggle";

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, s: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(Array.from(s)));
  window.dispatchEvent(new CustomEvent("inspiration:changed", { detail: { key } }));
}

function readNotes(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(NOTES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function useInspirationStorage() {
  const [favorites, setFavorites] = useState<Set<string>>(() => readSet(FAV_KEY));
  const [board, setBoard] = useState<Set<string>>(() => readSet(BOARD_KEY));
  const [notes, setNotes] = useState<Record<string, string>>(() => readNotes());

  useEffect(() => {
    const onChange = () => {
      setFavorites(readSet(FAV_KEY));
      setBoard(readSet(BOARD_KEY));
      setNotes(readNotes());
    };
    window.addEventListener("inspiration:changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("inspiration:changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const mutate = (key: string, id: string, op: SetOp) => {
    const s = readSet(key);
    if (op === "add") s.add(id);
    else if (op === "remove") s.delete(id);
    else s.has(id) ? s.delete(id) : s.add(id);
    writeSet(key, s);
  };

  return {
    favorites,
    board,
    notes,
    toggleFavorite: (id: string) => mutate(FAV_KEY, id, "toggle"),
    toggleSaved: (id: string) => mutate(BOARD_KEY, id, "toggle"),
    setNote: (id: string, text: string) => {
      const next = { ...readNotes(), [id]: text };
      if (!text) delete next[id];
      window.localStorage.setItem(NOTES_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("inspiration:changed", { detail: { key: NOTES_KEY } }));
    },
  };
}
