import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, MapPin, User, Mail, Ticket, Minus, Plus, Loader2, ArrowRight, ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getPublicEventTickets, createTicketCheckout, validateTicketCoupon } from "@/lib/tickets.functions";

export const Route = createFileRoute("/t/$eventId")({
  head: () => ({ meta: [{ title: "Tickets — MelaBridge" }, { name: "robots", content: "noindex" }] }),
  component: PublicTicketPage,
});
type PublicData = Awaited<ReturnType<typeof getPublicEventTickets>>;
type TicketType = NonNullable<PublicData["types"]>[number];
const money = (c: number, currency = "usd") => c === 0 ? "Free" : new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(c / 100);
function dateLine(date?: string | null, time?: string | null, endTime?: string | null) {
  if (!date) return null;
  const d = new Date(`${date}T${time || "12:00"}`);
  const dateText = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (!time) return dateText;
  const startText = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endText = endTime
    ? new Date(`${date}T${endTime}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;
  return `${dateText} · ${startText}${endText ? `–${endText}` : ""}`;
}
function cancellationText(event: {
  ticket_cancellation_policy?: string | null;
  ticket_cancellation_window_hours?: number | null;
  ticket_cancellation_terms?: string | null;
}) {
  const base = event.ticket_cancellation_policy === "allowed_until"
    ? `Cancellations are allowed until ${Math.max(1, Math.round((event.ticket_cancellation_window_hours ?? 24) / 24))} day${Math.round((event.ticket_cancellation_window_hours ?? 24) / 24) === 1 ? "" : "s"} before the event.`
    : event.ticket_cancellation_policy === "case_by_case"
      ? "Cancellation and refund requests are reviewed by the organizer."
      : "Tickets are non-refundable and cancellations are not allowed.";
  return event.ticket_cancellation_terms ? `${base} ${event.ticket_cancellation_terms}` : base;
}
function status(t: TicketType) {
  if (!t.is_active) return "unavailable";
  if (t.quantity != null && (t.sold_count ?? 0) >= t.quantity) return "sold out";
  if (t.sales_start && new Date(t.sales_start) > new Date()) return "not on sale";
  if (t.sales_end && new Date(t.sales_end) < new Date()) return "sale ended";
  return "available";
}
function PublicTicketPage() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getPublicEventTickets);
  const checkoutFn = useServerFn(createTicketCheckout);
  const validateCouponFn = useServerFn(validateTicketCoupon);
  const [data, setData] = useState<PublicData | null>(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<"tickets" | "details" | "processing">("tickets");
  const [selected, setSelected] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  useEffect(() => { setFailed(false); setData(null); getFn({ data: { eventId } }).then(setData).catch(() => setFailed(true)); }, [eventId, getFn]);
  const event = data?.event as (PublicData["event"] & {
    cover_image_url?: string | null; start_time?: string | null; end_time?: string | null;
    ticket_primary_color?: string | null; ticket_accent_color?: string | null;
    ticket_contact_name?: string | null; ticket_contact_email?: string | null;
    ticket_cancellation_policy?: string | null; ticket_cancellation_window_hours?: number | null;
    ticket_cancellation_terms?: string | null;
  }) | null | undefined;
  const types = useMemo(() => data?.types ?? [], [data?.types]);
  const selectedType = types.find(t => t.id === selected) ?? null;
  const max = selectedType ? Math.min(selectedType.quantity == null ? 10 : Math.max(0, selectedType.quantity - (selectedType.sold_count ?? 0)), (selectedType as TicketType & { max_per_order?: number }).max_per_order ?? 10) : 1;
  const earlyBirdActive = !!selectedType?.early_bird_ends_at
    && selectedType.early_bird_price_cents != null
    && new Date(selectedType.early_bird_ends_at).getTime() > Date.now();
  const unitPrice = earlyBirdActive ? selectedType!.early_bird_price_cents! : (selectedType?.price_cents ?? 0);
  const total = Math.round(unitPrice * (100 - couponDiscount) / 100) * quantity;
  async function applyCoupon() {
    if (!selectedType || !couponCode.trim()) return;
    setCheckingCoupon(true);
    try {
      const result = await validateCouponFn({ data: { ticketTypeId: selectedType.id, code: couponCode.trim() } });
      if (!result.valid) {
        setCouponDiscount(0);
        toast.error("Coupon code is invalid");
        return;
      }
      setCouponDiscount(result.discountPercent);
      toast.success(`${result.discountPercent}% coupon applied`);
    } finally {
      setCheckingCoupon(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!selectedType || !event) return; setStep("processing");
    try {
      const result = await checkoutFn({ data: { ticketTypeId: selectedType.id, quantity, buyerName: name.trim(), buyerEmail: email.trim(), promoCode: couponCode.trim() || undefined, environment: import.meta.env.PROD ? "live" : "sandbox" } });
      if ("error" in result) throw new Error(result.error);
      if ("freeOrderId" in result) { navigate({ to: `/t/${eventId}/confirm`, search: { session_id: `free_${result.freeOrderId}`, access_token: result.accessToken } }); return; }
      window.location.href = result.url;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Checkout could not start"); setStep("details"); }
  }
  if (!data && !failed) return <Shell><div className="mx-auto max-w-5xl animate-pulse px-4 py-12"><div className="h-72 rounded-[2rem] bg-muted" /><div className="mt-6 h-40 rounded-2xl bg-muted" /></div></Shell>;
  if (failed || !event) return <Shell><Empty title="This event is unavailable" body="The ticket page may have moved or ticket sales may be closed." onRetry={() => window.location.reload()} /></Shell>;
  const primary = event.ticket_primary_color || "#542d2b";
  const accent = event.ticket_accent_color || "#f1bd83";
  return <Shell>
    <main className="ticket-storefront mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">
      <style>{`.ticket-storefront .text-primary{color:${primary}!important}.ticket-storefront .bg-primary{background-color:${primary}!important}.ticket-storefront .border-primary{border-color:${primary}!important}`}</style>
      <section className="relative min-h-[260px] overflow-hidden rounded-2xl text-white shadow-[0_24px_70px_-30px_rgba(84,45,43,.65)] sm:min-h-[380px] sm:rounded-[2rem]" style={{ backgroundColor: primary }}>
        {event.cover_image_url || event.banner_url ? <img src={event.cover_image_url || event.banner_url || ""} alt="" className="absolute inset-0 h-full w-full object-cover opacity-65" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,#d88955,transparent_34%),linear-gradient(135deg,#542d2b,#8d4434)]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#321c1c]/90 via-[#321c1c]/20 to-transparent" />
        <div className="relative flex min-h-[260px] flex-col justify-end p-5 sm:min-h-[380px] sm:p-12">
          <p className="mb-3 text-xs font-bold uppercase tracking-[.28em]" style={{ color: accent }}>{event.event_type || "Gathering"} · Tickets</p>
          <h1 className="max-w-3xl font-display text-4xl leading-[.98] sm:text-7xl">{event.name}</h1>
          <div className="mt-5 flex flex-col gap-2 text-sm text-white/85 sm:mt-7 sm:flex-row sm:flex-wrap sm:gap-x-6">{dateLine(event.event_date, (event.start_time || event.event_time) as string | null, event.end_time) && <span className="inline-flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />{dateLine(event.event_date, (event.start_time || event.event_time) as string | null, event.end_time)}</span>}{event.location && <span className="inline-flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />{event.location}</span>}</div>
        </div>
      </section>
      <div className="mt-6 grid gap-6 sm:mt-8 lg:grid-cols-[1fr_390px] lg:gap-8">
        <div>
          <div className="mb-5 sm:mb-7"><p className="text-xs font-bold uppercase tracking-[.25em]" style={{ color: primary }}>You’re invited</p><h2 className="mt-2 font-display text-2xl text-foreground sm:text-3xl">Choose your tickets</h2>{event.description && <p className="mt-3 max-w-2xl whitespace-pre-line leading-7 text-muted-foreground">{event.description}</p>}{(event.ticket_contact_email || event.ticket_contact_name) && <div className="mt-4 rounded-xl border border-border/70 bg-muted/30 p-4 text-sm"><p className="font-semibold">Event support</p><p className="mt-1 text-muted-foreground">{event.ticket_contact_name || data?.organizer?.display_name || "Event organizer"}{event.ticket_contact_email && <> · <a className="underline hover:text-foreground" href={`mailto:${event.ticket_contact_email}`}>{event.ticket_contact_email}</a></>}</p></div>}</div>
          {types.length === 0 ? <Card className="border-border/60 p-10 text-center"><Ticket className="mx-auto mb-3 h-8 w-8 text-primary" /><p className="text-muted-foreground">Tickets are not available right now.</p></Card> : <div className="space-y-3">{types.map(t => { const s = status(t); const active = selected === t.id; return <button key={t.id} type="button" disabled={s !== "available"} onClick={() => { setSelected(t.id); setQuantity(1); }} className={`group w-full rounded-2xl border p-5 text-left transition-all ${active ? "border-primary bg-primary/5 shadow-[0_12px_35px_-20px_rgba(130,55,40,.6)]" : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/50"} ${s !== "available" ? "cursor-not-allowed opacity-50" : ""}`}><div className="flex items-start justify-between gap-4"><div><h3 className="font-display text-xl">{t.name}</h3>{t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}<p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s === "available" && t.quantity != null ? `${t.quantity - (t.sold_count ?? 0)} remaining` : s}</p></div><span className="shrink-0 font-display text-xl text-primary">{money(t.price_cents, t.currency)}</span></div></button>; })}</div>}
        </div>
        <aside className="lg:sticky lg:top-6 lg:self-start">{step === "tickets" && selectedType ? <Card className="border-primary/20 bg-card p-6 shadow-[0_20px_50px_-30px_rgba(84,45,43,.5)]"><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Your selection</p><h3 className="mt-2 font-display text-2xl">{selectedType.name}</h3><div className="mt-5 flex items-center justify-between border-y border-border py-4"><span className="text-sm text-muted-foreground">Quantity</span><div className="flex items-center gap-3"><button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity(q => q - 1)} className="grid h-9 w-9 place-items-center rounded-full border hover:bg-muted disabled:opacity-30"><Minus className="h-4 w-4" /></button><span className="w-5 text-center font-semibold">{quantity}</span><button type="button" aria-label="Increase quantity" disabled={quantity >= max} onClick={() => setQuantity(q => q + 1)} className="grid h-9 w-9 place-items-center rounded-full border hover:bg-muted disabled:opacity-30"><Plus className="h-4 w-4" /></button></div></div><div className="mt-5 flex justify-between"><span className="text-muted-foreground">Total</span><b className="font-display text-2xl">{money(total, selectedType.currency)}</b></div><Button className="mt-5 h-12 w-full gap-2" onClick={() => setStep("details")}>Continue <ArrowRight className="h-4 w-4" /></Button></Card> : step === "details" && selectedType ? <Card className="border-border/60 p-6"><button type="button" onClick={() => setStep("tickets")} className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Change tickets</button><h3 className="font-display text-2xl">Almost there</h3><p className="mt-1 text-sm text-muted-foreground">{quantity} × {selectedType.name} · {money(total, selectedType.currency)}</p><form onSubmit={submit} className="mt-6 space-y-4"><div><Label htmlFor="buyer-name">Full name</Label><div className="relative mt-1.5"><User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="buyer-name" className="pl-9" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" /></div></div><div><Label htmlFor="buyer-email">Email for confirmation</Label><div className="relative mt-1.5"><Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="buyer-email" type="email" className="pl-9" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div></div><div className="rounded-xl border border-border/70 bg-muted/50 p-3 text-xs leading-5"><p className="font-semibold text-foreground">Cancellation policy</p><p className="mt-1 text-muted-foreground">{cancellationText(event)}</p>{event.ticket_contact_email && <a href={`mailto:${event.ticket_contact_email}`} className="mt-2 inline-block font-medium text-primary underline">Contact {event.ticket_contact_name || "the organizer"}</a>}</div><div className="flex items-start gap-2"><Checkbox id="consent" checked={agreed} onCheckedChange={v => setAgreed(!!v)} /><Label htmlFor="consent" className="text-xs leading-5">I agree to the <Link to="/ticketing-terms" target="_blank" className="underline">Ticketing Terms</Link> and the cancellation policy shown above.</Label></div><Button type="submit" className="h-12 w-full gap-2" disabled={!agreed}>{selectedType.price_cents ? `Pay ${money(total, selectedType.currency)}` : "Claim tickets"} <ArrowRight className="h-4 w-4" /></Button></form></Card> : <Card className="border-border/60 p-6 text-center text-muted-foreground"><Ticket className="mx-auto mb-3 h-7 w-7 text-primary" /><p>Select a ticket to continue.</p></Card>}</aside>
      </div>
      {selectedType && (
        <Card className="mx-auto mt-4 max-w-md border-border/70 p-4 lg:mr-0">
          {earlyBirdActive && (
            <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Early-bird price applied: {money(unitPrice, selectedType.currency)} per ticket
            </p>
          )}
          <Label htmlFor="coupon-code">Coupon code <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <div className="mt-1.5 flex gap-2">
            <Input id="coupon-code" value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponDiscount(0); }} placeholder="Enter code" />
            <Button type="button" variant="outline" onClick={applyCoupon} disabled={checkingCoupon || !couponCode.trim()}>
              {checkingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
          {couponDiscount > 0 && <p className="mt-2 text-sm font-medium text-emerald-700">{couponDiscount}% discount applied · Total {money(total, selectedType.currency)}</p>}
        </Card>
      )}
      <div className="mt-14 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Secure checkout · Your details stay private</div>
    </main>
  </Shell>;
}
function Empty({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) { return <div className="mx-auto max-w-md px-4 py-24 text-center"><Ticket className="mx-auto mb-5 h-10 w-10 text-primary" /><h1 className="font-display text-3xl">{title}</h1><p className="mt-3 text-muted-foreground">{body}</p><Button variant="outline" className="mt-6" onClick={onRetry}>Try again</Button></div>; }
function Shell({ children }: { children: React.ReactNode }) { return <div className="min-h-[100dvh] bg-background"><header className="border-b border-border/70 bg-background/80 px-4 py-4 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between"><Link to="/" className="whitespace-nowrap font-display text-xl text-primary">MelaBridge</Link><span className="hidden text-xs uppercase tracking-[.22em] text-muted-foreground sm:inline">Good things happen together</span></div></header>{children}<footer className="border-t border-border/70 px-4 py-8 text-center text-xs text-muted-foreground">Tickets powered by MelaBridge</footer></div>; }