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
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-primary to-gold text-primary-foreground shadow-elegant transition hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background md:bottom-6 md:right-6"
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
