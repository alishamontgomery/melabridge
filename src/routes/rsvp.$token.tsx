/**
 * One-click RSVP confirmation page — /rsvp/:token
 *
 * No authentication required. The signed token embedded in the email is the
 * credential. On mount, the page auto-verifies the token and updates the
 * guest's RSVP status, then shows a clear success or error state.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, AlertTriangle, Loader2, Calendar, MapPin, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-logo";
import { confirmRsvpFromToken } from "@/lib/rsvp-link.functions";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/rsvp/$token")({
  head: () => ({
    meta: [
      { title: "RSVP Confirmation — MelaBridge" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RsvpConfirmPage,
});

type Result =
  | { state: "loading" }
  | {
      state: "success";
      guestName: string;
      eventName: string;
      eventId: string;
      eventDate: string | null;
      location: string | null;
      isPublished: boolean;
      status: "yes" | "no" | "maybe";
    }
  | { state: "error"; reason: string; eventId?: string; isPublished?: boolean };

function friendlyStatus(status: "yes" | "no" | "maybe"): string {
  if (status === "yes") return "confirmed";
  if (status === "no") return "declined";
  return "maybe";
}

/** Format an ISO date string as a human-readable date+time. */
function formatEventDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Build a minimal ICS calendar invite and trigger a download. */
function downloadIcs(eventName: string, eventDate: string | null, location: string | null) {
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  let dtStart = now;
  let dtEnd = now;

  if (eventDate) {
    const d = new Date(eventDate);
    dtStart = d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    // Default duration: 2 hours
    const dEnd = new Date(d.getTime() + 2 * 60 * 60 * 1000);
    dtEnd = dEnd.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MelaBridge//RSVP//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@melabridge.com`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${eventName}`,
    location ? `LOCATION:${location}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const blob = new Blob([lines], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${eventName.replace(/[^a-z0-9]/gi, "_")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function RsvpConfirmPage() {
  const { token } = Route.useParams();
  const confirmFn = useServerFn(confirmRsvpFromToken);
  const [result, setResult] = useState<Result>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    confirmFn({ data: { token } })
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          setResult({
            state: "error",
            reason: r.reason,
            eventId: "eventId" in r ? r.eventId : undefined,
            isPublished: "isPublished" in r ? r.isPublished : undefined,
          });
        } else {
          trackEvent("rsvp_response_recorded", {
            status: r.status,
            event_published: r.isPublished,
          });
          setResult({
            state: "success",
            guestName: r.guestName ?? "Guest",
            eventName: r.eventName,
            eventId: r.eventId,
            eventDate: r.eventDate,
            location: r.location,
            isPublished: r.isPublished,
            status: r.status,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setResult({ state: "error", reason: "unexpected" });
      });
    return () => { cancelled = true; };
  }, [token, confirmFn]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 dark:from-violet-950 dark:to-purple-950 flex flex-col">
      {/* Nav */}
      <header className="border-b border-border/30 bg-background/70 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <BrandMark className="h-7 w-7" />
          <span className="font-display text-lg font-semibold">MelaBridge</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="mx-auto w-full max-w-md">
          {result.state === "loading" && (
            <div className="rounded-2xl border border-border/60 bg-background p-10 text-center shadow-soft">
              <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
              <p className="text-lg font-medium">Confirming your RSVP…</p>
              <p className="mt-1 text-sm text-muted-foreground">Just a moment</p>
            </div>
          )}

          {result.state === "success" && (
            <div className="rounded-2xl border border-emerald-200 bg-background p-8 text-center shadow-soft">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="font-display text-2xl font-semibold">
                {result.status === "yes" ? "You're confirmed!" : "Response recorded"}
              </h1>
              <p className="mt-2 text-muted-foreground">
                Hi {result.guestName} — your RSVP for{" "}
                <strong>{result.eventName}</strong> has been updated to{" "}
                <strong>{friendlyStatus(result.status)}</strong>.
              </p>

              {/* Event details */}
              {(result.eventDate || result.location) && (
                <div className="mt-5 rounded-xl border border-border/60 bg-muted/40 p-4 text-left space-y-2">
                  {result.eventDate && (
                    <div className="flex items-start gap-2 text-sm">
                      <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{formatEventDate(result.eventDate)}</span>
                    </div>
                  )}
                  {result.location && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{result.location}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-6 flex flex-col gap-3">
                {result.status === "yes" && result.eventDate && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => downloadIcs(result.eventName, result.eventDate, result.location)}
                  >
                    <Calendar className="h-4 w-4" />
                    Add to calendar
                  </Button>
                )}

                {result.isPublished && (
                  <Button asChild variant="outline" className="w-full gap-2">
                    <Link to="/e/$eventId" params={{ eventId: result.eventId }}>
                      View event page
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>

              {result.status === "no" && (
                <p className="mt-4 text-sm text-muted-foreground">
                  We're sorry you can't make it. The organiser has been notified.
                </p>
              )}

              <p className="mt-6 text-xs text-muted-foreground">
                Changed your mind? Contact your organiser directly.
              </p>
            </div>
          )}

          {result.state === "error" && (
            <div className="rounded-2xl border border-amber-200 bg-background p-10 text-center shadow-soft">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-600">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <h1 className="font-display text-2xl font-semibold">
                {result.reason === "invalid_or_expired" ? "Link expired" : "Something went wrong"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {result.reason === "invalid_or_expired"
                  ? "This RSVP link has expired or is no longer valid. RSVP links are valid for 30 days."
                  : result.reason === "guest_not_found"
                  ? "We couldn't find your guest record. Please contact the event organiser."
                  : result.reason === "event_not_found"
                  ? "The event associated with this link could not be found."
                  : "We couldn't update your RSVP. Please contact the event organiser directly."}
              </p>

              <div className="mt-6 flex flex-col gap-3">
                {result.isPublished && result.eventId && (
                  <Button asChild variant="outline" className="w-full gap-2">
                    <Link to="/e/$eventId" params={{ eventId: result.eventId }}>
                      View event page
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                )}

                <Button asChild className="w-full gap-2">
                  <Link to="/">
                    Go to MelaBridge <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        Powered by{" "}
        <a
          href="/"
          className="font-medium underline hover:text-foreground"
        >
          MelaBridge
        </a>
      </footer>
    </div>
  );
}
