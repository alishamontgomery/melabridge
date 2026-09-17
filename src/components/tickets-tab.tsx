import { useState, useEffect, useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Ticket, TicketX, Users, DollarSign, QrCode, Copy, Check,
  Plus, Pencil, Loader2, Download, RefreshCw, ExternalLink,
  ChevronDown, ChevronUp, ScanLine, Trash2, RotateCcw,
  Bell, CheckCircle2, Crown, Lock, Info, Share2, ShieldCheck,
  XCircle, Clock, CalendarDays, MapPin, ImageIcon, Save, Archive,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { parseCurrency } from "@/lib/parse-currency";
import { normalizeDateInput, normalizeEmailInput, normalizeTimeInput, trimOrNull } from "@/lib/event-input-normalization";
import {
  listTicketTypes, createTicketType, updateTicketType, deleteTicketType,
  listTicketOrders, listAttendees,
  checkInAttendee, undoCheckInAttendee,
  addComplimentaryGuest,
  refundTicketOrder,
  getTicketPayoutStatus,
  createTicketPayoutOnboardingLink,
  createTicketPayoutDashboardLink,
  generateCheckinToken, listCheckinTokens, revokeCheckinToken,
  updateTicketPageDetails,
} from "@/lib/tickets.functions";
import { getStripeEnvironment } from "@/lib/stripe";

// ---- types ----
type TicketType = Awaited<ReturnType<typeof listTicketTypes>>[number];
type Order = Awaited<ReturnType<typeof listTicketOrders>>[number];
type Attendee = Awaited<ReturnType<typeof listAttendees>>[number];
type PayoutStatus = Awaited<ReturnType<typeof getTicketPayoutStatus>>;

interface TicketsTabProps {
  eventId: string;
  ticketsEnabled: boolean;
  onEventUpdated: () => Promise<void>;
}

// ---- helpers ----
function fmt(cents: number) {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ticketErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (!message || /<!doctype|<html|run this app to see the results|failed to fetch/i.test(message)) {
    return `${fallback}. Please try again.`;
  }
  return message.length > 240 ? `${fallback}. Please try again.` : message;
}

function ticketStripeEnvironment(): "sandbox" | "live" {
  try {
    return getStripeEnvironment();
  } catch {
    return import.meta.env.PROD ? "live" : "sandbox";
  }
}

function localDateTimeToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid sale date and time");
  return date.toISOString();
}

function ticketTypeStatus(t: TicketType): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  const now = Date.now();
  if (!t.is_active) return { label: "Archived", variant: "secondary" };
  if (t.quantity != null && (t.sold_count ?? 0) >= t.quantity) return { label: "Sold out", variant: "destructive" };
  if (t.sales_start && new Date(t.sales_start).getTime() > now) return { label: "Sale not started", variant: "outline" };
  if (t.sales_end && new Date(t.sales_end).getTime() < now) return { label: "Sale ended", variant: "secondary" };
  return { label: "On sale", variant: "default" };
}

// ---- blank row for the builder ----
function blankRow() {
  return {
    name: "", price: "0", quantity: "", maxPerOrder: "", description: "",
    salesStart: "", salesEnd: "", promoCode: "", promoDiscountPercent: "",
    earlyBirdPrice: "", earlyBirdEndsAt: "", id: Math.random().toString(36).slice(2),
  };
}
type BuilderRow = ReturnType<typeof blankRow>;

// ---- QR code generator (browser-only) ----
async function makeQr(url: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(url, { width: 256, margin: 1 });
}

