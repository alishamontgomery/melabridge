import { createFileRoute } from "@tanstack/react-router";

function html(status: number, title: string, msg: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font-family:system-ui;max-width:520px;margin:80px auto;padding:24px;color:#0f172a;line-height:1.5}
    h1{font-size:22px;margin:0 0 12px}code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:13px}
    a{color:#2563eb}</style></head><body><h1>${title}</h1><p>${msg}</p>
    <p><a href="/settings/calendar">← Back to calendar settings</a></p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/oauth/google-calendar/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID;
        if (!clientId) {
          return html(
            503,
            "Google Calendar not configured yet",
            `To enable Google Calendar sync, an admin needs to add <code>GOOGLE_CALENDAR_OAUTH_CLIENT_ID</code>,
             <code>GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET</code>, and <code>GOOGLE_CALENDAR_OAUTH_REDIRECT_URI</code>
             (set to <code>${new URL(request.url).origin}/api/oauth/google-calendar/callback</code>) to the project secrets.
             Meanwhile, the ICS subscription URL on the calendar settings page works with Google Calendar too.`,
          );
        }

        // Read Supabase user from cookie-based session using service role lookup
        const url = new URL(request.url);
        const redirectUri =
          process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI ??
          `${url.origin}/api/oauth/google-calendar/callback`;

        // We rely on a `uid` query param passed from the client (set by the
        // settings page). If missing, bounce to settings.
        const uid = url.searchParams.get("uid");
        if (!uid) {
          return Response.redirect(`${url.origin}/settings/calendar?connect=google`, 302);
        }

        const nonce = crypto.randomUUID();
        const state = `${uid}.${nonce}`;

        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
          scope: "https://www.googleapis.com/auth/calendar",
          state,
        });

        return Response.redirect(
          `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
          302,
        );
      },
    },
  },
});
