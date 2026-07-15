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
import { Loader2, Ticket, MapPin, Calendar } from "lucide-react";
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
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  quantity: number | null;
  sold_count: number | null;
};

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

  const { event, types } = q.data;

  return (
    <PublicShell>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs uppercase tracking-widest text-primary">Tickets</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">{event.name}</h1>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
          {event.event_date && (
            <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" />{new Date(event.event_date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}{event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ""}</span>
          )}
          {event.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{event.location}</span>}
        </div>

        <div className="mt-8 space-y-3">
          {types.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No tickets on sale right now. Check back soon.
            </div>
          ) : (
            types.map((t) => <PurchaseCard key={t.id} type={t} eventName={event.name} />)
          )}
        </div>
      </section>
    </PublicShell>
  );
}

function PurchaseCard({ type, eventName }: { type: TicketType; eventName: string }) {
  const remaining = type.quantity != null ? Math.max(0, type.quantity - (type.sold_count ?? 0)) : null;
  const soldOut = remaining === 0;
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const createCheckout = useServerFn(createTicketCheckout);

  async function beginCheckout() {
    if (!name.trim() || !email.trim()) { toast.error("Name and email are required"); return; }
    setBusy(true);
    try {
      const returnUrl = `${window.location.origin}/tickets/${window.location.pathname.split("/").pop()}?session_id={CHECKOUT_SESSION_ID}`;
      const result = await createCheckout({
        data: {
          ticketTypeId: type.id,
          quantity: qty,
          buyerName: name.trim(),
          buyerEmail: email.trim(),
          returnUrl,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in result) throw new Error(result.error);
      setClientSecret(result.clientSecret);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
    } finally { setBusy(false); }
  }

  const total = (type.price_cents * qty) / 100;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-primary" />
            <p className="font-medium">{type.name}</p>
            {soldOut && <Badge variant="secondary">Sold out</Badge>}
          </div>
          {type.description && <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>}
          <p className="mt-2 font-display text-xl font-semibold">${(type.price_cents / 100).toLocaleString()}</p>
          {remaining != null && !soldOut && <p className="text-xs text-muted-foreground">{remaining} remaining</p>}
        </div>
        {!open && (
          <Button variant="hero" disabled={soldOut} onClick={() => setOpen(true)}>{soldOut ? "Sold out" : "Get tickets"}</Button>
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
              <Input type="number" min={1} max={remaining ?? 20} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div className="space-y-1.5">
              <Label>Total</Label>
              <div className="grid h-10 place-items-start rounded-md border border-input bg-background px-3 py-2 text-sm font-medium">${total.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={beginCheckout} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continue to payment
            </Button>
          </div>
        </div>
      )}

      {clientSecret && (
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
