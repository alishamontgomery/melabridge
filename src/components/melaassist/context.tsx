import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/use-role";
import type { MelaAssistContextInfo, MelaAssistRole } from "./types";

type MelaAssistState = {
  open: boolean;
  openAssistant: (opts?: { initialPrompt?: string }) => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  initialPrompt: string | null;
  consumeInitialPrompt: () => string | null;
  context: MelaAssistContextInfo;
};

const MelaAssistContext = createContext<MelaAssistState | null>(null);

export function MelaAssistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { role } = useRole();
  const [open, setOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const openAssistant = useCallback((opts?: { initialPrompt?: string }) => {
    if (opts?.initialPrompt) setInitialPrompt(opts.initialPrompt);
    setOpen(true);
  }, []);
  const closeAssistant = useCallback(() => setOpen(false), []);
  const toggleAssistant = useCallback(() => setOpen((v) => !v), []);
  const consumeInitialPrompt = useCallback(() => {
    setInitialPrompt((p) => {
      return p;
    });
    const p = initialPrompt;
    setInitialPrompt(null);
    return p;
  }, [initialPrompt]);

  const context = useMemo<MelaAssistContextInfo>(() => {
    const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
    const eventMatch = pathname.match(/\/events\/([^/]+)/);
    return {
      userId: user?.id ?? null,
      role: (user ? (role as MelaAssistRole) : "guest"),
      pathname,
      eventId: eventMatch?.[1] ?? null,
    };
  }, [user, role, open]); // include `open` so context refreshes when opening

  const value: MelaAssistState = {
    open,
    openAssistant,
    closeAssistant,
    toggleAssistant,
    initialPrompt,
    consumeInitialPrompt,
    context,
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
