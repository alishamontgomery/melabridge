import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ClerkProvider } from "@clerk/tanstack-react-start";
import { publishableKeyFromHost } from "@clerk/shared/keys";

import appCss from "../styles.css?url";
import { reportClientReliabilityError } from "../lib/reliability-client";
import { AuthProvider } from "@/lib/auth";
import { EcosystemProvider } from "@/lib/ecosystem-store";
import { MelaAssistProvider } from "@/components/melaassist";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Open dashboard
          </Link>
          <Link
            to="/help"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Help center
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  // NOTE: do NOT call useRouter() here. This component renders inside
  // CatchBoundaryImpl which may fire when the router context itself is
  // broken (e.g. mid-session Vite dep re-bundle splits module instances).
  // Calling useRouter() in that state produces a second "Invalid hook call"
  // error that masks the real one. Use window.location for hard navigation.
  useEffect(() => {
    reportClientReliabilityError(error, {
      source: "react_error_boundary",
      operation: "tanstack_root_error_component",
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              // Hard reload is the safest recovery when the router context may
              // be in an invalid state.
              if (typeof window !== "undefined") {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

function isClerkTransportFailure(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error ?? "");
  return /clerk|handshake|invalid host|frontend.?api|authentication/i.test(message);
}

function AuthenticationUnavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">
          Sign-in is temporarily unavailable
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn&apos;t connect to secure authentication. Please try again in a moment.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/help"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Help center
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MelaBridge — AI Event Planning Platform" },
      {
        name: "description",
        content:
          "Plan unforgettable events with AI. MelaBridge brings venues, vendors, guests, budgets, payments, and collaboration into one intelligent platform.",
      },
      { property: "og:title", content: "MelaBridge — AI Event Planning Platform" },
      {
        property: "og:description",
        content:
          "Plan unforgettable events with AI. MelaBridge brings venues, vendors, guests, budgets, payments, and collaboration into one intelligent platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MelaBridge — AI Event Planning Platform" },
      { name: "twitter:description", content: "Plan unforgettable events with AI. MelaBridge brings venues, vendors, guests, budgets, payments, and collaboration into one intelligent platform." },
      { property: "og:image", content: "/melabridge-logo.png" },
      { name: "twitter:image", content: "/melabridge-logo.png" },
      { name: "theme-color", content: "#6a2fbf" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/melabridge-logo.png" },
      { rel: "apple-touch-icon", href: "/melabridge-logo.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden">
      <head>
        <HeadContent />
      </head>
      <body className="overflow-x-hidden">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [clerkUnavailable, setClerkUnavailable] = useState(false);
  const isAuthSurface =
    typeof window !== "undefined" &&
    (window.location.pathname === "/auth" || window.location.pathname.startsWith("/auth/"));
  const publishableKey =
    typeof window === "undefined"
      ? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
      : publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
  const isClerkTestInstance = publishableKey.startsWith("pk_test_");
  const isLiveMelaBridgeHost =
    typeof window !== "undefined" && window.location.hostname === "melabridge.com";
  // Keep the canonical production host on Clerk's direct frontend API path.
  // The same-origin proxy is only used for other live custom hosts; routing
  // melabridge.com through it causes Clerk to reject the host before signup.
  const clerkProxyUrl =
    import.meta.env.PROD && !isClerkTestInstance && !isLiveMelaBridgeHost
      ? (import.meta.env.VITE_CLERK_PROXY_URL || "/api/__clerk")
      : undefined;

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportClientReliabilityError(event.error ?? event.message, {
        source: "window_error",
      });
      if (isClerkTransportFailure(event.error ?? event.message)) {
        setClerkUnavailable(true);
      }
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportClientReliabilityError(event.reason, {
        source: "unhandled_rejection",
      });
      if (isClerkTransportFailure(event.reason)) {
        setClerkUnavailable(true);
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  if (!publishableKey) return <AuthenticationUnavailable />;

  return (
    <QueryClientProvider client={queryClient}>
      <ClerkProvider publishableKey={publishableKey} proxyUrl={clerkProxyUrl}>
        {clerkUnavailable && isAuthSurface ? (
          <AuthenticationUnavailable />
        ) : (
          <AuthProvider>
            <EcosystemProvider>
              <MelaAssistProvider>
                {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
                <Outlet />
                <Toaster richColors position="top-right" closeButton />
              </MelaAssistProvider>
            </EcosystemProvider>
          </AuthProvider>
        )}
      </ClerkProvider>
    </QueryClientProvider>
  );
}
