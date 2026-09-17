import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth as useClerkAuth, useClerk, useUser } from "@clerk/tanstack-react-start";
import { useServerFn } from "@tanstack/react-start";
import { getCalendarSettings, saveTimezone } from "@/lib/calendar.functions";
import { getCurrentClerkIdentity } from "@/lib/clerk-auth.functions";
import { setSupabaseClerkTokenProvider } from "@/integrations/supabase/client";

export type CompatibleUser = {
  id: string;
  email?: string;
  aud: string;
  created_at: string;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
};

type AuthState = {
  session: null;
  user: CompatibleUser | null;
  loading: boolean;
  /** External Clerk user ID; use `user.id` for legacy Supabase rows. */
  clerkUserId: string | null;
  signOut: () => Promise<void>;
};

const unavailableSignOut = async () => undefined;
const AuthContext = createContext<AuthState>({
  session: null, user: null, loading: true, clerkUserId: null, signOut: unavailableSignOut,
});

const publicAuthState: AuthState = {
  session: null,
  user: null,
  loading: false,
  clerkUserId: null,
  signOut: unavailableSignOut,
};

let lastKnownAuthState: AuthState | null = null;

export function getLastKnownAuthState(): AuthState | null {
  return typeof window !== "undefined" ? lastKnownAuthState : null;
}

export function PublicAuthProvider({ children }: { children: ReactNode }) {
  // Keep signed-out public routes independent from Clerk's browser handshake.
  // If an authenticated user arrived here through an already-mounted app
  // shell, preserve that resolved state without reinitializing Clerk.
  const preservedAuthState = lastKnownAuthState?.user ? lastKnownAuthState : null;
  return <AuthContext.Provider value={preservedAuthState ?? publicAuthState}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const loadCalendarSettings = useServerFn(getCalendarSettings);
  const saveDetectedTimezone = useServerFn(saveTimezone);
  const [legacyUserId, setLegacyUserId] = useState<string | null>(null);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingResolved, setMappingResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isLoaded || !isSignedIn || !userId) {
      setLegacyUserId(null);
      setMappingLoading(false);
      setMappingResolved(isLoaded);
      setSupabaseClerkTokenProvider(null);
      return;
    }
    setSupabaseClerkTokenProvider(() => getToken());
    setMappingLoading(true);
    setMappingResolved(false);
    void (async () => {
      const deadline = Date.now() + 8_000;
      while (!cancelled) {
        try {
          const sessionToken = await getToken({ skipCache: true });
          if (!sessionToken) throw new Error("Clerk session token is not ready.");
          const identity = await getCurrentClerkIdentity({ data: { sessionToken } });
          if (!cancelled) setLegacyUserId(identity.userId);
          break;
        } catch {
          if (Date.now() >= deadline) {
            if (!cancelled) setLegacyUserId(null);
            break;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 250));
        }
      }
      if (!cancelled) {
        setMappingLoading(false);
        setMappingResolved(true);
      }
    })();
    return () => { cancelled = true; };
  }, [getToken, isLoaded, isSignedIn, userId]);

  useEffect(() => {
    if (!legacyUserId) return;

    void (async () => {
      try {
        const settings = await loadCalendarSettings();
        if (settings.timezone && settings.timezone !== "UTC") return;

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timezone) {
          await saveDetectedTimezone({ data: { timezone } });
        }
      } catch {
        // Timezone detection is best-effort and must not delay or interrupt sign-in.
      }
    })();
  }, [legacyUserId, loadCalendarSettings, saveDetectedTimezone]);

  const state = useMemo<AuthState>(() => {
    const metadata = (clerkUser?.unsafeMetadata ?? clerkUser?.publicMetadata ?? {}) as Record<string, unknown>;
    return {
      session: null,
      user: legacyUserId
        ? {
            id: legacyUserId,
            email: clerkUser?.primaryEmailAddress?.emailAddress,
            aud: "authenticated",
            created_at: clerkUser?.createdAt ? new Date(clerkUser.createdAt).toISOString() : "",
            user_metadata: metadata,
            app_metadata: {},
          }
        : null,
      loading: !isLoaded || mappingLoading || (isSignedIn && !mappingResolved),
      clerkUserId: userId ?? null,
      signOut: async () => {
        lastKnownAuthState = null;
        setSupabaseClerkTokenProvider(null);
        await clerkSignOut();
      },
    };
  }, [clerkSignOut, clerkUser, isLoaded, isSignedIn, legacyUserId, mappingLoading, mappingResolved, userId]);

  useEffect(() => {
    lastKnownAuthState = state;
  }, [state]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export async function signOut() {
  setSupabaseClerkTokenProvider(null);
  const clerk = (window as typeof window & {
    Clerk?: { signOut: () => Promise<void> };
  }).Clerk;
  await clerk?.signOut();
}
