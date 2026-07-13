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

export const Route = createFileRoute("/api/oauth/outlook-calendar/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env.OUTLOOK_OAUTH_CLIENT_ID;
        if (!clientId) {
          return html(
            503,
            "Outlook not configured yet",
            `To enable Outlook sync, add <code>OUTLOOK_OAUTH_CLIENT_ID</code>,
             <code>OUTLOOK_OAUTH_CLIENT_SECRET</code>, and set the redirect URI in Azure to
             <code>${new URL(request.url).origin}/api/oauth/outlook-calendar/callback</code>.
             In the meantime, the ICS subscription URL works with Outlook too.`,
          );
        }
        const url = new URL(request.url);
        const uid = url.searchParams.get("uid");
        if (!uid) return Response.redirect(`${url.origin}/settings/calendar?connect=outlook`, 302);

        const redirectUri =
          process.env.OUTLOOK_OAUTH_REDIRECT_URI ??
          `${url.origin}/api/oauth/outlook-calendar/callback`;
        const nonce = crypto.randomUUID();
        const params = new URLSearchParams({
          client_id: clientId,
          response_type: "code",
          redirect_uri: redirectUri,
          response_mode: "query",
          scope: "offline_access Calendars.ReadWrite User.Read",
          state: `${uid}.${nonce}`,
        });
        return Response.redirect(
          `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`,
          302,
        );
      },
    },
  },
});
