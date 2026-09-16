/**
 * Public event page — /e/:eventId
 *
 * No authentication required. Shows published event details:
 *   • Hero (name, date, location, cover image)
 *   • About / description
 *   • Schedule (if show_schedule_public)
 *   • RSVP invitation-link instructions (if show_rsvp_public)
 *   • FAQs
 *   • Gift registry
 *   • "Powered by MelaBridge" footer
 *
 * If the event is unpublished, shows a "Not available" page.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar, MapPin, Users, ExternalLink, Clock, UserCheck, Gift,
  ChevronDown, ChevronUp, AlertTriangle, Loader2,
} from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPublicEventPage, type PublicEventData } from "@/lib/public-event.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/e/$eventId")({
  head: () => ({
    meta: [
      { title: "Event — MelaBridge" },
      { name: "description", content: "View event details and RSVP." },
    ],
  }),
  component: PublicEventPage,
});

function fmt(date: string | null, time?: string | null) {
  if (!date) return null;
  try {
    const d = new Date(`${date}T${time ?? "00:00"}`);
    const parts = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (time) {
      const t = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `${parts} at ${t}`;
    }
    return parts;
  } catch { return date; }
}

function fmt12(t: string | null) {
  if (!t) return null;
  const [h = "0", m = "0"] = t.split(":");
  const hh = parseInt(h, 10);
  const mm = m.padStart(2, "0");
  return `${((hh + 11) % 12) + 1}:${mm} ${hh >= 12 ? "PM" : "AM"}`;
}

function PublicEventPage() {
  const { eventId } = Route.useParams();
  const getPage = useServerFn(getPublicEventPage);

  const [pageState, setPageState] = useState<"loading" | "found" | "not_found">("loading");
  const [event, setEvent] = useState<PublicEventData | null>(null);

  // FAQ expand state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    getPage({ data: { eventId } })
      .then((data) => {
        if (data) {
          setEvent(data);
          setPageState("found");
        } else {
          setPageState("not_found");
        }
      })
      .catch(() => setPageState("not_found"));
  }, [eventId, getPage]);

  if (pageState === "loading") {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pageState === "not_found" || !event) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <MinimalHeader />
        <main className="flex flex-1 items-center justify-center p-6">
          <Card className="max-w-sm p-10 text-center">
            <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-muted-foreground/50" />
            <h2 className="font-display text-xl font-semibold">Page not available</h2>
            <p className="mt-2 text-sm text-muted-foreground">This event hasn't been published yet, or the link may be incorrect.</p>
          </Card>
        </main>
        <PoweredByFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <header
        className={cn(
          "relative border-b border-border/60 px-4 pb-8 pt-6",
          event.cover_image_url
            ? "bg-cover bg-center"
            : "bg-gradient-to-br from-primary/10 via-background to-background",
        )}
        style={event.cover_image_url ? { backgroundImage: `url(${event.cover_image_url})` } : undefined}
      >
        {event.cover_image_url && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
        )}
        <div className="relative mx-auto max-w-2xl">
          <MinimalHeader />
          <div className="mt-6 space-y-3 text-center">
            {event.event_type && (
              <Badge variant="secondary" className="border-primary/20 bg-primary/10 text-primary">
                {event.event_type}
              </Badge>
            )}
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-5xl">{event.name}</h1>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {event.event_date && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {fmt(event.event_date, event.event_time)}
                </span>
              )}
              {event.location && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-foreground transition"
                >
                  <MapPin className="h-4 w-4" /> {event.location}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-8">
        {/* ── About ───────────────────────────────────────────────────── */}
        {(event.public_description || event.description) && (
          <Section title="About this event">
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {event.public_description || event.description}
            </p>
          </Section>
        )}

        {/* ── Schedule ────────────────────────────────────────────────── */}
        {event.show_schedule_public && event.schedule.length > 0 && (
          <Section title="Schedule">
            <ol className="space-y-0 divide-y divide-border/40 rounded-xl border border-border/60 overflow-hidden">
              {event.schedule.map((item) => (
                <li key={item.id} className="flex items-start gap-4 px-4 py-3">
                  <div className="w-20 shrink-0 pt-0.5">
                    {item.start_time ? (
                      <span className="text-sm font-semibold tabular-nums text-primary">
                        {fmt12(item.start_time)}
                      </span>
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground/50 mt-0.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.duration_min}m{item.owner ? ` · ${item.owner}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* ── RSVP ────────────────────────────────────────────────────── */}
        {event.show_rsvp_public && (
          <Section title="RSVP" id="rsvp">
            <Card className="border-border/60 p-6 shadow-soft">
              <div className="flex flex-col items-center gap-2 text-center">
                <UserCheck className="h-8 w-8 text-primary" aria-hidden />
                <h3 className="font-display text-lg font-semibold">Use your invitation link</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  To protect guest details, RSVP updates are available from the secure link
                  in your invitation email. If you cannot find it, contact the event organiser.
                </p>
              </div>
            </Card>
          </Section>
        )}

        {/* ── FAQs ────────────────────────────────────────────────────── */}
        {event.public_faqs.length > 0 && (
          <Section title="FAQs">
            <div className="divide-y divide-border/60 rounded-xl border border-border/60 overflow-hidden">
              {event.public_faqs.map((faq, i) => (
                <div key={i}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-medium hover:bg-muted/40 transition"
                    aria-expanded={openFaq === i}
                  >
                    <span>{faq.q}</span>
                    {openFaq === i
                      ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>
                  {openFaq === i && (
                    <p className="border-t border-border/40 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                      {faq.a}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Gift registry ────────────────────────────────────────────── */}
        {event.gift_registry_url && (
          <Section title="Gift registry">
            <div className="flex items-center gap-3 rounded-xl border border-border/60 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Gift className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">View gift registry</p>
                <p className="truncate text-xs text-muted-foreground">{event.gift_registry_url}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <a href={event.gift_registry_url?.startsWith("http") ? event.gift_registry_url : `https://${event.gift_registry_url}`} target="_blank" rel="noopener noreferrer">
                  View <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            </div>
          </Section>
        )}
      </main>

      <PoweredByFooter />
    </div>
  );
}

function MinimalHeader() {
  return (
    <div className="flex items-center gap-2">
      <BrandMark className="h-6 w-6" />
      <span className="font-display text-sm font-semibold">MelaBridge</span>
    </div>
  );
}

function PoweredByFooter() {
  return (
    <footer className="border-t border-border/40 py-5 text-center">
      <p className="text-xs text-muted-foreground">
        Powered by <span className="font-semibold">MelaBridge</span> — your information is kept private and shared only with the event host.
      </p>
    </footer>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id}>
      <h2 className="mb-4 font-display text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
