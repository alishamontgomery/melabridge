import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Loader2, Ticket, MapPin, Calendar, User, ShieldCheck, Lock, Mail, Share2, Clock, CheckCircle2,
} from "lucide-react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { getPublicEventTickets, createTicketCheckout, finalizeTicketOrder, joinTicketWaitlist } from "@/lib/tickets.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tickets/$eventId")({
  head: () => ({
    meta: [
      { title: "Get tickets — MelaBridge" },
      { name: "description", content: "Purchase tickets to this event securely." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: PublicTicketsPage,
});

type TicketType = {
  id: string; name: string; description: string | null;
  price_cents: number; currency: string;
  quantity: number | null; sold_count: number | null;
  max_per_order: number;
};

function money(cents: number, currency = "usd") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function PublicTicketsPage() {
  const { eventId } = Route.useParams();
  const { session_id } = Route.useSearch();
  const fetchPublic = useServerFn(getPublicEventTickets);

  const q = useQuery({
    queryKey: ["public-event-tickets", eventId],
    queryFn: () => fetchPublic({ data: { eventId } }),
  });

  if (session_id) return <ReturnPage sessionId={session_id} />;

  if (q.isLoading) {
    return (
      <PublicShell>
        <div className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PublicShell>
    );
  }
  if (!q.data?.event) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <Ticket className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold">Tickets aren't available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This event either doesn't exist or ticket sales aren't open right now.
          </p>
        </div>
      </PublicShell>
    );
  }

  const { event, types, organizer } = q.data;

  const eventDateLabel = event.event_date
    ? new Date(event.event_date).toLocaleDateString(undefined, {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      })
    : null;
  const timeLabel = [event.event_time?.slice(0, 5), event.end_time?.slice(0, 5)].filter(Boolean).join(" – ");

  const totalRemaining = types.reduce((sum, t) => {
    if (t.quantity == null) return sum + 9999;
    return sum + Math.max(0, t.quantity - (t.sold_count ?? 0));
  }, 0);
  const anySoldOut = types.length > 0 && totalRemaining === 0;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: event.name, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* user dismissed */ }
  };

  return (
    <PublicShell>
      {/* Hero */}
      <div className="relative isolate overflow-hidden border-b border-border bg-gradient-to-b from-primary/5 via-background to-background">
        {event.banner_url ? (
          <div className="relative">
            <img src={event.banner_url} alt="" className="h-56 w-full object-cover sm:h-80 md:h-96" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          </div>
        ) : (
          <div className="h-24 sm:h-32" aria-hidden />
        )}
        <div className="mx-auto -mt-16 max-w-5xl px-4 pb-8 sm:-mt-24 sm:pb-12">
          <div className="rounded-3xl border border-border bg-card/95 p-5 shadow-xl backdrop-blur sm:p-8">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {event.event_type && (
                    <Badge variant="secondary" className="uppercase tracking-widest text-[10px]">{event.event_type}</Badge>
                  )}
                  {anySoldOut && <Badge variant="destructive">Sold out</Badge>}
                  {!anySoldOut && totalRemaining > 0 && totalRemaining < 50 && (
                    <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400">Almost gone</Badge>
                  )}
                </div>
                <h1 className="mt-3 font-display text-2xl font-semibold leading-tight sm:text-4xl">{event.name}</h1>
                <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  {eventDateLabel && (
                    <span className="inline-flex items-start gap-2">
                      <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{eventDateLabel}{timeLabel ? ` · ${timeLabel}` : ""}</span>
                    </span>
                  )}
                  {event.location && (
                    <span className="inline-flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{event.location}</span>
                    </span>
                  )}
                  {organizer?.display_name && (
                    <span className="inline-flex items-start gap-2">
                      <User className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>Hosted by {organizer.display_name}</span>
                    </span>
                  )}
                  <span className="inline-flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Secure checkout · instant e-tickets</span>
                  </span>
                </div>
              </div>
              <Button variant="outline" size="icon" onClick={share} aria-label="Share event" className="shrink-0">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Left column */}
          <div className="min-w-0 space-y-8">
            {event.description && (
              <div>
                <h2 className="font-display text-lg font-semibold">About this event</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {event.description}
                </p>
              </div>
            )}

            {/* Tickets */}
            <div id="tickets">
              <h2 className="font-display text-lg font-semibold">Tickets</h2>
              <div className="mt-3 space-y-3">
                {types.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                    No tickets on sale right now. Check back soon.
                  </div>
                ) : (
                  types.map((t) => (
                    <PurchaseCard key={t.id} type={t as TicketType} eventName={event.name} eventId={event.id} />
                  ))
                )}
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Payments processed securely by Stripe. We never see your card details.
              </p>
            </div>

            {/* Venue */}
            {event.location && (
              <div>
                <h2 className="font-display text-lg font-semibold">Venue</h2>
                <p className="mt-2 text-sm text-muted-foreground">{event.location}</p>
                <div className="mt-3 overflow-hidden rounded-2xl border border-border">
                  <iframe
                    title={`Map of ${event.location}`}
                    src={`https://www.google.com/maps?q=${encodeURIComponent(event.location)}&output=embed`}
                    className="h-64 w-full sm:h-80"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                  target="_blank" rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" /> Open in Google Maps
                </a>
              </div>
            )}

            {/* FAQ */}
            <div>
              <h2 className="font-display text-lg font-semibold">Frequently asked</h2>
              <Accordion type="single" collapsible className="mt-2">
                <AccordionItem value="q1">
                  <AccordionTrigger>How will I receive my tickets?</AccordionTrigger>
                  <AccordionContent>
                    Right after checkout you'll get a confirmation email with a QR code for each attendee. Bring the email or a printed copy — either works at the door.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q2">
                  <AccordionTrigger>Is my payment secure?</AccordionTrigger>
                  <AccordionContent>
                    Yes. Payments are processed by Stripe, a PCI-DSS Level 1 certified provider. Your card details never touch our servers.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q3">
                  <AccordionTrigger>Can I get a refund?</AccordionTrigger>
                  <AccordionContent>
                    Refund policies are set by the event organizer. Reach out using the contact below and they'll help sort things out.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q4">
                  <AccordionTrigger>Can I transfer my ticket?</AccordionTrigger>
                  <AccordionContent>
                    Tickets are tied to the QR code, not the buyer's name — you can forward the confirmation email to anyone who's coming in your place.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q5">
                  <AccordionTrigger>Do I need to print my ticket?</AccordionTrigger>
                  <AccordionContent>
                    No — showing the QR code on your phone at check-in is perfect.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Organizer contact */}
            {organizer?.display_name && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Organizer</p>
                    <p className="mt-0.5 font-medium">{organizer.display_name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Questions about the event? Message the organizer through your confirmation email after purchase.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right column — sticky trust summary (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">At a glance</p>
                <ul className="mt-3 space-y-3 text-sm">
                  {eventDateLabel && (
                    <li className="flex items-start gap-3">
                      <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span><span className="font-medium">{eventDateLabel}</span>{timeLabel && <div className="text-muted-foreground">{timeLabel}</div>}</span>
                    </li>
                  )}
                  {event.location && (
                    <li className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0">{event.location}</span>
                    </li>
                  )}
                  {types.length > 0 && (
                    <li className="flex items-start gap-3">
                      <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>
                        {types.length} ticket type{types.length === 1 ? "" : "s"} · from{" "}
                        <span className="font-medium">
                          {money(Math.min(...types.map((t) => t.price_cents)), types[0].currency)}
                        </span>
                      </span>
                    </li>
                  )}
                </ul>
                <Button variant="hero" className="mt-4 w-full" onClick={() => document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth" })}>
                  Get tickets
                </Button>
              </div>
              <div className="rounded-2xl border border-border bg-card/60 p-4 text-xs text-muted-foreground">
                <p className="flex items-center gap-2 text-foreground"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Trusted checkout</p>
                <p className="mt-1.5">Secure Stripe payments, instant QR e-tickets, and email confirmation the moment you check out.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </PublicShell>
  );
}

function PurchaseCard({ type, eventName, eventId }: { type: TicketType; eventName: string; eventId: string }) {
  const remaining = type.quantity != null ? Math.max(0, type.quantity - (type.sold_count ?? 0)) : null;
  const soldOut = remaining === 0;
  const isFree = type.price_cents === 0;
  const low = remaining != null && remaining > 0 && remaining <= 10;
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [promo, setPromo] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [freeDone, setFreeDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const createCheckout = useServerFn(createTicketCheckout);

  const cap = useMemo(
    () => Math.min(type.max_per_order ?? 10, remaining ?? type.max_per_order ?? 10),
    [type.max_per_order, remaining]
  );

  async function beginCheckout() {
    if (!name.trim() || !email.trim()) { toast.error("Name and email are required"); return; }
    setBusy(true);
    try {
      const returnUrl = `${window.location.origin}/tickets/${eventId}?session_id={CHECKOUT_SESSION_ID}`;
      const result = await createCheckout({
        data: {
          ticketTypeId: type.id, quantity: qty,
          buyerName: name.trim(), buyerEmail: email.trim(),
          promoCode: promo.trim() || null,
          returnUrl, environment: getStripeEnvironment(),
        },
      });
      if ("error" in result) throw new Error(result.error);
      if (isFree) { setFreeDone(true); return; }
      setClientSecret(result.clientSecret);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
    } finally { setBusy(false); }
  }

  const total = (type.price_cents * qty) / 100;

  if (freeDone) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">You're in!</p>
            <p className="mt-1 text-sm">Your free ticket to {eventName} is reserved. A confirmation is on its way to {email}.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-2xl border bg-card p-5 transition-shadow",
      open ? "border-primary/50 shadow-md" : "border-border hover:shadow-sm"
    )}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Ticket className="h-4 w-4 shrink-0 text-primary" />
            <p className="truncate font-medium">{type.name}</p>
            {soldOut && <Badge variant="secondary">Sold out</Badge>}
            {isFree && !soldOut && <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Free</Badge>}
            {low && !soldOut && <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400">Only {remaining} left</Badge>}
          </div>
          {type.description && <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>}
          <p className="mt-2 font-display text-xl font-semibold">
            {isFree ? "Free" : money(type.price_cents, type.currency)}
          </p>
          {remaining != null && !soldOut && !low && (
            <p className="text-xs text-muted-foreground">{remaining} remaining</p>
          )}
        </div>
        {!open && (
          <Button
            variant={soldOut ? "outline" : "hero"}
            onClick={() => setOpen(true)}
            className="shrink-0"
          >
            {soldOut ? "Join waitlist" : isFree ? "Reserve" : "Get tickets"}
          </Button>
        )}
      </div>

      {open && soldOut && (
        <WaitlistForm
          type={type}
          eventId={eventId}
          eventName={eventName}
          onCancel={() => setOpen(false)}
        />
      )}


      {open && !clientSecret && (
        <div className="mt-5 grid gap-3 border-t border-border pt-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Buying tickets to {eventName}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`name-${type.id}`}>Full name</Label>
              <Input id={`name-${type.id}`} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`email-${type.id}`}>Email</Label>
              <Input id={`email-${type.id}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`qty-${type.id}`}>Quantity</Label>
              <Input
                id={`qty-${type.id}`}
                type="number" min={1} max={cap} value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(cap, Number(e.target.value) || 1)))}
              />
              <p className="text-[11px] text-muted-foreground">Max {cap} per order</p>
            </div>
            <div className="space-y-1.5">
              <Label>Total</Label>
              <div className="grid h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-medium">
                {isFree ? "Free" : `$${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`promo-${type.id}`}>Promo code (optional)</Label>
            <Input id={`promo-${type.id}`} value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Enter code if you have one" />
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Payment secured by Stripe. We never store your card.
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={beginCheckout} disabled={busy} className="sm:ml-auto">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isFree ? "Reserve tickets" : "Continue to payment"}
            </Button>
          </div>
        </div>
      )}

      {clientSecret && !isFree && (
        <div id="checkout" className="mt-5 border-t border-border pt-5">
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      )}
    </div>
  );
}

function ReturnPage({ sessionId }: { sessionId: string }) {
  const finalize = useServerFn(finalizeTicketOrder);
  const q = useQuery({
    queryKey: ["finalize-ticket", sessionId],
    queryFn: () => finalize({ data: { sessionId, environment: getStripeEnvironment() } }),
    retry: 2,
  });

  return (
    <PublicShell>
      <section className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-4 py-16 text-center">
        {q.isLoading ? (
          <div>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Confirming your payment…</p>
          </div>
        ) : q.data?.ok ? (
          <div>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold">You're in!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your tickets are confirmed. A receipt with QR codes is on its way to your email.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5 text-primary" /> Check your inbox in the next minute or two.
            </div>
          </div>
        ) : (
          <div>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
              <Clock className="h-7 w-7" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold">Payment not confirmed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {q.data?.error ?? "We couldn't confirm your payment. If you were charged, please contact the organizer."}
            </p>
          </div>
        )}
      </section>
    </PublicShell>
  );
}
