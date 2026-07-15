import { AlertTriangle, Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";

type ModuleErrorProps = {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
};

/** Inline error card for module panels (query errors etc.). */
export function ModuleError({
  title = "We couldn't load this",
  description,
  error,
  onRetry,
  className,
}: ModuleErrorProps) {
  const msg =
    description ??
    (error instanceof Error ? error.message : undefined) ??
    "Something went wrong reaching your data. Check your connection and try again.";
  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  const Icon = isOffline ? WifiOff : AlertTriangle;
  return (
    <div
      role="alert"
      className={cn(
        "mt-6 rounded-3xl border border-destructive/30 bg-destructive/5 p-6 sm:p-8 text-center",
        className,
      )}
    >
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 font-display text-lg font-semibold">
        {isOffline ? "You appear to be offline" : title}
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{msg}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Skeleton grid for module loading states. */
export function ModuleLoading({
  rows = 4,
  showStats = true,
  className,
}: {
  rows?: number;
  showStats?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mt-6 space-y-4", className)} aria-busy="true" aria-live="polite">
      {showStats && (
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Full-route pending state (for `pendingComponent`). */
export function RoutePending({ label = "Loading" }: { label?: string }) {
  return (
    <AppShell>
      <div
        className="mt-8 grid min-h-[320px] place-items-center rounded-3xl border border-border bg-card text-muted-foreground"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">{label}…</p>
        </div>
      </div>
    </AppShell>
  );
}

/** Full-route error state (for `errorComponent`). */
export function RouteError({
  error,
  reset,
}: {
  error: Error;
  reset?: () => void;
}) {
  return (
    <AppShell>
      <ModuleError
        title="This page hit a snag"
        description={error?.message || "An unexpected error occurred while loading this page."}
        onRetry={
          reset
            ? () => {
                reset();
              }
            : () => {
                if (typeof window !== "undefined") window.location.reload();
              }
        }
      />
    </AppShell>
  );
}