export function TicketsTab({ eventId, ticketsEnabled, onEventUpdated }: TicketsTabProps) {
  const [enabled, setEnabled] = useState(ticketsEnabled);
  const [enabling, setEnabling] = useState(false);

  // keep in sync if parent reloads
  useEffect(() => { setEnabled(ticketsEnabled); }, [ticketsEnabled]);

  async function handleEnable() {
    setEnabling(true);
    const { error } = await supabase.from("events").update({ tickets_enabled: true }).eq("id", eventId);
    setEnabling(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ticketing enabled");
    setEnabled(true);
    await onEventUpdated();
  }

  if (!enabled) {
    return (
      <Card className="border-border/60 p-10 shadow-soft text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Ticket className="h-7 w-7 text-primary" />
        </div>
        <h3 className="font-display text-xl font-semibold">Sell tickets to your event</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          Create free or paid ticket types, track sales in real time, and manage check-ins — all in one place.
        </p>
        <Button className="mt-6 gap-2" onClick={handleEnable} disabled={enabling}>
          {enabling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
          Enable ticketing
        </Button>
      </Card>
    );
  }

  return <TicketsManager eventId={eventId} onEventUpdated={onEventUpdated} />;
}

function TicketPayoutCard({
  status,
  environment,
  onStatusChange,
}: {
  status: PayoutStatus | null;
  environment: "sandbox" | "live";
  onStatusChange: (status: PayoutStatus) => void;
}) {
  const onboardingFn = useServerFn(createTicketPayoutOnboardingLink);
  const dashboardFn = useServerFn(createTicketPayoutDashboardLink);
  const [busy, setBusy] = useState<"onboarding" | "dashboard" | null>(null);

  async function openOnboarding() {
    setBusy("onboarding");
    try {
      const result = await onboardingFn({ data: { environment } });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(ticketErrorMessage(error, "Could not open payout setup"));
      setBusy(null);
    }
  }

  async function openDashboard() {
    setBusy("dashboard");
    try {
      const result = await dashboardFn({ data: { environment } });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(ticketErrorMessage(error, "Could not open payout dashboard"));
      setBusy(null);
    }
  }

  if (!status) {
    return (
      <Card className="border-border/60 p-4 shadow-soft">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking payout readiness…
        </div>
      </Card>
    );
  }

  const ready = status.state === "ready";
  const actionRequired = status.state === "action_required" || status.state === "disabled";
  return (
    <Card className={`border-border/60 p-4 shadow-soft ${ready ? "bg-emerald-500/5" : "bg-primary/5"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {ready ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          )}
          <div>
            <p className="font-semibold">{ready ? "Payouts are ready" : "Finish payout setup before selling paid tickets"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {ready
                ? "Paid ticket funds route directly to your connected Stripe account. MelaBridge adds no ticketing fee."
                : actionRequired
                  ? "Stripe needs more information before paid ticket charges can be routed to you."
                  : "Connect Stripe to receive paid ticket funds directly in your own account."}
            </p>
            {status.disabled_reason && (
              <p className="mt-1 text-xs text-destructive">Stripe status: {status.disabled_reason}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {ready ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void openDashboard()} disabled={busy !== null} className="gap-1.5">
              {busy === "dashboard" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Manage payouts
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => void openOnboarding()} disabled={busy !== null} className="gap-1.5">
              {busy === "onboarding" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {status.state === "not_started" ? "Set up payouts" : "Continue setup"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---- Main manager (once tickets are enabled) ----
function TicketsManager({ eventId, onEventUpdated }: { eventId: string; onEventUpdated: () => Promise<void> }) {
  const [types, setTypes] = useState<TicketType[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [section, setSection] = useState("types");
  const [createRequest, setCreateRequest] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus | null>(null);

  const listTypesFn = useServerFn(listTicketTypes);
  const listOrdersFn = useServerFn(listTicketOrders);
  const listAttendeesFn = useServerFn(listAttendees);
  const payoutStatusFn = useServerFn(getTicketPayoutStatus);
  const payoutEnvironment = ticketStripeEnvironment();

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [t, o, a, payout] = await Promise.all([
        listTypesFn({ data: { eventId } }),
        listOrdersFn({ data: { eventId } }),
        listAttendeesFn({ data: { eventId } }),
        payoutStatusFn({ data: { environment: payoutEnvironment } }),
      ]);
      setTypes(t);
      setOrders(o);
      setAttendees(a);
      setPayoutStatus(payout);
    } catch (e) {
      setLoadError(ticketErrorMessage(e, "Could not load ticket data"));
    } finally {
      setLoading(false);
    }
  }, [eventId, listTypesFn, listOrdersFn, listAttendeesFn, payoutStatusFn, payoutEnvironment]);

  useEffect(() => { load(); }, [load]);

  // Live sales: reload on INSERT or UPDATE to ticket_orders (captures finalization, refunds)
  // AND on UPDATE to ticket_types (sold_count changes drive the metrics strip).
  useEffect(() => {
    const channelName = `ticket-sales-${eventId}-${Math.random().toString(36).slice(2)}`;
    const reload = () => { load(); };
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes" as any, {
        event: "INSERT",
        schema: "public",
        table: "ticket_orders",
        filter: `event_id=eq.${eventId}`,
      }, reload)
      .on("postgres_changes" as any, {
        event: "UPDATE",
        schema: "public",
        table: "ticket_orders",
        filter: `event_id=eq.${eventId}`,
      }, reload)
      .on("postgres_changes" as any, {
        event: "UPDATE",
        schema: "public",
        table: "ticket_types",
        filter: `event_id=eq.${eventId}`,
      }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- metrics ----
  const metrics = useMemo(() => {
    const sold = types.reduce((s, t) => s + (t.sold_count ?? 0), 0);
    const revenue = orders.filter((o) => o.status === "paid").reduce((s, o) => s + (o.amount_cents ?? 0), 0);
    const checkedIn = attendees.filter((a) => a.checked_in_at).length;
    const remaining = types.reduce((s, t) => {
      if (t.quantity == null) return s + Infinity;
      return s + (t.quantity - (t.sold_count ?? 0));
    }, 0);
    return { sold, revenue, checkedIn, remaining: isFinite(remaining) ? remaining : null };
  }, [types, orders, attendees]);

  async function copySalesLink() {
    const url = `${window.location.origin}/t/${eventId}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    toast.success("Sales link copied");
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function startTicket() {
    setSection("types");
    setCreateRequest((value) => value + 1);
  }

  if (loading) {
    return (
      <div className="grid min-h-[20vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="border-border/60 p-8 text-center shadow-soft">
        <TicketX className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h3 className="font-display text-lg font-semibold">Ticketing could not load</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{loadError}</p>
        <Button type="button" variant="outline" className="mt-4 gap-2" onClick={() => { setLoading(true); void load(); }}>
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Ticketing</p>
          <h2 className="mt-1 font-display text-3xl">Sell tickets</h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a href={`/t/${eventId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
              <ExternalLink className="h-4 w-4" /> View buyer page
            </a>
            <button type="button" onClick={copySalesLink} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              {linkCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {linkCopied ? "Link copied" : "Copy buyer link"}
            </button>
          </div>
        </div>
        <Button type="button" onClick={startTicket} className="h-11 w-full shrink-0 gap-2 sm:w-auto">
          <Plus className="h-4 w-4" /> Add ticket
        </Button>
      </div>

      <TicketPayoutCard
        status={payoutStatus}
        environment={payoutEnvironment}
        onStatusChange={setPayoutStatus}
      />

      {/* Metrics strip */}
      {(metrics.sold > 0 || orders.length > 0 || metrics.checkedIn > 0) && (
        <div className="grid grid-cols-2 divide-x divide-y overflow-hidden rounded-xl border border-border/70 bg-muted/20 sm:grid-cols-4 sm:divide-y-0">
          <MetricCard icon={Ticket} label="Sold" value={String(metrics.sold)} />
          <MetricCard icon={DollarSign} label="Revenue" value={`$${(metrics.revenue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} />
          <MetricCard icon={ScanLine} label="Checked in" value={String(metrics.checkedIn)} />
          <MetricCard icon={Users} label="Remaining" value={metrics.remaining === null ? "Unlimited" : String(metrics.remaining)} />
        </div>
      )}

      <Tabs value={section} onValueChange={setSection}>
        <div className="sm:hidden">
          <Label htmlFor="ticket-section" className="sr-only">Ticketing section</Label>
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger id="ticket-section" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="types">Setup & tickets</SelectItem>
              <SelectItem value="orders">Orders{orders.length > 0 ? ` (${orders.length})` : ""}</SelectItem>
              <SelectItem value="attendees">Guests{attendees.length > 0 ? ` (${attendees.length})` : ""}</SelectItem>
              <SelectItem value="notifications">Notifications</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <TabsList className="hidden sm:flex">
          <TabsTrigger value="types">Setup & tickets</TabsTrigger>
          <TabsTrigger value="orders">Orders{orders.length > 0 ? ` (${orders.length})` : ""}</TabsTrigger>
          <TabsTrigger value="attendees">Guests{attendees.length > 0 ? ` (${attendees.length})` : ""}</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="mt-4 space-y-5">
          <PublicPagePanel eventId={eventId} onEventUpdated={onEventUpdated} />
          <TicketTypesPanel eventId={eventId} types={types} reload={load} createRequest={createRequest} environment={payoutEnvironment} />
        </TabsContent>
        <TabsContent value="orders" className="mt-4">
          <OrdersPanel eventId={eventId} orders={orders} reload={load} />
        </TabsContent>
        <TabsContent value="attendees" className="mt-4">
          <AttendeesPanel eventId={eventId} attendees={attendees} types={types} orders={orders} reload={load} />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationPrefsPanel eventId={eventId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- Metric card ----
function MetricCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="p-3 sm:p-4">
      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[.12em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="font-display text-lg font-semibold sm:text-xl">{value}</div>
    </div>
  );
}

// --- TICKET TYPES PANEL ---
function TicketTypesPanel({ eventId, types, reload, createRequest, environment }: { eventId: string; types: TicketType[]; reload: () => Promise<void>; createRequest: number; environment: "sandbox" | "live" }) {
  const [showBuilder, setShowBuilder] = useState(types.length === 0);
  const [rows, setRows] = useState<BuilderRow[]>([blankRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [editType, setEditType] = useState<TicketType | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [advancedRowId, setAdvancedRowId] = useState<string | null>(null);
  const [archiveBusyId, setArchiveBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TicketType | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [menuTicketId, setMenuTicketId] = useState<string | null>(null);

  const createFn = useServerFn(createTicketType);
  const updateFn = useServerFn(updateTicketType);
  const deleteFn = useServerFn(deleteTicketType);

  useEffect(() => {
    if (createRequest > 0) setShowBuilder(true);
  }, [createRequest]);

  function updateRow(idx: number, patch: Partial<BuilderRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    const valid = rows.filter((r) => r.name.trim());
    if (!valid.length) { toast.error("Add at least one ticket type"); return; }
    setSubmitting(true);
    try {
      const prepared = valid.map((r) => {
        const price = parseCurrency(r.price);
        const quantity = r.quantity ? Number(r.quantity) : null;
        const maxPerOrder = r.maxPerOrder ? Number(r.maxPerOrder) : undefined;
        const salesStart = localDateTimeToIso(r.salesStart);
        const salesEnd = localDateTimeToIso(r.salesEnd);
        const earlyBirdPrice = r.earlyBirdPrice ? parseCurrency(r.earlyBirdPrice) : null;
        const earlyBirdEndsAt = localDateTimeToIso(r.earlyBirdEndsAt);
        const promoDiscountPercent = r.promoDiscountPercent ? Number(r.promoDiscountPercent) : null;
        if (price === null || price < 0) throw new Error(`Enter a valid price for "${r.name}"`);
        if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1)) throw new Error(`Enter a valid quantity for "${r.name}"`);
        if (maxPerOrder !== undefined && (!Number.isInteger(maxPerOrder) || maxPerOrder < 1 || maxPerOrder > 100)) {
          throw new Error(`Max per order for "${r.name}" must be between 1 and 100`);
        }
        if (salesStart && salesEnd && new Date(salesEnd) <= new Date(salesStart)) {
          throw new Error(`Sale end must be after sale start for "${r.name}"`);
        }
        if ((earlyBirdPrice !== null || earlyBirdEndsAt) && (earlyBirdPrice === null || !earlyBirdEndsAt)) {
          throw new Error(`Add both an early-bird price and end date for "${r.name}"`);
        }
        if (earlyBirdPrice !== null && earlyBirdPrice >= price) {
          throw new Error(`Early-bird price for "${r.name}" must be lower than the regular price`);
        }
        if ((r.promoCode.trim() || promoDiscountPercent) && (!r.promoCode.trim() || !promoDiscountPercent)) {
          throw new Error(`Add both a coupon code and discount for "${r.name}"`);
        }
        return { r, price, quantity, maxPerOrder, salesStart, salesEnd, earlyBirdPrice, earlyBirdEndsAt, promoDiscountPercent };
      });
      for (const { r, price, quantity, maxPerOrder, salesStart, salesEnd, earlyBirdPrice, earlyBirdEndsAt, promoDiscountPercent } of prepared) {
        await createFn({
          data: {
            eventId,
            environment,
            name: r.name.trim(),
            price_cents: Math.round(price * 100),
            quantity,
            max_per_order: maxPerOrder,
            description: r.description.trim() || null,
            sales_start: salesStart,
            sales_end: salesEnd,
            promo_code: r.promoCode.trim().toUpperCase() || null,
            promo_discount_percent: promoDiscountPercent,
            early_bird_price_cents: earlyBirdPrice === null ? null : Math.round(earlyBirdPrice * 100),
            early_bird_ends_at: earlyBirdEndsAt,
          },
        });
      }
      toast.success(valid.length === 1 ? "Ticket type published" : `${valid.length} ticket types published`);
      setRows([blankRow()]);
      setShowBuilder(false);
      await reload();
    } catch (err) {
      toast.error(ticketErrorMessage(err, "Could not publish tickets"));
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(t: TicketType) {
    setArchiveBusyId(t.id);
    try {
      await updateFn({ data: { id: t.id, is_active: false, environment } });
      toast.success(`"${t.name}" archived`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not archive");
    } finally { setArchiveBusyId(null); }
  }

  async function handleRestore(t: TicketType) {
    setArchiveBusyId(t.id);
    try {
      await updateFn({ data: { id: t.id, is_active: true, environment } });
      toast.success(`"${t.name}" restored`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restore");
    } finally { setArchiveBusyId(null); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteFn({ data: { id: deleteTarget.id } });
      toast.success(`"${deleteTarget.name}" permanently deleted`);
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      toast.error(ticketErrorMessage(err, "Could not delete this ticket"));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editType) return;
    setEditBusy(true);
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    try {
      const price = parseCurrency(fd.get("price") as string) ?? 0;
      const earlyPrice = fd.get("earlyBirdPrice") ? parseCurrency(fd.get("earlyBirdPrice") as string) : null;
      const earlyEnds = localDateTimeToIso(fd.get("earlyBirdEndsAt") as string);
      const promoCode = String(fd.get("promoCode") ?? "").trim().toUpperCase();
      const promoDiscount = fd.get("promoDiscountPercent") ? Number(fd.get("promoDiscountPercent")) : null;
      if ((earlyPrice !== null || earlyEnds) && (earlyPrice === null || !earlyEnds)) throw new Error("Add both an early-bird price and end date");
      if (earlyPrice !== null && earlyPrice >= price) throw new Error("Early-bird price must be lower than the regular price");
      if ((promoCode || promoDiscount) && (!promoCode || !promoDiscount)) throw new Error("Add both a coupon code and discount");
      await updateFn({
        data: {
          id: editType.id,
          environment,
          name: fd.get("name") as string,
          price_cents: Math.round(price * 100),
          quantity: fd.get("quantity") ? parseInt(fd.get("quantity") as string, 10) : null,
          max_per_order: fd.get("maxPerOrder") ? parseInt(fd.get("maxPerOrder") as string, 10) : undefined,
          description: (fd.get("description") as string) || null,
          sales_start: (fd.get("salesStart") as string) || null,
          sales_end: (fd.get("salesEnd") as string) || null,
          early_bird_price_cents: earlyPrice === null ? null : Math.round(earlyPrice * 100),
          early_bird_ends_at: earlyEnds,
          promo_code: promoCode || null,
          promo_discount_percent: promoDiscount,
        },
      });
      toast.success("Ticket type updated");
      setEditType(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Existing types list */}
      {types.length > 0 && (
        <div className="space-y-2">
          {types.map((t) => {
            const status = ticketTypeStatus(t);
            const soldPct = t.quantity ? Math.min(100, Math.round(((t.sold_count ?? 0) / t.quantity) * 100)) : 0;
            return (
              <Card key={t.id} className="relative border-border/60 p-4 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-medium ${!t.is_active ? "text-muted-foreground line-through" : ""}`}>{t.name}</span>
                      <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                      <span>{fmt(t.price_cents)}</span>
                      {t.quantity != null ? (
                        <span>{t.sold_count ?? 0} / {t.quantity} sold</span>
                      ) : (
                        <span>{t.sold_count ?? 0} sold · unlimited</span>
                      )}
                      {t.max_per_order && <span>Max {t.max_per_order}/order</span>}
                    </div>
                    {t.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{t.description}</p>}
                    {t.quantity != null && (
                      <Progress value={soldPct} className="mt-2 h-1.5" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setEditType(t)} className="gap-1.5 h-8" disabled={archiveBusyId === t.id}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`More actions for ${t.name}`}
                      onClick={() => setMenuTicketId(menuTicketId === t.id ? null : t.id)}
                      className="h-8 w-8"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    {menuTicketId === t.id && (
                      <div className="absolute right-4 top-12 z-20 flex min-w-32 flex-col rounded-xl border border-border bg-card p-1 shadow-lg">
                        {t.is_active ? (
                          <Button variant="ghost" size="sm" onClick={() => { setMenuTicketId(null); void handleArchive(t); }} disabled={archiveBusyId === t.id} className="justify-start gap-2">
                            {archiveBusyId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />} Archive
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => { setMenuTicketId(null); void handleRestore(t); }} disabled={archiveBusyId === t.id} className="justify-start gap-2">
                            {archiveBusyId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore
                          </Button>
                        )}
                        {!t.is_active && (
                          <div className="mt-1 border-t border-border pt-2">
                            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-destructive">Danger zone</p>
                            <Button variant="ghost" size="sm" onClick={() => { setMenuTicketId(null); setDeleteTarget(t); }} disabled={archiveBusyId === t.id} className="w-full justify-start gap-2 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" /> Delete permanently
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Builder */}
      {showBuilder ? (
        <Card className="overflow-hidden border-primary/20 bg-card shadow-elegant">
          <div className="border-b border-primary/15 bg-[#542d2b] px-5 py-5 text-[#fff5e8] sm:px-7">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#f1bd83]">New ticket</p>
                <h3 className="mt-2 font-display text-2xl leading-none sm:text-3xl">Add the essentials</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#ffe8cf]/75">Name, price, and availability are enough to publish. Optional rules can wait.</p>
              </div>
            </div>
          </div>
          <form onSubmit={handlePublish} className="space-y-5 pb-2">
            {rows.map((row, idx) => (
              <div key={row.id} className="mx-3 mt-5 space-y-5 rounded-2xl border border-border/70 bg-background/70 p-4 transition-colors focus-within:border-primary/40 sm:mx-7 sm:p-6">
                {rows.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[.18em] text-primary">Ticket {String(idx + 1).padStart(2, "0")}</span>
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                      className="h-7 gap-1 text-xs text-muted-foreground"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </Button>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`builder-${row.id}-name`} className="text-sm font-semibold">Ticket name <span className="text-destructive">*</span></Label>
                    <Input
                      id={`builder-${row.id}-name`}
                      placeholder="e.g. General admission"
                      value={row.name}
                      onChange={(e) => updateRow(idx, { name: e.target.value })}
                      required className="h-12 rounded-xl bg-card px-4 text-base shadow-sm"
                    />
                    <p className="text-xs text-muted-foreground">Use the words guests will recognize at a glance.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`builder-${row.id}-price`} className="text-sm font-semibold">Price <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                        <Input id={`builder-${row.id}-price`} type="text" inputMode="decimal" placeholder="0" value={row.price} onChange={(e) => updateRow(idx, { price: e.target.value })} className="h-11 rounded-xl bg-card pl-7 shadow-sm" />
                      </div>
                      <p className="text-[11px] text-muted-foreground">0 is free</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`builder-${row.id}-quantity`} className="text-sm font-semibold">Available</Label>
                      <Input id={`builder-${row.id}-quantity`} type="number" min="1" placeholder="Unlimited" value={row.quantity} onChange={(e) => updateRow(idx, { quantity: e.target.value })} className="h-11 rounded-xl bg-card shadow-sm" />
                      <p className="text-[11px] text-muted-foreground">Blank = unlimited</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/60 pt-4">
                  <button type="button" onClick={() => setAdvancedRowId(row.id)} className="flex w-full items-center justify-between rounded-xl py-1 text-left transition-colors hover:text-primary">
                    <span>
                      <span className="block text-sm font-medium">More ticket settings</span>
                       <span className="mt-0.5 block text-xs text-muted-foreground">Early bird, coupon, sale window, and order limit</span>
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                      <ChevronDown className="h-4 w-4 -rotate-90" />
                    </span>
                  </button>
                </div>
              </div>
            ))}

            <button type="button" onClick={() => setRows((prev) => [...prev, blankRow()])} className="mx-3 flex items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-primary transition-colors hover:text-primary/75 sm:mx-7">
              <Plus className="h-4 w-4" /> Add another ticket type
            </button>

            <div className="sticky bottom-0 z-10 mx-0 flex flex-col-reverse gap-3 border-t border-border/60 bg-card/95 px-4 pb-2 pt-4 backdrop-blur sm:mx-7 sm:flex-row sm:items-center sm:justify-between sm:bg-transparent sm:px-0">
              <p className="hidden text-xs leading-5 text-muted-foreground sm:block">You can edit, archive, or restore ticket types anytime.</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {types.length > 0 && (
                <Button type="button" variant="outline" onClick={() => setShowBuilder(false)}>Cancel</Button>
              )}
              <Button type="submit" disabled={submitting} className="h-12 w-full gap-1.5 rounded-xl px-5 text-base shadow-md sm:w-auto sm:h-11 sm:text-sm">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                Publish tickets
              </Button>
              </div>
            </div>
          </form>
        </Card>
      ) : (
        <Button onClick={() => setShowBuilder(true)} variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Add ticket type
        </Button>
      )}

      {types.length === 0 && !showBuilder && (
        <Card className="border-border/60 p-8 text-center shadow-soft">
          <TicketX className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No ticket types yet. Click &ldquo;Add ticket type&rdquo; to get started.</p>
        </Card>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleteBusy && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}” permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Tickets with order history cannot be deleted and must remain archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteBusy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteBusy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {advancedRowId && (() => {
        const idx = rows.findIndex((row) => row.id === advancedRowId);
        const row = rows[idx];
        if (!row) return null;
        return (
          <Dialog open onOpenChange={(open) => !open && setAdvancedRowId(null)}>
            <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <p className="text-[10px] font-bold uppercase tracking-[.22em] text-primary">Optional settings</p>
                <DialogTitle className="font-display text-2xl">{row.name.trim() || "Your ticket"}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Add sale timing and purchase rules only when this ticket needs them.</p>
              <div className="space-y-4 py-1">
                <div className="space-y-1.5">
                  <Label htmlFor={`builder-${row.id}-description`}>Short invitation note</Label>
                  <Textarea
                    id={`builder-${row.id}-description`}
                    rows={3}
                    placeholder="Details buyers should know…"
                    value={row.description}
                    onChange={(e) => updateRow(idx, { description: e.target.value })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`builder-${row.id}-sales-start`}>Sales open</Label>
                    <Input id={`builder-${row.id}-sales-start`} type="datetime-local" value={row.salesStart} onChange={(e) => updateRow(idx, { salesStart: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`builder-${row.id}-sales-end`}>Sales close</Label>
                    <Input id={`builder-${row.id}-sales-end`} type="datetime-local" value={row.salesEnd} onChange={(e) => updateRow(idx, { salesEnd: e.target.value })} />
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 p-4">
                  <h4 className="font-medium">Early-bird price</h4>
                  <p className="mt-1 text-xs text-muted-foreground">Automatically uses the lower price until the selected date.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`builder-${row.id}-early-price`}>Early-bird price</Label>
                      <Input id={`builder-${row.id}-early-price`} inputMode="decimal" placeholder="e.g. 40.00" value={row.earlyBirdPrice} onChange={(e) => updateRow(idx, { earlyBirdPrice: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`builder-${row.id}-early-end`}>Ends</Label>
                      <Input id={`builder-${row.id}-early-end`} type="datetime-local" value={row.earlyBirdEndsAt} onChange={(e) => updateRow(idx, { earlyBirdEndsAt: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 p-4">
                  <h4 className="font-medium">Coupon code</h4>
                  <p className="mt-1 text-xs text-muted-foreground">Buyers enter this code during checkout for a percentage discount.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`builder-${row.id}-coupon`}>Code</Label>
                      <Input id={`builder-${row.id}-coupon`} placeholder="WELCOME20" value={row.promoCode} onChange={(e) => updateRow(idx, { promoCode: e.target.value.toUpperCase() })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`builder-${row.id}-discount`}>Discount percent</Label>
                      <Input id={`builder-${row.id}-discount`} type="number" min="1" max="100" placeholder="20" value={row.promoDiscountPercent} onChange={(e) => updateRow(idx, { promoDiscountPercent: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`builder-${row.id}-max`}>Maximum tickets per order</Label>
                  <Input id={`builder-${row.id}-max`} type="number" min="1" max="100" placeholder="No limit" value={row.maxPerOrder} onChange={(e) => updateRow(idx, { maxPerOrder: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" className="w-full sm:w-auto" onClick={() => setAdvancedRowId(null)}>Done</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Edit dialog */}
      {editType && (
        <Dialog open onOpenChange={(v) => !v && setEditType(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Edit ticket type</DialogTitle></DialogHeader>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="et-name">Name</Label>
                <Input id="et-name" name="name" defaultValue={editType.name} required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="et-price">Price ($)</Label>
                  <Input id="et-price" name="price" type="text" inputMode="decimal" defaultValue={(editType.price_cents / 100).toFixed(2)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="et-qty">Quantity</Label>
                  <Input id="et-qty" name="quantity" type="number" min="1" placeholder="Unlimited" defaultValue={editType.quantity ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="et-mpo">Max per order</Label>
                  <Input id="et-mpo" name="maxPerOrder" type="number" min="1" max="100" defaultValue={(editType as TicketType & { max_per_order?: number }).max_per_order ?? 10} />
                </div>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <h4 className="font-medium">Early-bird price</h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="et-early-price">Early-bird price ($)</Label>
                    <Input id="et-early-price" name="earlyBirdPrice" inputMode="decimal" defaultValue={editType.early_bird_price_cents == null ? "" : (editType.early_bird_price_cents / 100).toFixed(2)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="et-early-end">Ends</Label>
                    <Input id="et-early-end" name="earlyBirdEndsAt" type="datetime-local" defaultValue={editType.early_bird_ends_at?.slice(0, 16) ?? ""} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <h4 className="font-medium">Coupon code</h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="et-promo-code">Code</Label>
                    <Input id="et-promo-code" name="promoCode" defaultValue={editType.promo_code ?? ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="et-promo-discount">Discount percent</Label>
                    <Input id="et-promo-discount" name="promoDiscountPercent" type="number" min="1" max="100" defaultValue={editType.promo_discount_percent ?? ""} />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="et-desc">Description</Label>
                <Textarea id="et-desc" name="description" rows={2} defaultValue={editType.description ?? ""} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="et-start">Sale start</Label>
                  <Input id="et-start" name="salesStart" type="datetime-local"
                    defaultValue={editType.sales_start ? editType.sales_start.slice(0, 16) : ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="et-end">Sale end</Label>
                  <Input id="et-end" name="salesEnd" type="datetime-local"
                    defaultValue={editType.sales_end ? editType.sales_end.slice(0, 16) : ""} />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setEditType(null)}>Cancel</Button>
                <Button type="submit" disabled={editBusy} className="gap-1.5">
                  {editBusy && <Loader2 className="h-4 w-4 animate-spin" />}Save changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// --- ORDERS PANEL ---
function OrdersPanel({ eventId, orders, reload }: { eventId: string; orders: Order[]; reload: () => Promise<void> }) {
  const [refundTarget, setRefundTarget] = useState<Order | null>(null);
  const [refunding, setRefunding] = useState(false);

  const refundFn = useServerFn(refundTicketOrder);

  async function handleRefund() {
    if (!refundTarget) return;
    setRefunding(true);
    try {
      const env = import.meta.env.PROD ? "live" : "sandbox";
      await refundFn({ data: { orderId: refundTarget.id, environment: env } });
      toast.success("Refund issued");
      setRefundTarget(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refund failed");
    } finally {
      setRefunding(false);
    }
  }

  function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
    if (s === "paid") return "default";
    if (s === "refunded" || s === "partially_refunded") return "secondary";
    if (s === "failed") return "destructive";
    return "outline";
  }

  if (orders.length === 0) {
    return (
      <Card className="border-border/60 p-10 text-center shadow-soft">
        <p className="text-sm text-muted-foreground">No orders yet. Orders will appear here after buyers purchase tickets.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left">Order</th>
                <th className="px-3 py-2.5 text-left">Buyer</th>
                <th className="px-3 py-2.5 text-left hidden sm:table-cell">Ticket</th>
                <th className="px-3 py-2.5 text-center hidden sm:table-cell">Qty</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-left hidden md:table-cell">Date</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border/60">
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium leading-tight">{o.buyer_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{o.buyer_email}</div>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell text-muted-foreground">
                    {(o as Order & { ticket_types?: { name: string } | null }).ticket_types?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center hidden sm:table-cell">{o.quantity}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{fmt(o.amount_cents ?? 0)}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={statusVariant(o.status)} className="text-xs capitalize">
                      {o.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      {o.status === "paid" && (
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setRefundTarget(o)}
                          title="Refund order"
                          aria-label="Refund order"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AlertDialog open={!!refundTarget} onOpenChange={(v) => !v && setRefundTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund this order?</AlertDialogTitle>
            <AlertDialogDescription>
              A full refund of <strong>{fmt(refundTarget?.amount_cents ?? 0)}</strong> will be issued to{" "}
              <strong>{refundTarget?.buyer_email}</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refunding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRefund}
              disabled={refunding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {refunding && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Issue refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- ATTENDEES PANEL ---
function AttendeesPanel({ eventId, attendees, types, orders, reload }: { eventId: string; attendees: Attendee[]; types: TicketType[]; orders: Order[]; reload: () => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [addingGuest, setAddingGuest] = useState(false);

  const checkInFn = useServerFn(checkInAttendee);
  const undoFn = useServerFn(undoCheckInAttendee);
  const addGuestFn = useServerFn(addComplimentaryGuest);

  // attendees link to type via order_id → order.ticket_type_id
  const typeMap = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t.name])), [types]);
  const orderTypeMap = useMemo(() => Object.fromEntries(orders.map((o) => [o.id, o.ticket_type_id])), [orders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return attendees;
    const q = search.toLowerCase();
    return attendees.filter((a) =>
      (a.full_name ?? "").toLowerCase().includes(q) ||
      (a.email ?? "").toLowerCase().includes(q) ||
      a.qr_code.toLowerCase().includes(q)
    );
  }, [attendees, search]);

  async function toggleCheckIn(a: Attendee) {
    setBusyId(a.id);
    try {
      if (a.checked_in_at) {
        await undoFn({ data: { id: a.id } });
        toast.success("Check-in undone");
      } else {
        await checkInFn({ data: { id: a.id } });
        toast.success(`${a.full_name || "Attendee"} checked in`);
      }
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update check-in");
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    const rows = [["Name", "Email", "Ticket Type", "Ticket Code", "Checked In", "Check-in Time"]];
    filtered.forEach((a) => rows.push([
      a.full_name ?? "",
      a.email ?? "",
      typeMap[orderTypeMap[a.order_id] ?? ""] ?? "",
      a.qr_code,
      a.checked_in_at ? "Yes" : "No",
      a.checked_in_at ? new Date(a.checked_in_at).toLocaleString() : "",
    ]));
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "attendees.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function submitGuest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setAddingGuest(true);
    try {
      await addGuestFn({ data: {
        eventId,
        ticketTypeId: String(form.get("ticketTypeId")),
        fullName: String(form.get("fullName")),
        email: String(form.get("email")),
      } });
      toast.success("Complimentary guest added and ticket emailed");
      setShowAddGuest(false);
      await reload();
    } catch (error) {
      toast.error(ticketErrorMessage(error, "Could not add guest"));
    } finally {
      setAddingGuest(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name, email, or ticket code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button size="sm" onClick={() => setShowAddGuest(true)} className="gap-1.5 sm:ml-auto">
          <Plus className="h-4 w-4" /> Add guest
        </Button>
        {attendees.length > 0 && <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
          <Download className="h-4 w-4" /> Export CSV
        </Button>}
      </div>

      {attendees.length === 0 ? <Card className="border-border/60 p-10 text-center shadow-soft"><Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">No guests yet. Add a complimentary guest or wait for ticket sales.</p></Card> : <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left">Attendee</th>
                <th className="px-3 py-2.5 text-left hidden sm:table-cell">Ticket Code</th>
                <th className="px-3 py-2.5 text-left hidden md:table-cell">Type</th>
                <th className="px-3 py-2.5 text-left">Check-in</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-t border-border/60">
                  <td className="px-3 py-2.5">
                    <div className="font-medium leading-tight">{a.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{a.email || "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell font-mono text-xs text-muted-foreground">
                    {a.qr_code.slice(0, 12)}…
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground text-xs">
                    {typeMap[orderTypeMap[a.order_id] ?? ""] ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {a.checked_in_at ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-xs gap-1">
                          <Check className="h-3 w-3" /> Checked in
                        </Badge>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {new Date(a.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <Button
                          variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground px-2"
                          disabled={busyId === a.id}
                          onClick={() => toggleCheckIn(a)}
                        >
                          {busyId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Undo"}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline" size="sm" className="h-7 gap-1.5 text-xs"
                        disabled={busyId === a.id}
                        onClick={() => toggleCheckIn(a)}
                      >
                        {busyId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Check in
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>}

      {search && filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">No attendees match &ldquo;{search}&rdquo;</p>
      )}
      <Dialog open={showAddGuest} onOpenChange={(open) => !addingGuest && setShowAddGuest(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add complimentary guest</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This creates a valid $0 ticket, counts against capacity, and emails the guest their QR code.</p>
          <form onSubmit={submitGuest} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="comp-name">Guest name</Label><Input id="comp-name" name="fullName" required /></div>
            <div className="space-y-1.5"><Label htmlFor="comp-email">Guest email</Label><Input id="comp-email" name="email" type="email" required /></div>
            <div className="space-y-1.5">
              <Label htmlFor="comp-ticket">Ticket type</Label>
              <Select name="ticketTypeId" required>
                <SelectTrigger id="comp-ticket"><SelectValue placeholder="Choose a ticket" /></SelectTrigger>
                <SelectContent>{types.filter((type) => type.is_active).map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" disabled={addingGuest}>{addingGuest && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Add guest</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- PUBLIC PAGE PANEL ---
function PublicPagePanel({ eventId, onEventUpdated }: { eventId: string; onEventUpdated: () => Promise<void> }) {
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/t/${eventId}`;
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<string>("public");
  const [loadingVisibility, setLoadingVisibility] = useState(true);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [eventOwnerId, setEventOwnerId] = useState("");
  const [eventDetails, setEventDetails] = useState({
    event_date: "", start_time: "", end_time: "", location: "", cover_image_url: "",
    ticket_primary_color: "#542d2b", ticket_accent_color: "#f1bd83",
    ticket_contact_name: "", ticket_contact_email: "",
    ticket_cancellation_policy: "no_cancellations",
    ticket_cancellation_window_hours: "1", ticket_cancellation_terms: "",
  });
  const [savingDetails, setSavingDetails] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const saveDetailsFn = useServerFn(updateTicketPageDetails);

  useEffect(() => {
    supabase.from("events").select("owner_id,event_visibility,event_date,event_time,start_time,end_time,location,cover_image_url,banner_url,ticket_primary_color,ticket_accent_color,ticket_contact_name,ticket_contact_email,ticket_cancellation_policy,ticket_cancellation_window_hours,ticket_cancellation_terms").eq("id", eventId).maybeSingle().then(({ data }) => {
      if (data) {
        const e = data as {
          owner_id?: string | null; event_visibility?: string | null; event_date?: string | null;
          event_time?: string | null; start_time?: string | null; end_time?: string | null;
          location?: string | null; cover_image_url?: string | null; banner_url?: string | null;
          ticket_primary_color?: string | null; ticket_accent_color?: string | null;
          ticket_contact_name?: string | null; ticket_contact_email?: string | null;
          ticket_cancellation_policy?: string | null; ticket_cancellation_window_hours?: number | null;
          ticket_cancellation_terms?: string | null;
        };
        setEventOwnerId(e.owner_id ?? "");
        setVisibility(e.event_visibility ?? "public");
        setEventDetails({
          event_date: e.event_date ?? "", start_time: e.start_time ?? e.event_time ?? "",
          end_time: e.end_time ?? "", location: e.location ?? "",
          cover_image_url: e.cover_image_url ?? e.banner_url ?? "",
          ticket_primary_color: e.ticket_primary_color ?? "#542d2b",
          ticket_accent_color: e.ticket_accent_color ?? "#f1bd83",
          ticket_contact_name: e.ticket_contact_name ?? "",
          ticket_contact_email: e.ticket_contact_email ?? "",
          ticket_cancellation_policy: e.ticket_cancellation_policy ?? "no_cancellations",
          ticket_cancellation_window_hours: String(Math.max(1, Math.round((e.ticket_cancellation_window_hours ?? 24) / 24))),
          ticket_cancellation_terms: e.ticket_cancellation_terms ?? "",
        });
      }
      setLoadingVisibility(false);
    });
    // Generate QR code
    makeQr(typeof window !== "undefined" ? `${window.location.origin}/t/${eventId}` : `/t/${eventId}`)
      .then(setQrDataUrl)
      .catch(() => {});
  }, [eventId]);

  async function saveEventDetails() {
    setSavingDetails(true);
    try {
      await saveDetailsFn({
        data: {
          eventId,
          event_date: normalizeDateInput(eventDetails.event_date),
          start_time: normalizeTimeInput(eventDetails.start_time),
          end_time: normalizeTimeInput(eventDetails.end_time),
          location: trimOrNull(eventDetails.location),
          cover_image_url: trimOrNull(eventDetails.cover_image_url),
          ticket_primary_color: eventDetails.ticket_primary_color,
          ticket_accent_color: eventDetails.ticket_accent_color,
          ticket_contact_name: trimOrNull(eventDetails.ticket_contact_name),
          ticket_contact_email: normalizeEmailInput(eventDetails.ticket_contact_email),
          ticket_cancellation_policy: eventDetails.ticket_cancellation_policy as "no_cancellations" | "case_by_case" | "allowed_until",
          ticket_cancellation_window_hours: eventDetails.ticket_cancellation_policy === "allowed_until"
            ? Number(eventDetails.ticket_cancellation_window_hours) * 24
            : null,
          ticket_cancellation_terms: trimOrNull(eventDetails.ticket_cancellation_terms),
        },
      });
      toast.success("Ticket page details saved");
      await onEventUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save ticket page details");
    } finally {
      setSavingDetails(false);
    }
  }

  async function uploadCover(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Choose an image under 8 MB"); return; }
    setUploadingCover(true);
    try {
      if (!eventOwnerId) throw new Error("Could not verify the event owner");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `logos/${eventOwnerId}/event-covers/${eventId}/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from("vendor-assets").upload(path, file, { upsert: true, contentType: file.type || `image/${ext}` });
      if (error) throw error;
      const { data: url } = supabase.storage.from("vendor-assets").getPublicUrl(data.path);
      setEventDetails((prev) => ({ ...prev, cover_image_url: url.publicUrl }));
      toast.success("Cover image ready — save to publish it");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Cover upload failed"); }
    finally { setUploadingCover(false); }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleVisibilityChange(v: string) {
    setVisibility(v);
    setSavingVisibility(true);
    const { error } = await supabase.from("events").update({ event_visibility: v } as never).eq("id", eventId);
    setSavingVisibility(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Visibility updated");
    await onEventUpdated();
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `tickets-qr-${eventId.slice(0, 8)}.png`;
    a.click();
  }

  return (
    <Card className="border-border/70 p-4 shadow-soft sm:p-5">
      <div className="mb-4">
        <h3 className="font-display text-xl font-semibold">Event details</h3>
        <p className="mt-1 text-sm text-muted-foreground">These appear at the top of the buyer page.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="ticket-page-event-date">Date</Label><Input id="ticket-page-event-date" type="date" disabled={loadingVisibility} value={eventDetails.event_date} onInput={(e) => { const value = e.currentTarget.value; setEventDetails((p) => ({ ...p, event_date: value })); }} onChange={(e) => setEventDetails((p) => ({ ...p, event_date: e.target.value }))} /></div>
        <div className="space-y-1.5"><Label htmlFor="ticket-page-location">Location</Label><Input id="ticket-page-location" disabled={loadingVisibility} value={eventDetails.location} onChange={(e) => setEventDetails((p) => ({ ...p, location: e.target.value }))} placeholder="Venue or address" /></div>
        <div className="space-y-1.5"><Label htmlFor="ticket-page-starts">Start time</Label><Input id="ticket-page-starts" type="time" disabled={loadingVisibility} value={eventDetails.start_time} onChange={(e) => setEventDetails((p) => ({ ...p, start_time: e.target.value }))} /></div>
        <div className="space-y-1.5"><Label htmlFor="ticket-page-ends">End time</Label><Input id="ticket-page-ends" type="time" disabled={loadingVisibility} value={eventDetails.end_time} onChange={(e) => setEventDetails((p) => ({ ...p, end_time: e.target.value }))} /></div>
      </div>
      <div className="mt-5 border-t border-border/70 pt-4">
        <h4 className="font-medium">Buyer support and cancellations</h4>
        <p className="mt-1 text-sm text-muted-foreground">Buyers see this before paying and in their confirmation email.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ticket-contact-name">Contact name</Label>
            <Input id="ticket-contact-name" value={eventDetails.ticket_contact_name} onChange={(e) => setEventDetails((p) => ({ ...p, ticket_contact_name: e.target.value }))} placeholder="Event organizer or team" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-contact-email">Contact email</Label>
            <Input id="ticket-contact-email" type="email" value={eventDetails.ticket_contact_email} onChange={(e) => setEventDetails((p) => ({ ...p, ticket_contact_email: e.target.value }))} placeholder="support@example.com" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ticket-cancellation-policy">Cancellation policy</Label>
            <Select value={eventDetails.ticket_cancellation_policy} onValueChange={(value) => setEventDetails((p) => ({ ...p, ticket_cancellation_policy: value }))}>
              <SelectTrigger id="ticket-cancellation-policy"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no_cancellations">No cancellations or refunds</SelectItem>
                <SelectItem value="case_by_case">Requests reviewed by the organizer</SelectItem>
                <SelectItem value="allowed_until">Cancellations allowed before the event</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {eventDetails.ticket_cancellation_policy === "allowed_until" && (
            <div className="space-y-1.5">
              <Label htmlFor="ticket-cancellation-window">Cancellation deadline</Label>
              <Select value={eventDetails.ticket_cancellation_window_hours} onValueChange={(value) => setEventDetails((p) => ({ ...p, ticket_cancellation_window_hours: value }))}>
                <SelectTrigger id="ticket-cancellation-window"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day before</SelectItem>
                  <SelectItem value="2">2 days before</SelectItem>
                  <SelectItem value="3">3 days before</SelectItem>
                  <SelectItem value="7">7 days before</SelectItem>
                  <SelectItem value="14">14 days before</SelectItem>
                  <SelectItem value="30">30 days before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className={`space-y-1.5 ${eventDetails.ticket_cancellation_policy === "allowed_until" ? "sm:col-span-1" : "sm:col-span-2"}`}>
            <Label htmlFor="ticket-cancellation-terms">Additional terms <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="ticket-cancellation-terms" rows={3} value={eventDetails.ticket_cancellation_terms} onChange={(e) => setEventDetails((p) => ({ ...p, ticket_cancellation_terms: e.target.value }))} placeholder="Explain exceptions, transfer rules, or how quickly you respond." />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"><ImageIcon className="h-4 w-4" />{uploadingCover ? "Uploading…" : eventDetails.cover_image_url ? "Change cover" : "Add cover"}<input type="file" accept="image/*" className="sr-only" disabled={loadingVisibility || uploadingCover} onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} /></label>
        <Button onClick={saveEventDetails} disabled={loadingVisibility || savingDetails} className="gap-1.5">
          {savingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save event details
        </Button>
      </div>

      <details className="group mt-4 border-t border-border/70 pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-sm font-medium">
          Customize buyer page
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 space-y-4">
          {eventDetails.cover_image_url && <img src={eventDetails.cover_image_url} alt="Current event cover" className="h-32 w-full rounded-xl object-cover" />}
          <div>
            <Label>Colors</Label>
            <div className="flex flex-wrap gap-2">
              {[
                ["#542d2b", "#f1bd83"],
                ["#17213a", "#93c5fd"],
                ["#214e43", "#f4c95d"],
                ["#4a2545", "#f0a6ca"],
              ].map(([primary, accent]) => (
                <button
                  key={primary}
                  type="button"
                  aria-label={`Use ${primary} and ${accent} storefront colors`}
                  onClick={() => setEventDetails((prev) => ({ ...prev, ticket_primary_color: primary, ticket_accent_color: accent }))}
                  className={`flex h-9 w-14 overflow-hidden rounded-full border-2 ${eventDetails.ticket_primary_color === primary && eventDetails.ticket_accent_color === accent ? "border-foreground" : "border-border"}`}
                >
                  <span className="h-full flex-1" style={{ backgroundColor: primary }} />
                  <span className="h-full flex-1" style={{ backgroundColor: accent }} />
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="color" value={eventDetails.ticket_primary_color} onChange={(e) => setEventDetails((prev) => ({ ...prev, ticket_primary_color: e.target.value }))} className="h-9 w-11 cursor-pointer rounded border-0 bg-transparent" />
                Main color
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="color" value={eventDetails.ticket_accent_color} onChange={(e) => setEventDetails((prev) => ({ ...prev, ticket_accent_color: e.target.value }))} className="h-9 w-11 cursor-pointer rounded border-0 bg-transparent" />
                Accent color
              </label>
            </div>
        </div>
        </div>
      </details>

      <details className="group mt-3 border-t border-border/70 pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-sm font-medium">
          Sharing, visibility & check-in
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 space-y-5">
          <div className="flex items-center gap-2">
            <Input value={publicUrl} readOnly className="min-w-0 font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={handleCopy} title="Copy link" aria-label="Copy link">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a href={`/checkin/${eventId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <ScanLine className="h-4 w-4" /> Open organizer scanner
            </a>
            {qrDataUrl && <Button variant="ghost" size="sm" onClick={downloadQr} className="gap-1.5"><Download className="h-4 w-4" /> Download QR</Button>}
          </div>
          <div className="space-y-1.5">
            <Label>Buyer page visibility</Label>
            <Select value={visibility} onValueChange={handleVisibilityChange} disabled={loadingVisibility || savingVisibility}>
              <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public — anyone can find it</SelectItem>
                <SelectItem value="link_only">Link only — direct link only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ScannerAccessPanel eventId={eventId} />
        </div>
      </details>
    </Card>
  );
}

// --- SCANNER ACCESS PANEL ---
type TokenRow = { id: string; label: string | null; expires_at: string; revoked_at: string | null; created_at: string };

function ScannerAccessPanel({ eventId }: { eventId: string }) {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<{ plain: string; url: string } | null>(null);
  const [expiryHours, setExpiryHours] = useState(24);

  const listFn = useServerFn(listCheckinTokens);
  const generateFn = useServerFn(generateCheckinToken);
  const revokeFn = useServerFn(revokeCheckinToken);

  const loadTokens = useCallback(async () => {
    try {
      const rows = await listFn({ data: { eventId } });
      setTokens(rows as TokenRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load access links");
    } finally {
      setLoading(false);
    }
  }, [eventId, listFn]);

  useEffect(() => { loadTokens(); }, [loadTokens]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await generateFn({ data: { eventId, expiresInHours: expiryHours } });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/staff-checkin/${eventId}?t=${result.plainToken}`;
      setNewToken({ plain: result.plainToken, url });
      await loadTokens();
      toast.success("Scanner access link generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate link");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    try {
      await revokeFn({ data: { tokenId: id } });
      await loadTokens();
      toast.success("Access link revoked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke link");
    } finally {
      setRevokingId(null); }
  }

  const activeTokens = tokens.filter((t) => !t.revoked_at && new Date(t.expires_at) > new Date());
  const inactiveTokens = tokens.filter((t) => t.revoked_at || new Date(t.expires_at) <= new Date());

  function fmtExpiry(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffH = Math.round((d.getTime() - now.getTime()) / 3_600_000);
    if (diffH <= 0) return "Expired";
    if (diffH < 24) return `Expires in ${diffH}h`;
    return `Expires ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
  }

  return (
    <Card className="border-border/60 p-5 shadow-soft space-y-4">
      <div>
        <h3 className="font-display font-semibold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Scanner access for staff
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate a time-limited link so door staff can scan tickets without needing your login.
        </p>
      </div>

      {/* New token just generated — show it prominently */}
      {newToken && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3 dark:border-emerald-800/40 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Access link ready — share it with your staff</p>
          </div>
          <div className="flex items-center gap-2">
            <Input value={newToken.url} readOnly className="font-mono text-xs" />
            <Button
              variant="outline" size="icon"
              onClick={() => { navigator.clipboard.writeText(newToken.url); toast.success("Copied!"); }}
              title="Copy link"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <a href={newToken.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Open scanner
              </Button>
            </a>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setNewToken(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Generate controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="scanner-link-expiry" className="text-xs">Link expires after</Label>
          <Select value={String(expiryHours)} onValueChange={(v) => setExpiryHours(Number(v))}>
            <SelectTrigger id="scanner-link-expiry" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">4 hours</SelectItem>
              <SelectItem value="12">12 hours</SelectItem>
              <SelectItem value="24">24 hours</SelectItem>
              <SelectItem value="48">2 days</SelectItem>
              <SelectItem value="72">3 days</SelectItem>
              <SelectItem value="168">7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Generate access link
        </Button>
      </div>

      {/* Active tokens */}
      {loading ? (
        <div className="h-8 animate-pulse rounded-md bg-muted" />
      ) : activeTokens.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Active links</p>
          <p className="text-xs text-muted-foreground">
            For security, the full link is only shown once when generated. Generate a new link if you need to reshare.
          </p>
          {activeTokens.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                {t.label && <p className="text-xs font-medium truncate">{t.label}</p>}
                <p className="text-xs text-muted-foreground">{fmtExpiry(t.expires_at)}</p>
              </div>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                title="Revoke access"
                disabled={revokingId === t.id}
                onClick={() => handleRevoke(t.id)}
                aria-label="Revoke access link"
              >
                {revokingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Inactive tokens */}
      {inactiveTokens.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground list-none flex items-center gap-1.5">
            <ChevronDown className="h-3.5 w-3.5 group-open:rotate-180 transition-transform" />
            {inactiveTokens.length} expired / revoked
          </summary>
          <div className="mt-2 space-y-1.5">
            {inactiveTokens.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 opacity-60">
                <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  {t.label && <p className="text-xs font-medium truncate">{t.label}</p>}
                  <p className="text-xs text-muted-foreground">
                    {t.revoked_at ? "Revoked" : "Expired"} · {new Date(t.revoked_at ?? t.expires_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="text-xs text-muted-foreground">
        Staff with the link can scan tickets and view the attendee list. They cannot edit your event, issue refunds, or access other organizer tools.
      </p>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TicketingTeaser — polished locked-state preview shown to Free users
// ─────────────────────────────────────────────────────────────────────────────

/** Exported so events/$eventId.tsx can pass it as a custom FeatureGate fallback. */
export function TicketingTeaser({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="space-y-5">
      {/* Feature intro card */}
      <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-6 shadow-soft sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-yellow-500/15">
            <Ticket className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="font-display text-xl font-semibold">Sell tickets to your event</h3>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                Create ticket types, accept Stripe payments, manage attendees, and track sales in real time — all from this tab.
              </p>
            </div>
            <ul className="grid gap-y-1.5 gap-x-6 sm:grid-cols-2">
              {[
                "Multiple ticket tiers & pricing",
                "Stripe-powered secure checkout",
                "QR code check-in for staff",
                "Real-time live sales dashboard",
                "Waitlist for sold-out types",
                "CSV attendee export",
              ].map((feat) => (
                <li key={feat} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  {feat}
                </li>
              ))}
            </ul>
          </div>

          <div className="shrink-0 sm:pt-0.5">
            <button
              onClick={onUpgrade}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Crown className="h-4 w-4" aria-hidden="true" />
              Unlock Ticketing
            </button>
          </div>
        </div>
      </Card>

      {/* Blurred demo preview — non-interactive hint of what awaits */}
      <div className="relative" aria-hidden="true">
        <div className="pointer-events-none select-none">
          <div className="grid gap-3 opacity-40 blur-[1.5px] sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { icon: Ticket, label: "Tickets Sold", value: "48" },
                { icon: DollarSign, label: "Gross Revenue", value: "$2,400.00" },
                { icon: ScanLine, label: "Checked In", value: "31" },
                { icon: Users, label: "Remaining", value: "52" },
              ] as const
            ).map(({ icon: Icon, label, value }) => (
              <Card key={label} className="border-border/60 p-4 shadow-soft">
                <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
                <div className="font-display text-2xl font-semibold">{value}</div>
              </Card>
            ))}
          </div>
        </div>

        {/* Overlay CTA */}
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-background/90 px-6 py-4 text-center shadow-soft backdrop-blur-sm">
            <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="text-sm font-medium">Upgrade to see your live sales data</p>
            <button
              onClick={onUpgrade}
              className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
              View plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification preferences — stored in localStorage per event
// ─────────────────────────────────────────────────────────────────────────────

type TicketNotifPrefs = {
  milestoneAlerts: boolean;
  dailySummary: boolean;
  perSaleEmails: boolean;
};

const DEFAULT_PREFS: TicketNotifPrefs = {
  milestoneAlerts: true,
  dailySummary: false,
  perSaleEmails: false,
};

function prefsKey(eventId: string) {
  return `ticket-notif-prefs:${eventId}`;
}

function loadPrefs(eventId: string): TicketNotifPrefs {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(prefsKey(eventId))
        : null;
    return { ...DEFAULT_PREFS, ...(raw ? (JSON.parse(raw) as Partial<TicketNotifPrefs>) : {}) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(eventId: string, prefs: TicketNotifPrefs) {
  try {
    localStorage.setItem(prefsKey(eventId), JSON.stringify(prefs));
  } catch { /* storage unavailable — silently ignore */ }
}

function NotificationPrefsPanel({ eventId }: { eventId: string }) {
  const [prefs, setPrefs] = useState<TicketNotifPrefs>(() => loadPrefs(eventId));

  function toggle(key: keyof TicketNotifPrefs) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      savePrefs(eventId, next);
      return next;
    });
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h4 className="font-medium">Ticket notifications</h4>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage the alerts you receive for this event's ticket activity.
        </p>
      </div>

      {/* Clarify what is server-managed vs browser-local preview */}
      <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-800/40 dark:bg-amber-950/30">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          <strong>Milestone</strong> and <strong>Exception</strong> alerts are managed server-side and fire by default.
          <em> Daily summary</em> and <em>Per-sale email</em> preferences are saved in this browser only and will
          sync to your account in an upcoming update.
        </p>
      </div>

      <Card className="divide-y divide-border/60 border-border/60 shadow-soft">
        <PrefRow
          title="Milestone alerts"
          description="In-app notification when sales reach 25%, 50%, 75%, 90%, and Sold Out."
          checked={prefs.milestoneAlerts}
          onCheckedChange={() => toggle("milestoneAlerts")}
        />
        <PrefRow
          title="Daily summary email"
          description="Once-per-day email with total sold, revenue, and remaining capacity."
          checked={prefs.dailySummary}
          onCheckedChange={() => toggle("dailySummary")}
        />
        <PrefRow
          title="Per-sale emails"
          description="Email to you whenever a new order is placed. Off by default to avoid inbox noise."
          checked={prefs.perSaleEmails}
          onCheckedChange={() => toggle("perSaleEmails")}
        />
        <PrefRow
          title="Exception alerts"
          description="Immediate notification for refunds, payment failures, and disputes. Always on."
          checked
          onCheckedChange={() => {}}
          disabled
        />
      </Card>

      <p className="text-xs text-muted-foreground">
        Preferences are saved in your browser. Exception alerts are always enabled regardless of other settings.
      </p>
    </div>
  );
}

function PrefRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {/* Accessible toggle switch */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Toggle ${title}`}
        disabled={disabled}
        onClick={onCheckedChange}
        className={[
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full",
          "border-2 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "bg-primary" : "bg-muted",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
