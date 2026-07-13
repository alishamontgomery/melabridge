import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function html(status: number, title: string, msg: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font-family:system-ui;max-width:520px;margin:80px auto;padding:24px;color:#0f172a;line-height:1.5}
    h1{font-size:22px;margin:0 0 12px}a{color:#2563eb}</style></head>
    <body><h1>${title}</h1><p>${msg}</p>
    <p><a href="/settings/calendar">← Back to calendar settings</a></p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/oauth/google-calendar/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error");
        if (err) return html(400, "Google denied access", err);
        if (!code || !state) return html(400, "Missing code or state", "OAuth response was incomplete.");

        const [userId] = state.split(".");
        if (!userId) return html(400, "Invalid state", "Could not identify user.");

        const clientId = process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET;
        const redirectUri =
          process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI ??
          `${url.origin}/api/oauth/google-calendar/callback`;
        if (!clientId || !clientSecret) return html(503, "Not configured", "Google Calendar OAuth secrets missing.");

        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });
        if (!tokenRes.ok) {
          const t = await tokenRes.text();
          return html(400, "Token exchange failed", t);
        }
        const tokens = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          scope?: string;
        };

        // Fetch primary calendar email
        let email: string | null = null;
        const calRes = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary",
          { headers: { Authorization: `Bearer ${tokens.access_token}` } },
        );
        if (calRes.ok) {
          const cal = (await calRes.json()) as { id?: string };
          email = cal.id ?? null;
        }

        const admin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } },
        );

        const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();
        const { error } = await admin.from("calendar_connections").upsert(
          {
            user_id: userId,
            provider: "google",
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token ?? null,
            token_expires_at: expiresAt,
            scope: tokens.scope ?? null,
            external_account_email: email,
            external_calendar_id: "primary",
            is_active: true,
            last_error: null,
          },
          { onConflict: "user_id,provider" },
        );
        if (error) return html(500, "Could not save connection", error.message);

        return Response.redirect(`${url.origin}/settings/calendar?connected=google`, 302);
      },
    },
  },
});
