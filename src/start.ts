import "@/lib/server-websocket-polyfill";
import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";
import { clerkMiddleware } from "@clerk/tanstack-react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachClerkAuth } from "@/integrations/supabase/auth-attacher";
import { externalClerkOptions } from "@/lib/clerk-config.server";
import { logReliability } from "@/lib/reliability-logger";

// This app has one canonical production origin and uses Clerk's direct
// frontend API. The Clerk server package otherwise falls back to an
// environment-provided proxy and serializes it into SSR state, even when the
// component-level proxyUrl is unset.
delete process.env.CLERK_PROXY_URL;
delete process.env.VITE_CLERK_PROXY_URL;

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    logReliability("error", "request_middleware_error", {
      detail: error instanceof Error ? error.message : "Request middleware failed",
    });
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const clerkRequestMiddleware = clerkMiddleware(() => externalClerkOptions());

/**
 * Marketplace is a public HTML surface. Clerk's dev-browser handshake can
 * redirect that document before the route renders, which loses in-progress
 * search input. Keep Clerk on every authenticated/private request and on
 * server functions; public Marketplace HTML and discovery requests bypass it.
 */
const publicMarketplaceRequestMiddleware = createMiddleware().server(async (ctx) => {
  const url = new URL(ctx.request.url);
  const acceptsHtml = (ctx.request.headers.get("accept") ?? "").includes("text/html");
  const isMarketplaceDocument =
    (url.pathname === "/marketplace" || url.pathname === "/vendors") && acceptsHtml;
  const isPublicMarketplaceGoogleRequest =
    url.pathname === "/api/public/marketplace/google" && ctx.request.method === "GET";
  const isMarketplaceSessionPresenceRequest =
    url.pathname === "/api/auth/session-presence" && ctx.request.method === "GET";

  if (isMarketplaceDocument || isPublicMarketplaceGoogleRequest || isMarketplaceSessionPresenceRequest) {
    return ctx.next();
  }

  return (clerkRequestMiddleware as any).options.server(ctx);
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachClerkAuth],
  requestMiddleware: [publicMarketplaceRequestMiddleware, csrfMiddleware, errorMiddleware],
}));
