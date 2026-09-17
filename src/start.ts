import "@/lib/server-websocket-polyfill";
import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";
import { clerkMiddleware } from "@clerk/tanstack-react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachClerkAuth } from "@/integrations/supabase/auth-attacher";
import { externalClerkOptions } from "@/lib/clerk-config.server";
import { isBrowserDocumentRequest } from "@/lib/clerk-request-policy";
import { logReliability } from "@/lib/reliability-logger";

// This app uses an external Clerk instance directly from the canonical
// MelaBridge origin. TanStack Start's Clerk adapter falls back to a
// CLERK_PROXY_URL supplied by the host and serializes it into SSR state unless
// it is removed before the middleware is initialized.
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
 * Clerk's server middleware can turn an expired browser session into a 307
 * handshake response. Never allow that response to replace a top-level app
 * document. The browser Clerk client owns session refresh after the app shell
 * loads; server functions and non-document requests still use Clerk middleware.
 */
const requestAuthMiddleware = createMiddleware().server(async (ctx) => {
  const url = new URL(ctx.request.url);
  const isBrowserDocument = isBrowserDocumentRequest(ctx.request, ctx.handlerType);
  const isPublicMarketplaceGoogleRequest =
    url.pathname === "/api/public/marketplace/google" && ctx.request.method === "GET";
  const isMarketplaceSessionPresenceRequest =
    url.pathname === "/api/auth/session-presence" && ctx.request.method === "GET";

  if (isBrowserDocument || isPublicMarketplaceGoogleRequest || isMarketplaceSessionPresenceRequest) {
    return ctx.next();
  }

  return (clerkRequestMiddleware as any).options.server(ctx);
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachClerkAuth],
  requestMiddleware: [requestAuthMiddleware, csrfMiddleware, errorMiddleware],
}));
