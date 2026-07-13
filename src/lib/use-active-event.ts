import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];

type State = {
  event: EventRow | null;
  loading: boolean;
  error: string | null;
};

/**
 * Returns the currently active event for the signed-in user.
 * Strategy: pick the soonest upcoming non-archived event they own or belong to,
 * falling back to the most recently created one.
 * Returns null (with loading=false) if the user has no events yet.
 */
export function useActiveEvent(): State {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>({ event: null, loading: true, error: null });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ event: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .neq("status", "archived")
        .order("event_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (error) {
        setState({ event: null, loading: false, error: error.message });
      } else {
        setState({ event: data?.[0] ?? null, loading: false, error: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
}
