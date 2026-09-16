import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  CheckCircle2, Ticket, Mail, Calendar, MapPin, Download,
  Loader2, AlertTriangle, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandMark } from "@/components/brand-logo";
import { finalizeTicketOrder, getPublicOrderDetails, getPublicOrderTicketsPdf } from "@/lib/tickets.functions";

export const Route = createFileRoute("/t/$eventId/confirm")({
  validateSearch: z.object({
    session_id: z.string().optional(),
    access_token: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Order Confirmed — MelaBridge" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmPage,
});

type OrderDetails = NonNullable<Awaited<ReturnType<typeof getPublicOrderDetails>>>;

function fmt(cents: number, currency = "usd") {
  if (cents === 0) return "Free";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch { return `$${(cents / 100).toFixed(2)}`; }
}

function fmtDate(date?: string | null, time?: string | null) {
  if (!date) return null;
  try {
    const d = new Date(`${date}T${time ?? "00:00"}`);
    return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) +
      (time ? ` · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "");
  } catch { return date; }
}

function ConfirmPage() {
  const { eventId } = Route.useParams();
  const { session_id: sessionId, access_token: accessToken } = Route.useSearch();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const finalizeFn = useServerFn(finalizeTicketOrder);
  const detailsFn = useServerFn(getPublicOrderDetails);
  const pdfFn = useServerFn(getPublicOrderTicketsPdf);

  useEffect(() => {
    if (!sessionId || !accessToken) {
      setErrorMsg("This confirmation link is incomplete or invalid. Check your email for the confirmation.");
      setState("error");
      return;
    }
    const confirmedSessionId = sessionId;
    const confirmedAccessToken = accessToken;

    async function process() {
      try {
        const env = import.meta.env.PROD ? "live" : "sandbox";
        const fin = await finalizeFn({ data: { sessionId: confirmedSessionId, environment: env } });

        if (!fin.ok) {
          setErrorMsg((fin as { ok: false; error?: string }).error ?? "Could not confirm your order. Please check your email or contact the organizer.");
          setState("error");
          return;
        }

        const orderId = (fin as { ok: true; orderId?: string }).orderId;
        if (!orderId) {
          setState("success");
          return;
        }

        const d = await detailsFn({ data: { orderId, accessToken: confirmedAccessToken } });
        if (!d) {
          setErrorMsg("This confirmation link is invalid or has expired.");
          setState("error");
          return;
        }
        setDetails(d);
        setState("success");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please check your email for confirmation.");
        setState("error");
      }
    }

    process();
  }, [sessionId, accessToken, finalizeFn, detailsFn]);

  async function handleDownloadPdf() {
    if (!details || !accessToken) return;
    setDownloadingPdf(true);
    try {
      const result = await pdfFn({
        data: { orderId: details.order.id, accessToken },
      });
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = result.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <BrandMark className="h-7 w-7" />
          <span className="font-display text-sm font-semibold text-foreground">MelaBridge</span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-12 space-y-4">
        {state === "loading" && (
          <Card className="border-border/60 p-12 shadow-soft text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
            <h2 className="font-display text-lg font-semibold">Confirming your order…</h2>
            <p className="mt-2 text-sm text-muted-foreground">This will only take a moment.</p>
          </Card>
        )}

        {state === "error" && (
          <Card className="border-destructive/40 bg-destructive/5 p-8 shadow-soft text-center">
            <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-destructive" />
            <h2 className="font-display text-lg font-semibold">Something went wrong</h2>
            <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
            <Button asChild variant="outline" className="mt-5">
              <Link to={`/t/${eventId}` as never}>Back to event</Link>
            </Button>
          </Card>
        )}

        {state === "success" && (
          <>
            <Card className="border-border/60 p-8 shadow-soft text-center">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
              <h1 className="font-display text-2xl font-bold">
                {details?.order.amount_cents === 0 ? "You're registered!" : "Payment confirmed!"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {details?.order.buyer_email ? (
                  <>
                    <Mail className="inline h-3.5 w-3.5 mr-1" />
                    A confirmation email has been sent to <strong>{details.order.buyer_email}</strong>
                  </>
                ) : (
                  "A confirmation email has been sent to your address."
                )}
              </p>
            </Card>

            {details && (
              <>
                {/* Event info */}
                <Card className="border-border/60 p-4 shadow-soft">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Event</p>
                  <h2 className="font-display text-lg font-semibold">{details.event?.name}</h2>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {details.event?.event_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span>{fmtDate(details.event.event_date, details.event.event_time as string)}</span>
                      </div>
                    )}
                    {details.event?.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span>{details.event.location}</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Order summary */}
                <Card className="border-border/60 p-4 shadow-soft">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Order summary</p>
                  <div className="flex items-center justify-between text-sm">
                    <span>{details.order.quantity} × {details.type?.name ?? "Ticket"}</span>
                    <span className="font-semibold">{fmt(details.order.amount_cents ?? 0, details.order.currency)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Order #{details.order.id.slice(0, 8).toUpperCase()}</p>
                </Card>

                {/* Individual tickets */}
                {details.attendees.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Your tickets</p>
                    {details.attendees.map((a, i) => (
                      <div key={a.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm">{a.full_name ?? `Ticket ${i + 1}`}</span>
                        </div>
                        <a
                          href={`/ticket/${a.qr_code}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {/* PDF download */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    className="gap-2 flex-1"
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf || details.attendees.length === 0}
                  >
                    {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Download PDF tickets
                  </Button>
                  <Button asChild variant="outline" className="gap-2 flex-1">
                    <Link to={`/t/${eventId}` as never}>Buy more tickets</Link>
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        <p className="text-center text-[11px] text-muted-foreground pb-6">
          Powered by <span className="font-semibold">MelaBridge</span>
        </p>
      </main>
    </div>
  );
}
