import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

let _supabase: ReturnType<typeof createClient> | null = null;
function getAdmin() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _supabase;
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + 74);
    parts.push(i === 0 ? chunk : " " + chunk);
    i += 74;
  }
  return parts.join("\r\n");
}

function toIcsDate(date: string, time: string | null): string {
  const d = date.replace(/-/g, "");
  if (!time) return d;
  const t = time.replace(/:/g, "").padEnd(6, "0").slice(0, 6);
  return `${d}T${t}00`;
}

function addMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm));
  dt.setUTCMinutes(dt.getUTCMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`,
    time: `${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`,
  };
}

export const Route = createFileRoute("/api/public/calendar/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // token param may include ".ics" suffix
        const raw = params.token ?? "";
        const token = raw.endsWith(".ics") ? raw.slice(0, -4) : raw;
        if (!token || token.length < 16) {
          return new Response("Invalid token", { status: 404 });
        }

        const admin = getAdmin();
        const { data: profile, error: pErr } = await admin
          .from("profiles")
          .select("id, display_name")
          .eq("ics_token", token)
          .maybeSingle();
        if (pErr || !profile) {
          return new Response("Not found", { status: 404 });
        }
        const userId = (profile as { id: string }).id;
        const displayName =
          (profile as { display_name: string | null }).display_name ?? "MelaBridge";

        const { data: events } = await admin
          .from("events")
          .select(
            "id, name, event_type, description, event_notes, event_date, start_time, end_time, location, venue_city, venue_state, updated_at, status",
          )
          .eq("owner_id", userId)
          .not("event_date", "is", null)
          .not("status", "eq", "cancelled")
          .order("event_date", { ascending: true });

        const now = new Date();
        const dtstamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
          now.getUTCDate(),
        ).padStart(2, "0")}T${String(now.getUTCHours()).padStart(2, "0")}${String(
          now.getUTCMinutes(),
        ).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}Z`;

        const lines: string[] = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//MelaBridge//Calendar Feed//EN",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          `X-WR-CALNAME:${escapeIcs(`${displayName} — MelaBridge`)}`,
          "X-WR-TIMEZONE:UTC",
        ];

        for (const e of (events ?? []) as Array<{
          id: string;
          name: string;
          event_type: string | null;
          description: string | null;
          event_notes: string | null;
          event_date: string;
          start_time: string | null;
          end_time: string | null;
          location: string | null;
          venue_city: string | null;
          venue_state: string | null;
          updated_at: string;
        }>) {
          const allDay = !e.start_time;
          const dtstart = toIcsDate(e.event_date, e.start_time);
          let dtend: string;
          if (allDay) {
            const [y, m, d] = e.event_date.split("-").map(Number);
            const next = new Date(Date.UTC(y, m - 1, d + 1));
            const pad = (n: number) => String(n).padStart(2, "0");
            dtend = `${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`;
          } else if (e.end_time) {
            dtend = toIcsDate(e.event_date, e.end_time);
          } else {
            const end = addMinutes(e.event_date, e.start_time!, 120);
            dtend = toIcsDate(end.date, end.time);
          }

          const loc =
            e.location ??
            [e.venue_city, e.venue_state].filter(Boolean).join(", ") ??
            "";
          const desc = e.event_notes ?? e.description ?? "";
          const summary = e.event_type ? `${e.name} (${e.event_type})` : e.name;
          const uid = `${e.id}@melabridge.com`;
          const lastMod = new Date(e.updated_at)
            .toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d{3}/, "");

          lines.push("BEGIN:VEVENT");
          lines.push(foldLine(`UID:${uid}`));
          lines.push(`DTSTAMP:${dtstamp}`);
          lines.push(`LAST-MODIFIED:${lastMod}`);
          if (allDay) {
            lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
            lines.push(`DTEND;VALUE=DATE:${dtend}`);
          } else {
            lines.push(`DTSTART:${dtstart}`);
            lines.push(`DTEND:${dtend}`);
          }
          lines.push(foldLine(`SUMMARY:${escapeIcs(summary)}`));
          if (loc) lines.push(foldLine(`LOCATION:${escapeIcs(loc)}`));
          if (desc) lines.push(foldLine(`DESCRIPTION:${escapeIcs(desc)}`));
          lines.push(`URL:https://melabridge.com/events/${e.id}`);
          lines.push("STATUS:CONFIRMED");
          lines.push("TRANSP:OPAQUE");
          lines.push("END:VEVENT");
        }

        lines.push("END:VCALENDAR");
        const body = lines.join("\r\n");

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="melabridge.ics"',
            "Cache-Control": "private, max-age=300",
          },
        });
      },
    },
  },
});
