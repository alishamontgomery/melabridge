import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar, MapPin, User, Ticket, Download, Loader2, AlertTriangle, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand-logo";
import { getTicketByCode, getPublicTicketPdf } from "@/lib/tickets.functions";

export const Route = createFileRoute("/ticket/$ticketCode")({
  head: () => ({
    meta: [
      { title: "Your Ticket — MelaBridge" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DigitalTicketPage,
});

type TicketData = NonNullable<Awaited<ReturnType<typeof getTicketByCode>>>;

function fmtDate(date?: string | null, time?: string | null) {
  if (!date) return null;
  try {
    const d = new Date(`${date}T${time ?? "00:00"}`);
    return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) +
      (time ? ` · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "");
  } catch { return date; }
}

function fmt(cents: number, currency = "usd") {
  if (cents === 0) return "Free";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch { return `$${(cents / 100).toFixed(2)}`; }
}

/** Detect iOS Safari */
function isIOSSafari() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

/** Detect Android Chrome */
function isAndroidChrome() {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent) && /chrome/i.test(navigator.userAgent);
}

function DigitalTicketPage() {
  const { ticketCode } = Route.useParams();
  const [ticket, setTicket] = useState<TicketData | null | undefined>(undefined);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [walletPlatform, setWalletPlatform] = useState<"apple" | "google" | null>(null);

  const getFn = useServerFn(getTicketByCode);
  const pdfFn = useServerFn(getPublicTicketPdf);

  useEffect(() => {
    getFn({ data: { ticketCode } })
      .then((d) => setTicket(d))
      .catch(() => setTicket(null));

    // Detect wallet platform
    if (isIOSSafari()) setWalletPlatform("apple");
    else if (isAndroidChrome()) setWalletPlatform("google");

    // Generate QR code client-side
    import("qrcode").then(({ default: QRCode }) => {
      const url = `${window.location.origin}/ticket/${ticketCode}`;
      QRCode.toDataURL(url, { width: 300, margin: 1, errorCorrectionLevel: "M" })
        .then(setQrDataUrl)
        .catch(() => {});
    });
  }, [ticketCode, getFn]);

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const result = await pdfFn({ data: { ticketCode } });
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

  function handleWallet() {
    toast.info(
      walletPlatform === "apple"
        ? "Apple Wallet support coming soon. For now, save the PDF or keep this page bookmarked."
        : "Google Wallet support coming soon. For now, save the PDF or keep this page bookmarked.",
    );
  }

  if (ticket === undefined) {
    return (
      <TicketShell>
        <div className="grid min-h-[50vh] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </TicketShell>
    );
  }

  if (ticket === null) {
    return (
      <TicketShell>
        <Card className="border-border/60 p-10 shadow-soft text-center max-w-sm mx-auto mt-16">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="font-display text-xl font-semibold">Ticket not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This ticket link is invalid or has expired. Check the link in your confirmation email.
          </p>
        </Card>
      </TicketShell>
    );
  }

  const { attendee, order, event, type } = ticket;

  return (
    <TicketShell>
      <div className="mx-auto max-w-sm px-4 py-8">
        {/* Digital ticket card */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elegant">
          {/* Top strip */}
          <div className="bg-gradient-to-r from-primary to-primary-glow px-5 py-4 text-primary-foreground">
            <div className="flex items-center gap-2 mb-0.5">
              <BrandMark className="h-5 w-5 opacity-90" />
              <span className="text-xs font-semibold uppercase tracking-widest opacity-80">MelaBridge · Admit One</span>
            </div>
            <h1 className="font-display text-xl font-bold mt-1 leading-tight">{event?.name}</h1>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {/* QR code */}
            <div className="flex justify-center py-2">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Ticket QR code — scan at event entrance"
                  className="h-48 w-48 rounded-lg border border-border/40 shadow-soft"
                />
              ) : (
                <div className="h-48 w-48 animate-pulse rounded-lg bg-muted" />
              )}
            </div>

            {/* Ticket details */}
            <div className="space-y-3 text-sm">
              <DetailRow icon={<Ticket className="h-4 w-4 text-primary" />} label="Ticket type">
                {type?.name ?? "Admission"}
              </DetailRow>
              <DetailRow icon={<User className="h-4 w-4 text-primary" />} label="Attendee">
                {attendee.full_name ?? order.buyer_name ?? "Guest"}
              </DetailRow>
              {event?.event_date && (
                <DetailRow icon={<Calendar className="h-4 w-4 text-primary" />} label="Date & time">
                  {fmtDate(event.event_date, event.event_time as string)}
                </DetailRow>
              )}
              {event?.location && (
                <DetailRow icon={<MapPin className="h-4 w-4 text-primary" />} label="Location">
                  {event.location}
                </DetailRow>
              )}
            </div>

            {/* Divider with perforated effect */}
            <div className="relative border-t border-dashed border-border/60 my-1">
              <div className="absolute -left-7 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-background border border-border/60" />
              <div className="absolute -right-7 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-background border border-border/60" />
            </div>

            {/* Meta */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Order #{order.id.slice(0, 8).toUpperCase()}</span>
              <Badge
                variant={attendee.checked_in_at ? "default" : "outline"}
                className="text-[10px]"
              >
                {attendee.checked_in_at ? "Checked in" : "Not checked in"}
              </Badge>
            </div>

            <p className="text-center text-[10px] text-muted-foreground">
              Present this QR code at the entrance. One scan per admission.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 space-y-2">
          <Button
            className="w-full gap-2"
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF ticket
          </Button>

          {walletPlatform && (
            <Button className="w-full gap-2" variant="outline" onClick={handleWallet}>
              <Wallet className="h-4 w-4" />
              {walletPlatform === "apple" ? "Add to Apple Wallet" : "Add to Google Wallet"}
              <span className="ml-auto text-[10px] text-muted-foreground">Coming soon</span>
            </Button>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Powered by <span className="font-semibold">MelaBridge</span>
        </p>
      </div>
    </TicketShell>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="font-medium leading-snug">{children}</p>
      </div>
    </div>
  );
}

function TicketShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 px-4 py-3">
        <div className="mx-auto flex max-w-sm items-center gap-2">
          <BrandMark className="h-7 w-7" />
          <span className="font-display text-sm font-semibold text-foreground">MelaBridge</span>
        </div>
      </header>
      {children}
    </div>
  );
}
