import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Ticket, MapPin, Calendar, User } from "lucide-react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { getPublicEventTickets, createTicketCheckout, finalizeTicketOrder } from "@/lib/tickets.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/tickets/$eventId")({
  head: () => ({
    meta: [
      { title: "Get tickets — MelaBridge" },
      { name: "description", content: "Purchase tickets to this event." },
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
          <h1 className="font-display text-2xl font-semibold">Tickets aren't available</h1>
          <p className="mt-2 text-sm text-muted-foreground">This event either doesn't exist or ticket sales aren't open.</p>
        </div>
      </PublicShell>
    );
  }

  const { event, types, organizer } = q.data;

  return (
    <PublicShell>
      {event.banner_url && (
        <div className="w-full">
          <img src={event.banner_url} alt="" className="h-40 w-full object-cover sm:h-64" />
        </div>
      )}
      <section className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <p className="text-xs uppercase tracking-widest text-primary">Tickets</p>
        <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{event.name}</h1>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {event.event_date && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(event.event_date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              {event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ""}
              {event.end_time ? ` – ${event.end_time.slice(0, 5)}` : ""}
            </span>
          )}
          {event.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{event.location}</span>}
          {organizer?.display_name && <span className="inline-flex items-center gap-1.5"><User className="h-4 w-4" />Hosted by {organizer.display_name}</span>}
        </div>

        {event.description && (
          <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{event.description}</p>
        )}

        <div className="mt-8 space-y-3">
          {types.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No tickets on sale right now. Check back soon.
            </div>
          ) : (
            types.map((t) => <PurchaseCard key={t.id} type={t as TicketType} eventName={event.name} eventId={event.id} />)
          )}
        </div>
      </section>
    </PublicShell>
  );
}

function PurchaseCard({ type, eventName, eventId }: { type: TicketType; eventName: string; eventId: string }) {
  const remaining = type.quantity != null ? Math.max(0, type.quantity - (type.sold_count ?? 0)) : null;
  const soldOut = remaining === 0;
  const isFree = type.price_cents === 0;
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [promo, setPromo] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [freeDone, setFreeDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const createCheckout = useServerFn(createTicketCheckout);

  const cap = Math.min(type.max_per_order ?? 10, remaining ?? type.max_per_order ?? 10);

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
        <p className="font-medium">You're in!</p>
        <p className="mt-1 text-sm">Your free ticket to {eventName} is reserved. A confirmation is on its way.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Ticket className="h-4 w-4 text-primary" />
            <p className="font-medium">{type.name}</p>
            {soldOut && <Badge variant="secondary">Sold out</Badge>}
            {isFree && <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Free</Badge>}
          </div>
          {type.description && <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>}
          <p className="mt-2 font-display text-xl font-semibold">{isFree ? "Free" : money(type.price_cents, type.currency)}</p>
          {remaining != null && !soldOut && <p className="text-xs text-muted-foreground">{remaining} remaining</p>}
        </div>
        {!open && (
          <Button variant="hero" disabled={soldOut} onClick={() => setOpen(true)} className="w-full sm:w-auto">
            {soldOut ? "Sold out" : isFree ? "Reserve" : "Get tickets"}
          </Button>
        )}
      </div>

      {open && !clientSecret && (
        <div className="mt-5 grid gap-3 border-t border-border pt-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Buying tickets to {eventName}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={1} max={cap} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(cap, Number(e.target.value) || 1)))} />
            </div>
            <div className="space-y-1.5">
              <Label>Total</Label>
              <div className="grid h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-medium">{isFree ? "Free" : `$${total.toLocaleString()}`}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Promo code (optional)</Label>
            <Input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Enter code if you have one" />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={beginCheckout} disabled={busy} className="sm:ml-auto">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isFree ? "Reserve tickets" : "Continue to payment"}
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
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : q.data?.ok ? (
          <div>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-600"><Ticket className="h-6 w-6" /></div>
            <h1 className="mt-4 font-display text-2xl font-semibold">You're in!</h1>
            <p className="mt-2 text-sm text-muted-foreground">Your tickets are confirmed. A receipt is on the way to your email.</p>
          </div>
        ) : (
          <div>
            <h1 className="font-display text-2xl font-semibold">Payment not confirmed</h1>
            <p className="mt-2 text-sm text-muted-foreground">{q.data?.error ?? "We couldn't confirm your payment. If you were charged, please contact the organizer."}</p>
          </div>
        )}
      </section>
    </PublicShell>
  );
}
