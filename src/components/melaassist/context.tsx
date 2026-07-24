import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/use-role";
import type {
  MelaAssistAction,
  MelaAssistContextInfo,
  MelaAssistHistoryEntry,
  MelaAssistMemory,
  MelaAssistRole,
} from "./types";

type MelaAssistState = {
  open: boolean;
  openAssistant: (opts?: { initialPrompt?: string; task?: string }) => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  initialPrompt: string | null;
  consumeInitialPrompt: () => string | null;
  context: MelaAssistContextInfo;

  // Workspace memory (session-scoped)
  memory: MelaAssistMemory;
  setMemory: (patch: Partial<MelaAssistMemory>) => void;
  clearMemory: () => void;

  // Action history (session-scoped, capped)
  history: MelaAssistHistoryEntry[];
  recordHistory: (entry: Omit<MelaAssistHistoryEntry, "id" | "at">) => void;
  clearHistory: () => void;

  // Ambient action registration (from outside the panel, rarely used)
  pendingActions: MelaAssistAction[];
  queueAction: (action: MelaAssistAction) => void;
  consumePendingActions: () => MelaAssistAction[];
};

const MelaAssistContext = createContext<MelaAssistState | null>(null);

const MAX_HISTORY = 25;

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function MelaAssistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { role } = useRole();
  const [open, setOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const [memory, setMemoryState] = useState<MelaAssistMemory>({});
  const [history, setHistory] = useState<MelaAssistHistoryEntry[]>([]);
  const [pendingActions, setPendingActions] = useState<MelaAssistAction[]>([]);

  // Reactive pathname so context reflects client-side navigation
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.pathname : "/",
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", update);
    // Detect programmatic navigations by polling briefly on route change signals.
    const id = window.setInterval(() => {
      if (window.location.pathname !== pathname) update();
    }, 750);
    return () => {
      window.removeEventListener("popstate", update);
      window.clearInterval(id);
    };
  }, [pathname]);

  // Clear session-scoped state on sign-out.
  useEffect(() => {
    if (!user) {
      setMemoryState({});
      setHistory([]);
      setPendingActions([]);
    }
  }, [user]);

  const openAssistant = useCallback((opts?: { initialPrompt?: string; task?: string }) => {
    if (opts?.initialPrompt) setInitialPrompt(opts.initialPrompt);
    if (opts?.task) setMemoryState((m) => ({ ...m, currentTask: opts.task }));
    setOpen(true);
  }, []);
  const closeAssistant = useCallback(() => setOpen(false), []);
  const toggleAssistant = useCallback(() => setOpen((v) => !v), []);
  const consumeInitialPrompt = useCallback(() => {
    const p = initialPrompt;
    setInitialPrompt(null);
    return p;
  }, [initialPrompt]);

  const setMemory = useCallback((patch: Partial<MelaAssistMemory>) => {
    setMemoryState((m) => ({ ...m, ...patch }));
  }, []);
  const clearMemory = useCallback(() => setMemoryState({}), []);

  const recordHistory = useCallback((entry: Omit<MelaAssistHistoryEntry, "id" | "at">) => {
    setHistory((prev) =>
      [{ id: makeId(), at: Date.now(), ...entry }, ...prev].slice(0, MAX_HISTORY),
    );
  }, []);
  const clearHistory = useCallback(() => setHistory([]), []);

  const queueAction = useCallback((action: MelaAssistAction) => {
    setPendingActions((prev) => [...prev, action]);
  }, []);
  const consumePendingActions = useCallback(() => {
    const list = pendingActions;
    setPendingActions([]);
    return list;
  }, [pendingActions]);

  const context = useMemo<MelaAssistContextInfo>(() => {
    const eventMatch = pathname.match(/\/events\/([^/]+)/);
    return {
      userId: user?.id ?? null,
      role: (user ? (role as MelaAssistRole) : "guest"),
      pathname,
      eventId: memory.currentEventId ?? eventMatch?.[1] ?? null,
      vendorId: memory.currentVendorId ?? null,
      organizationId: null,
    };
  }, [user, role, pathname, memory.currentEventId, memory.currentVendorId]);

  const value: MelaAssistState = {
    open,
    openAssistant,
    closeAssistant,
    toggleAssistant,
    initialPrompt,
    consumeInitialPrompt,
    context,
    memory,
    setMemory,
    clearMemory,
    history,
    recordHistory,
    clearHistory,
    pendingActions,
    queueAction,
    consumePendingActions,
  };

  return <MelaAssistContext.Provider value={value}>{children}</MelaAssistContext.Provider>;
}

export function useMelaAssist(): MelaAssistState {
  const ctx = useContext(MelaAssistContext);
  if (!ctx) throw new Error("useMelaAssist must be used within <MelaAssistProvider />");
  return ctx;
}

/** Safe variant that returns null if provider isn't mounted (e.g. public pages). */
export function useMelaAssistOptional(): MelaAssistState | null {
  return useContext(MelaAssistContext);
}
