import { createFileRoute } from "@tanstack/react-router";

function hasClerkSessionCookie(cookieHeader: string | null): boolean {
  return (cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .some((name) => name === "__session");
}

export const Route = createFileRoute("/api/auth/session-presence")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        Response.json(
          { hasSession: hasClerkSessionCookie(request.headers.get("cookie")) },
          {
            headers: {
              "cache-control": "no-store",
            },
          },
        ),
    },
  },
});