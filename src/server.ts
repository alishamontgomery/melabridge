import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { logReliability } from "./lib/reliability-logger";
import { checkExternalClerkCredentials, type ClerkCredentialCheck } from "@/lib/clerk-config.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(request: Request, response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const requestPath = new URL(request.url).pathname;
  if (requestPath === "/auth" || requestPath === "/auth/callback") {
    const configurationResponse = await clerkConfigurationResponse(request);
    if (configurationResponse) return configurationResponse;
    return recoverFromInvalidClerkSession(request);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const capturedError = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  if (
    isInvalidClerkSessionError(capturedError) ||
    hasClerkSessionCookie(request)
  ) {
    return recoverFromInvalidClerkSession(request);
  }
  logReliability("error", "ssr_error", {
    route: requestPath,
    detail: capturedError instanceof Error ? capturedError.message : "SSR request failed",
  });
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function clerkConfigurationResponseForCheck(check: ClerkCredentialCheck): Response | null {
  if (check.issue === "ok" || check.issue === "unavailable") return null;
  return new Response(
    renderErrorPage({
      title: "Authentication configuration needs attention",
      message: `${check.message} After updating the server secret, restart the app and try again.`,
    }),
    {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

async function clerkConfigurationResponse(request: Request): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (pathname !== "/auth" && pathname !== "/auth/callback") return null;
  return clerkConfigurationResponseForCheck(await checkExternalClerkCredentials());
}

function errorText(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const value = error as { name?: unknown; message?: unknown; cause?: unknown };
  return `${String(value.name ?? "")} ${String(value.message ?? "")} ${errorText(value.cause)}`;
}

function isInvalidClerkSessionError(error: unknown): boolean {
  const text = errorText(error).toLowerCase();
  return (
    text.includes("handshake token verification failed") ||
    text.includes("secret-key-invalid") ||
    text.includes("token-carrier=undefined")
  );
}

function hasClerkSessionCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .some((name) => name === "__session" || name === "__client_uat" || name.startsWith("__clerk"));
}

function recoverFromInvalidClerkSession(request: Request): Response {
  const url = new URL(request.url);
  const cookieNames = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter(Boolean);
  const recoveryCookie = "melabridge_clerk_recovery";
  if (cookieNames.includes(recoveryCookie)) {
    return new Response(renderErrorPage(), {
      status: 500,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "set-cookie": `${recoveryCookie}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
      },
    });
  }

  const isAuthRoute = url.pathname === "/auth" || url.pathname === "/auth/callback";
  const response = new Response(null, {
    status: 303,
    headers: { Location: `${url.origin}${isAuthRoute ? "/auth" : "/"}` },
  });
  const namesToClear = cookieNames.filter((name) => name !== recoveryCookie);
  if (namesToClear.length === 0) {
    namesToClear.push("__session", "__client_uat", "__clerk_db_jwt", "__clerk_handshake", "__clerk_synced");
  }
  for (const cookieName of namesToClear) {
    response.headers.append(
      "Set-Cookie",
      `${cookieName}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
    );
  }
  response.headers.append(
    "Set-Cookie",
    `${recoveryCookie}=1; Path=/; Max-Age=10; HttpOnly; SameSite=Lax`,
  );
  return response;
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function redirectToCanonicalProductionHost(request: Request): Response | null {
  if (process.env.NODE_ENV !== "production") return null;
  const url = new URL(request.url);
  // Replit's deployment health check reaches the process through its local
  // forwarding address. Never redirect that probe to the public domain: doing
  // so makes the health check depend on the public network and can cause the
  // deployment to be repeatedly terminated even while the app is healthy.
  const internalHealthcheckHosts = new Set(["127.0.0.1", "localhost", "0.0.0.0", "::1"]);
  if (url.hostname === "melabridge.com" || internalHealthcheckHosts.has(url.hostname)) return null;

  url.protocol = "https:";
  url.hostname = "melabridge.com";
  url.port = "";
  return new Response(null, {
    status: 308,
    headers: {
      Location: url.toString(),
      "Cache-Control": "no-store",
    },
  });
}

function rejectLegacyClerkProxyRequest(request: Request): Response | null {
  const requestPath = new URL(request.url).pathname;
  if (requestPath !== "/api/__clerk" && !requestPath.startsWith("/api/__clerk/")) {
    return null;
  }

  // This app uses an external Clerk instance directly. The old Replit-style
  // proxy must never become an application route or a user-facing destination.
  return new Response(JSON.stringify({ error: "Legacy Clerk proxy route is disabled." }), {
    status: 404,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const canonicalRedirect = redirectToCanonicalProductionHost(request);
      if (canonicalRedirect) return canonicalRedirect;

      const legacyProxyResponse = rejectLegacyClerkProxyRequest(request);
      if (legacyProxyResponse) return legacyProxyResponse;

      const configurationResponse = await clerkConfigurationResponse(request);
      if (configurationResponse) return configurationResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(request, response);
    } catch (error) {
      const url = new URL(request.url);
      if (
        url.pathname === "/auth" ||
        url.pathname === "/auth/callback"
      ) {
        const configurationResponse = clerkConfigurationResponseForCheck(
          await checkExternalClerkCredentials(),
        );
        if (configurationResponse) return configurationResponse;
        return recoverFromInvalidClerkSession(request);
      }
      logReliability("error", "server_request_error", {
        route: url.pathname,
        detail: error instanceof Error ? error.message : "Server request failed",
      });
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
