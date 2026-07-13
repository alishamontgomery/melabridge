import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

// ---------------- Types ----------------

export type EventState = {
  id: string | null;
  name: string;
  type: string;
  date: string; // ISO or ""
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
  loading: boolean;
  hasEvent: boolean;
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

const EMPTY_EVENT: EventState = {
  id: null,
  name: "No active event",
  type: "",
  date: "",
  location: "",
  guests: 0,
  rsvps: 0,
  budget: 0,
  spent: 0,
  vendorsConfirmed: 0,
  vendorsTotal: 0,
  tasksDone: 0,
  tasksTotal: 0,
  weatherRisk: "low",
};

function computeHealth(e: EventState) {
  if (!e.id) return 0;
  const tasks = (e.tasksDone / Math.max(1, e.tasksTotal)) * 30;
  const vendors = (e.vendorsConfirmed / Math.max(1, e.vendorsTotal)) * 25;
  const rsvp = Math.min(1, e.rsvps / Math.max(1, e.guests)) * 20;
  const budgetHealth = e.spent <= e.budget ? 20 : Math.max(0, 20 - ((e.spent - e.budget) / Math.max(1, e.budget)) * 40);
  const weather = e.weatherRisk === "low" ? 5 : e.weatherRisk === "medium" ? 3 : 0;
  return Math.round(Math.max(0, Math.min(100, tasks + vendors + rsvp + budgetHealth + weather)));
}

const EcosystemContext = createContext<EcosystemValue | null>(null);

export function EcosystemProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [event, setEvent] = useState<EventState>(EMPTY_EVENT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setEvent(EMPTY_EVENT);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: ev } = await supabase
        .from("events")
        .select("*")
        .neq("status", "archived")
        .order("event_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!ev) {
        setEvent(EMPTY_EVENT);
        setLoading(false);
        return;
      }
      const [{ data: guests }, { data: tasks }, { data: budgetItems }] = await Promise.all([
        supabase.from("guests").select("plus_ones, rsvp_status").eq("event_id", ev.id),
        supabase.from("tasks").select("status").eq("event_id", ev.id),
        supabase.from("budget_items").select("estimated_amount, actual_amount, paid_amount").eq("event_id", ev.id),
      ]);
      if (cancelled) return;
      const guestList = guests ?? [];
      const taskList = tasks ?? [];
      const items = budgetItems ?? [];
      const guestCount = guestList.reduce((s, g: any) => s + 1 + Number(g.plus_ones ?? 0), 0);
      const rsvpCount = guestList.filter((g: any) => g.rsvp_status === "confirmed" || g.rsvp_status === "attending").length;
      const tasksDone = taskList.filter((t: any) => t.status === "done" || t.status === "completed").length;
      const spent = items.reduce((s, i: any) => s + Number(i.paid_amount ?? i.actual_amount ?? 0), 0);
      setEvent({
        id: ev.id,
        name: ev.name ?? "Untitled event",
        type: ev.event_type ?? "",
        date: ev.event_date ?? "",
        location: ev.location ?? "",
        guests: guestCount || Number(ev.guest_target ?? 0),
        rsvps: rsvpCount,
        budget: Number(ev.budget_target ?? 0),
        spent,
        vendorsConfirmed: 0,
        vendorsTotal: 0,
        tasksDone,
        tasksTotal: taskList.length,
        weatherRisk: "low",
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const value: EcosystemValue = useMemo(() => {
    const health = computeHealth(event);
    const budgetPct = event.budget > 0 ? Math.round((event.spent / event.budget) * 100) : 0;
    const perGuest = event.guests > 0 ? Math.round(event.spent / event.guests) : 0;
    const cateringRecommendation = Math.ceil(event.guests * 1.05);
    const seatingTables = Math.ceil(event.guests / 10);
    const noop = () => {};
    return {
      event,
      ripples: [],
      loading,
      hasEvent: !!event.id,
      setGuests: (n: number) => setEvent((e) => ({ ...e, guests: Math.max(0, Math.round(n)) })),
      confirmVendor: noop,
      setWeatherRisk: (risk) => setEvent((e) => ({ ...e, weatherRisk: risk })),
      completeTask: noop,
      logRsvp: noop,
      health,
      budgetPct,
      perGuest,
      cateringRecommendation,
      seatingTables,
    };
  }, [event, loading]);

  return <EcosystemContext.Provider value={value}>{children}</EcosystemContext.Provider>;
}

export function useEcosystem(): EcosystemValue {
  const ctx = useContext(EcosystemContext);
  if (!ctx) throw new Error("useEcosystem must be used within <EcosystemProvider />");
  return ctx;
}
