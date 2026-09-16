import { useEffect } from "react";
import { signOut } from "@/lib/auth";
import { toast } from "sonner";

const IDLE_KEY = "melabridge.auth.lastActivity";
const IDLE_MS = 30 * 60 * 1000; // 30 min
const CHECK_MS = 30 * 1000;
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;


/**
 * Signs the user out after IDLE_MS of no interaction. Timestamp is stored in
 * localStorage so multiple tabs share the same idle clock.
 */
export function useIdleSignout(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const stamp = () => {
      try {
        window.localStorage.setItem(IDLE_KEY, String(Date.now()));
      } catch {
        /* storage may be blocked */
      }
    };
    stamp();

    const onActivity = () => {
      if (document.visibilityState === "hidden") return;
      stamp();
    };

    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    let signingOut = false;
    const interval = window.setInterval(async () => {
      if (signingOut) return;
      let last = 0;
      try {
        last = Number(window.localStorage.getItem(IDLE_KEY) ?? "0");
      } catch {
        return;
      }
      if (!last) return;
      if (Date.now() - last < IDLE_MS) return;
      signingOut = true;
      try {
        window.localStorage.removeItem(IDLE_KEY);
        await signOut();
        toast.info("Signed out due to inactivity");
      } catch {
        /* ignore */
      }
    }, CHECK_MS);

    return () => {
      window.clearInterval(interval);
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [enabled]);
}
