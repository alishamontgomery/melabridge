import { lazy, Suspense } from "react";
import { Sparkles } from "lucide-react";
import { useMelaAssist } from "./context";
import { useAuth } from "@/lib/auth";

const MelaAssistPanel = lazy(() => import("./MelaAssistPanel"));

export function MelaAssistFloatingButton() {
  const { user } = useAuth();
  const { open, openAssistant } = useMelaAssist();

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => openAssistant()}
        aria-label="Open MelaAssist"
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-3 z-40 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-primary to-gold text-primary-foreground shadow-elegant transition hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background sm:bottom-[calc(1.25rem+env(safe-area-inset-bottom))] sm:right-6 sm:h-14 sm:w-14"
      >
        <span className="absolute inset-0 rounded-full bg-primary/40 opacity-60 blur-lg" aria-hidden />
        <Sparkles className="relative h-6 w-6" />
        <span className="sr-only">Open MelaAssist</span>
      </button>
      {open ? (
        <Suspense fallback={null}>
          <MelaAssistPanel />
        </Suspense>
      ) : null}
    </>
  );
}
