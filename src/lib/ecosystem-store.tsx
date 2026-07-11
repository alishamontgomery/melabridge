import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// ---------------- Types ----------------

export type EventState = {
  id: string;
  name: string;
  type: string;
  date: string; // ISO
  location: string;
  guests: number;
  rsvps: number;
  budget: number;
  spent: number;
  vendorsConfirmed: number;
  vendorsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  weatherRisk: "low" | "medium" | "high";
};

export type Ripple = {
  id: string;
  ts: number;
  source: string;
  effects: string[];
  tone: "info" | "warn" | "good";
};

type EcosystemValue = {
  event: EventState;
  ripples: Ripple[];
  setGuests: (n: number) => void;
  confirmVendor: (name: string) => void;
  setWeatherRisk: (risk: EventState["weatherRisk"]) => void;
  completeTask: () => void;
  logRsvp: (delta: number) => void;
  health: number;
  budgetPct: number;
  perGuest: number;
  cateringRecommendation: number;
  seatingTables: number;
};

const DEFAULT_EVENT: EventState = {
  id: "e1",
  name: "Amara & Julien — Wedding",
  type: "Wedding",
  date: "2026-10-17",
  location: "Lake Como, Italy",
  guests: 142,
  rsvps: 78,
  budget: 68000,
  spent: 41200,
  vendorsConfirmed: 4,
  vendorsTotal: 5,
  tasksDone: 42,
  tasksTotal: 58,
  weatherRisk: "medium",
};

// ---------------- Cascade math ----------------

function computeHealth(e: EventState) {
  const tasks = (e.tasksDone / Math.max(1, e.tasksTotal)) * 30;
  const vendors = (e.vendorsConfirmed / Math.max(1, e.vendorsTotal)) * 25;
  const rsvp = Math.min(1, e.rsvps / Math.max(1, e.guests)) * 20;
  const budgetHealth = e.spent <= e.budget ? 20 : Math.max(0, 20 - ((e.spent - e.budget) / e.budget) * 40);
  const weather = e.weatherRisk === "low" ? 5 : e.weatherRisk === "medium" ? 3 : 0;
  return Math.round(Math.max(0, Math.min(100, tasks + vendors + rsvp * 20 / 20 + budgetHealth + weather)));
}

const EcosystemContext = createContext<EcosystemValue | null>(null);

export function EcosystemProvider({ children }: { children: ReactNode }) {
  const [event, setEvent] = useState<EventState>(DEFAULT_EVENT);
  const [ripples, setRipples] = useState<Ripple[]>([
    {
      id: "r0",
      ts: Date.now() - 1000 * 60 * 42,
      source: "Weather forecast · Oct 17",
      effects: [
        "Contingency plan drafted (indoor ceremony backup)",
        "Vendor notification queued for tent rental",
        "Event Health Score™ recalculated to 92",
      ],
      tone: "warn",
    },
  ]);

  const pushRipple = useCallback((r: Omit<Ripple, "id" | "ts">) => {
    setRipples((prev) => [{ ...r, id: `r${prev.length + 1}`, ts: Date.now() }, ...prev].slice(0, 20));
  }, []);

  const setGuests = useCallback(
    (n: number) => {
      const next = Math.max(0, Math.min(1000, Math.round(n)));
      setEvent((e) => {
        const perGuest = e.spent / Math.max(1, e.guests);
        const projected = Math.round(perGuest * next);
        return { ...e, guests: next, spent: projected };
      });
      pushRipple({
        source: `Guest count updated to ${next}`,
        tone: "info",
        effects: [
          `Budget projection recalculated at $${Math.round((event.spent / Math.max(1, event.guests)) * next).toLocaleString()}`,
          `Catering recommendation: ${Math.ceil(next * 1.05)} plates (5% overflow)`,
          `Seating updated: ${Math.ceil(next / 10)} tables of 10`,
          "Vendor suggestions refreshed by BridgeDNA™",
          "Event Health Score™ recalculated",
        ],
      });
    },
    [event.spent, event.guests, pushRipple]
  );

  const confirmVendor = useCallback(
    (name: string) => {
      setEvent((e) => ({ ...e, vendorsConfirmed: Math.min(e.vendorsTotal, e.vendorsConfirmed + 1) }));
      pushRipple({
        source: `Vendor confirmed · ${name}`,
        tone: "good",
        effects: [
          "Timeline updated with vendor milestones",
          "Pending reminders removed by AI",
          "Budget marked as committed",
          "Collaboration feed posted an update",
          "Event Health Score™ recalculated",
        ],
      });
    },
    [pushRipple]
  );

  const setWeatherRisk = useCallback(
    (risk: EventState["weatherRisk"]) => {
      setEvent((e) => ({ ...e, weatherRisk: risk }));
      pushRipple({
        source: `Weather risk set to ${risk}`,
        tone: risk === "high" ? "warn" : "info",
        effects: [
          "Contingency recommendations drafted by AI",
          "Vendor notifications prepared",
          "Event Health Score™ recalculated",
        ],
      });
    },
    [pushRipple]
  );

  const completeTask = useCallback(() => {
    setEvent((e) => ({ ...e, tasksDone: Math.min(e.tasksTotal, e.tasksDone + 1) }));
    pushRipple({
      source: "Task completed",
      tone: "good",
      effects: ["Timeline advanced", "Collaboration feed updated", "Event Health Score™ recalculated"],
    });
  }, [pushRipple]);

  const logRsvp = useCallback(
    (delta: number) => {
      setEvent((e) => ({ ...e, rsvps: Math.max(0, Math.min(e.guests, e.rsvps + delta)) }));
      pushRipple({
        source: `RSVP updated (${delta > 0 ? "+" : ""}${delta})`,
        tone: "info",
        effects: ["Seating recalculated", "Catering adjusted", "Event Health Score™ recalculated"],
      });
    },
    [pushRipple]
  );

  const value: EcosystemValue = useMemo(() => {
    const health = computeHealth(event);
    const budgetPct = Math.round((event.spent / Math.max(1, event.budget)) * 100);
    const perGuest = Math.round(event.spent / Math.max(1, event.guests));
    const cateringRecommendation = Math.ceil(event.guests * 1.05);
    const seatingTables = Math.ceil(event.guests / 10);
    return {
      event,
      ripples,
      setGuests,
      confirmVendor,
      setWeatherRisk,
      completeTask,
      logRsvp,
      health,
      budgetPct,
      perGuest,
      cateringRecommendation,
      seatingTables,
    };
  }, [event, ripples, setGuests, confirmVendor, setWeatherRisk, completeTask, logRsvp]);

  return <EcosystemContext.Provider value={value}>{children}</EcosystemContext.Provider>;
}

export function useEcosystem(): EcosystemValue {
  const ctx = useContext(EcosystemContext);
  if (!ctx) {
    // Fallback so components can render outside a provider (e.g. isolated stories).
    // Real pages should be wrapped in <EcosystemProvider />.
    throw new Error("useEcosystem must be used within <EcosystemProvider />");
  }
  return ctx;
}
