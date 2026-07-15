import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Ticket, Plus, Loader2, Trash2, CheckCircle2, Copy, MoreVertical, Search,
  Download, Sparkles, ExternalLink, Pause, Play, Pencil, Mail, Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { useEcosystem } from "@/lib/ecosystem-store";
import {
  listTicketTypes, createTicketType, updateTicketType, deleteTicketType,
  duplicateTicketType, listTicketOrders, listAttendees, checkInAttendee,
  undoCheckInAttendee, resendOrderConfirmation, parseTicketPrompt,
  refundTicketOrder, getOrderTicketsPdf,
} from "@/lib/tickets.functions";
import { getStripeEnvironment } from "@/lib/stripe";


export const Route = createFileRoute("/tickets")({
  head: () => ({
    meta: [
      { title: "Tickets — MelaBridge" },
      { name: "description", content: "Sell tickets, manage orders, and check guests in from your event workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TicketsPage,
});

// ---------- Types ----------
type TicketTypeRow = {
  id: string; name: string; description: string | null;
  price_cents: number; currency: string; quantity: number | null;
  sold_count: number | null; is_active: boolean; max_per_order: number;
  visibility: "public" | "unlisted"; promo_code: string | null;
  sales_start: string | null; sales_end: string | null;
};

function money(cents: number, currency = "usd") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

// ---------- Page ----------
function TicketsPage() {
  const { event, hasEvent } = useEcosystem();
  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState<TicketTypeRow | null>(null);

  const listTypes = useServerFn(listTicketTypes);
  const listOrders = useServerFn(listTicketOrders);
  const listAtt = useServerFn(listAttendees);

  const typesQ = useQuery({
    queryKey: ["ticket-types", event.id], enabled: !!event.id,
    queryFn: () => listTypes({ data: { eventId: event.id! } }),
  });
  const ordersQ = useQuery({
    queryKey: ["ticket-orders", event.id], enabled: !!event.id,
    queryFn: () => listOrders({ data: { eventId: event.id! } }),
  });
  const attQ = useQuery({
    queryKey: ["ticket-attendees", event.id], enabled: !!event.id,
    queryFn: () => listAtt({ data: { eventId: event.id! } }),
  });

  const types = (typesQ.data ?? []) as TicketTypeRow[];
  const orders = ordersQ.data ?? [];
  const attendees = attQ.data ?? [];

  const paidOrders = orders.filter((o: { status: string }) => o.status === "paid");
  const revenue = paidOrders.reduce((s: number, o: { amount_cents: number }) => s + (o.amount_cents ?? 0), 0);
  const sold = types.reduce((s, t) => s + (t.sold_count ?? 0), 0);
  const inventory = types.reduce(
    (s, t) => s + (t.quantity != null ? Math.max(0, (t.quantity ?? 0) - (t.sold_count ?? 0)) : 0), 0,
  );
  const todayStr = new Date().toISOString().slice(0, 10);
  const checkinsToday = attendees.filter(
    (a: { checked_in_at: string | null }) => a.checked_in_at?.slice(0, 10) === todayStr,
  ).length;

  const shareUrl = typeof window !== "undefined" && event.id
    ? `${window.location.origin}/tickets/${event.id}` : "";

  return (
    <AppShell active="/tickets">
      <PageHeader
        eyebrow="Tickets"
        icon={Ticket}
        title={<>Sell admissions <span className="text-gradient">from your event workspace</span>.</>}
        description={hasEvent ? `${event.name} · manage tiers, orders, attendees, and analytics.` : "Create an event first to enable ticketing."}
        actions={
          hasEvent ? (
            <div className="flex flex-wrap gap-2">
              {shareUrl && (
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Buy link copied"); }}>
                  <Copy className="mr-2 h-4 w-4" />Copy buy link
                </Button>
              )}
              {shareUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />View public page</a>
                </Button>
              )}
              <Button variant="hero" size="sm" onClick={() => setOpenAdd(true)}>
                <Plus className="mr-2 h-4 w-4" />New ticket type
              </Button>
            </div>
          ) : null
        }
      />

      {!hasEvent ? (
        <EmptyTickets />
      ) : (
        <>
          <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Tickets sold" value={String(sold)} />
            <Stat label="Gross revenue" value={money(revenue)} />
            <Stat label="Remaining inventory" value={inventory > 0 ? String(inventory) : "—"} />
            <Stat label="Check-ins today" value={String(checkinsToday)} />
          </section>

          {hasEvent && <QuickCreate eventId={event.id!} />}

          <Tabs defaultValue="types" className="mt-6">
            <TabsList className="flex-wrap">
              <TabsTrigger value="types">Ticket types ({types.length})</TabsTrigger>
              <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
              <TabsTrigger value="attendees">Attendees ({attendees.length})</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="types" className="mt-4">
              {typesQ.isLoading ? <CenterSpinner /> : types.length === 0 ? (
                <EmptyBox msg="No ticket types yet." action={<Button variant="hero" size="sm" onClick={() => setOpenAdd(true)}><Plus className="mr-2 h-4 w-4" />Create your first ticket</Button>} />
              ) : (
                <div className="space-y-3">
                  {types.map((t) => (
                    <TypeRow key={t.id} row={t} eventId={event.id!} onEdit={() => setEditing(t)} shareUrl={shareUrl} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="orders" className="mt-4">
              <OrdersTab orders={orders} loading={ordersQ.isLoading} />
            </TabsContent>

            <TabsContent value="attendees" className="mt-4">
              <AttendeesTab attendees={attendees} loading={attQ.isLoading} eventName={event.name} />
            </TabsContent>

            <TabsContent value="analytics" className="mt-4">
              <AnalyticsTab orders={orders} types={types} attendees={attendees} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {hasEvent && (
        <TicketTypeDialog
          open={openAdd || !!editing}
          onOpenChange={(v) => { if (!v) { setOpenAdd(false); setEditing(null); } }}
          eventId={event.id!}
          existing={editing}
        />
      )}
    </AppShell>
  );
}

// ---------- Small UI helpers ----------
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
function CenterSpinner() {
  return <div className="grid min-h-[200px] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
}
function EmptyBox({ msg, action }: { msg: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">{msg}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
function EmptyTickets() {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><Ticket className="h-5 w-5" /></span>
      <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">Create an event to enable ticketing.</p>
      <Button asChild className="mt-5" variant="hero"><Link to="/events/new"><Plus className="mr-2 h-4 w-4" />Create an event</Link></Button>
    </div>
  );
}

// ---------- Quick AI create ----------
function QuickCreate({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const create = useServerFn(createTicketType);
  const [busy, setBusy] = useState(false);

  async function go() {
    const parsed = parseTicketPrompt(text);
    if (!parsed) { toast.error('Try: "Create 200 reunion tickets for $35"'); return; }
    setBusy(true);
    try {
      await create({ data: { eventId, name: parsed.name, quantity: parsed.quantity ?? null, price_cents: parsed.price_cents } });
      toast.success(`Created "${parsed.name}"`);
      setText("");
      qc.invalidateQueries({ queryKey: ["ticket-types", eventId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create ticket");
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2 pl-1 text-xs uppercase tracking-widest text-primary">
        <Sparkles className="h-4 w-4" />MelaAssist
      </div>
      <Input
        placeholder='e.g. "Create 200 reunion tickets for $35"'
        value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        className="flex-1"
      />
      <Button onClick={go} disabled={busy || !text.trim()} size="sm">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
      </Button>
    </div>
  );
}

// ---------- Ticket type row ----------
function TypeRow({ row, eventId, onEdit, shareUrl }: { row: TicketTypeRow; eventId: string; onEdit: () => void; shareUrl: string }) {
  const qc = useQueryClient();
  const del = useServerFn(deleteTicketType);
  const upd = useServerFn(updateTicketType);
  const dup = useServerFn(duplicateTicketType);
  const remaining = row.quantity != null ? Math.max(0, row.quantity - (row.sold_count ?? 0)) : null;

  const toggle = useMutation({
    mutationFn: () => upd({ data: { id: row.id, is_active: !row.is_active } }),
    onSuccess: () => { toast.success(row.is_active ? "Sales paused" : "Sales resumed"); qc.invalidateQueries({ queryKey: ["ticket-types", eventId] }); },
  });
  const remove = useMutation({
    mutationFn: () => del({ data: { id: row.id } }),
    onSuccess: () => { toast.success("Ticket type removed"); qc.invalidateQueries({ queryKey: ["ticket-types", eventId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const duplicate = useMutation({
    mutationFn: () => dup({ data: { id: row.id } }),
    onSuccess: () => { toast.success("Duplicated (paused)"); qc.invalidateQueries({ queryKey: ["ticket-types", eventId] }); },
  });

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{row.name}</p>
          {!row.is_active && <Badge variant="secondary">Paused</Badge>}
          {row.visibility === "unlisted" && <Badge variant="outline">Unlisted</Badge>}
          {row.price_cents === 0 && <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Free</Badge>}
        </div>
        {row.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{row.description}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {money(row.price_cents, row.currency)} · sold {row.sold_count ?? 0}
          {row.quantity != null ? ` / ${row.quantity} (${remaining} left)` : " · unlimited"}
          {row.max_per_order ? ` · max ${row.max_per_order}/order` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => toggle.mutate()} className="min-w-[92px]">
          {row.is_active ? <><Pause className="mr-1.5 h-3.5 w-3.5" />Pause</> : <><Play className="mr-1.5 h-3.5 w-3.5" />Resume</>}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="More"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={onEdit}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => duplicate.mutate()}><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem>
            {shareUrl && (
              <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Purchase link copied"); }}>
                <Copy className="mr-2 h-4 w-4" />Copy purchase link
              </DropdownMenuItem>
            )}
            {shareUrl && (
              <DropdownMenuItem asChild>
                <a href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />View public page</a>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { if (confirm("Delete this ticket type?")) remove.mutate(); }}>
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ---------- Orders tab ----------
type OrderRow = {
  id: string; buyer_name: string | null; buyer_email: string; quantity: number;
  amount_cents: number; status: string; created_at: string;
  refund_amount_cents?: number | null;
  ticket_types: { name?: string } | null;
};
function OrdersTab({ orders, loading }: { orders: OrderRow[]; loading: boolean }) {
  const qc = useQueryClient();
  const resend = useServerFn(resendOrderConfirmation);
  const pdfFn = useServerFn(getOrderTicketsPdf);
  const [refundOrder, setRefundOrder] = useState<OrderRow | null>(null);

  const send = useMutation({
    mutationFn: (id: string) => resend({ data: { orderId: id, siteUrl: window.location.origin } }),
    onSuccess: (r) => toast.success(`Confirmation resent to ${r.email}`),
    onError: (e: Error) => toast.error(e.message),
  });

  async function downloadPdf(id: string) {
    try {
      const r = await pdfFn({ data: { orderId: id } });
      const bin = atob(r.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = r.filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not build PDF"); }
  }

  if (loading) return <CenterSpinner />;
  if (!orders.length) return <EmptyBox msg="No orders yet." />;
  const statusLabel = (s: string) =>
    s === "partially_refunded" ? "Partial refund" : s.replace(/_/g, " ");
  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
    s === "paid" ? "default" : s === "refunded" || s === "failed" ? "destructive" : "secondary";
  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3">Buyer</th><th className="p-3">Ticket</th><th className="p-3">Qty</th>
              <th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">When</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="p-3"><div className="font-medium">{o.buyer_name ?? "—"}</div><div className="text-xs text-muted-foreground">{o.buyer_email}</div></td>
                <td className="p-3">{o.ticket_types?.name ?? "—"}</td>
                <td className="p-3">{o.quantity}</td>
                <td className="p-3">
                  {money(o.amount_cents ?? 0)}
                  {(o.refund_amount_cents ?? 0) > 0 && (
                    <div className="text-[11px] text-muted-foreground">-{money(o.refund_amount_cents ?? 0)} refunded</div>
                  )}
                </td>
                <td className="p-3"><Badge variant={statusVariant(o.status)} className="capitalize">{statusLabel(o.status)}</Badge></td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</td>
                <td className="p-3 text-right">
                  {(o.status === "paid" || o.status === "partially_refunded") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Order actions"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => downloadPdf(o.id)}><Download className="mr-2 h-4 w-4" />Download tickets (PDF)</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => send.mutate(o.id)}><Mail className="mr-2 h-4 w-4" />Resend confirmation</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRefundOrder(o)}>
                          <Undo2 className="mr-2 h-4 w-4" />Refund…
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RefundDialog
        order={refundOrder}
        onClose={() => setRefundOrder(null)}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["ticket-orders"] });
          qc.invalidateQueries({ queryKey: ["ticket-attendees"] });
          qc.invalidateQueries({ queryKey: ["ticket-types"] });
        }}
      />
    </>
  );
}

function RefundDialog({ order, onClose, onDone }: { order: OrderRow | null; onClose: () => void; onDone: () => void }) {
  const refund = useServerFn(refundTicketOrder);
  const [full, setFull] = useState(true);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (order) {
      const max = (order.amount_cents - (order.refund_amount_cents ?? 0)) / 100;
      setAmount(max.toFixed(2)); setFull(true); setReason("");
    }
  }, [order]);

  if (!order) return null;
  const maxCents = order.amount_cents - (order.refund_amount_cents ?? 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const cents = full ? undefined : Math.round(Number(amount || "0") * 100);
      if (!full && (!cents || cents < 1 || cents > maxCents)) {
        toast.error(`Amount must be between $0.01 and $${(maxCents / 100).toFixed(2)}`); setBusy(false); return;
      }
      const env = getStripeEnvironment();
      const r = await refund({ data: { orderId: order!.id, amountCents: cents, reason: reason.trim() || undefined, environment: env } });
      toast.success(r.status === "refunded" ? "Order fully refunded" : "Partial refund issued");
      onDone(); onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refund failed");
    } finally { setBusy(false); }
  }
  return (
    <Dialog open={!!order} onOpenChange={(v) => { if (!busy && !v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Refund order</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <div><span className="text-muted-foreground">Buyer: </span>{order.buyer_name ?? order.buyer_email}</div>
            <div><span className="text-muted-foreground">Charged: </span>{money(order.amount_cents)}</div>
            <div><span className="text-muted-foreground">Refundable: </span>{money(maxCents)}</div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={full ? "default" : "outline"} onClick={() => setFull(true)}>Full refund</Button>
            <Button type="button" size="sm" variant={!full ? "default" : "outline"} onClick={() => setFull(false)}>Partial</Button>
          </div>
          {!full && (
            <div className="space-y-1.5">
              <Label htmlFor="r-amt">Refund amount (USD)</Label>
              <Input id="r-amt" type="number" min="0.01" step="0.01" max={(maxCents / 100).toFixed(2)} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="r-reason">Reason (optional)</Label>
            <Textarea id="r-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Shared with your records only" />
          </div>
          <p className="text-xs text-muted-foreground">Full refunds release inventory and remove attendees who haven't checked in.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Issue refund
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


// ---------- Attendees tab ----------
type AttendeeRow = {
  id: string; full_name: string | null; email: string | null;
  qr_code: string; checked_in_at: string | null; created_at: string;
};
function AttendeesTab({ attendees, loading, eventName }: { attendees: AttendeeRow[]; loading: boolean; eventName: string }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return attendees;
    return attendees.filter((a) =>
      (a.full_name ?? "").toLowerCase().includes(q) ||
      (a.email ?? "").toLowerCase().includes(q) ||
      a.qr_code.toLowerCase().includes(q),
    );
  }, [attendees, query]);

  function exportCsv() {
    const rows = [
      ["Name", "Email", "QR", "Checked in", "Created"],
      ...filtered.map((a) => [a.full_name ?? "", a.email ?? "", a.qr_code, a.checked_in_at ?? "", a.created_at]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${eventName.replace(/\s+/g, "-").toLowerCase()}-attendees.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <CenterSpinner />;
  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, email, or code" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="mr-2 h-4 w-4" />Export CSV
        </Button>
      </div>
      {!filtered.length ? <EmptyBox msg="No attendees match." /> : (
        <div className="space-y-2">{filtered.map((a) => <AttendeeItem key={a.id} row={a} />)}</div>
      )}
    </>
  );
}

function AttendeeItem({ row }: { row: AttendeeRow }) {
  const qc = useQueryClient();
  const checkIn = useServerFn(checkInAttendee);
  const undo = useServerFn(undoCheckInAttendee);
  const inMut = useMutation({
    mutationFn: () => checkIn({ data: { id: row.id } }),
    onSuccess: () => { toast.success("Checked in"); qc.invalidateQueries({ queryKey: ["ticket-attendees"] }); },
  });
  const undoMut = useMutation({
    mutationFn: () => undo({ data: { id: row.id } }),
    onSuccess: () => { toast.success("Check-in undone"); qc.invalidateQueries({ queryKey: ["ticket-attendees"] }); },
  });
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{row.full_name ?? "Guest"}</p>
        <p className="truncate text-xs text-muted-foreground">{row.email ?? "—"} · <span className="font-mono">{row.qr_code.slice(0, 8)}</span></p>
      </div>
      {row.checked_in_at ? (
        <div className="flex items-center gap-2">
          <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Checked in</Badge>
          <Button size="sm" variant="ghost" onClick={() => undoMut.mutate()}><Undo2 className="mr-1.5 h-3.5 w-3.5" />Undo</Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => inMut.mutate()}>Check in</Button>
      )}
    </div>
  );
}

// ---------- Analytics tab ----------
function AnalyticsTab({
  orders, types, attendees,
}: {
  orders: OrderRow[];
  types: TicketTypeRow[];
  attendees: AttendeeRow[];
}) {
  const paid = orders.filter((o) => o.status === "paid");
  const gross = paid.reduce((s, o) => s + (o.amount_cents ?? 0), 0);
  const net = Math.round(gross * 0.971 - paid.length * 30); // ~2.9% + 30¢ Stripe estimate
  const sold = types.reduce((s, t) => s + (t.sold_count ?? 0), 0);
  const capacity = types.reduce((s, t) => s + (t.quantity ?? 0), 0);
  const remaining = types.reduce((s, t) => s + (t.quantity != null ? Math.max(0, (t.quantity ?? 0) - (t.sold_count ?? 0)) : 0), 0);
  const checkedIn = attendees.filter((a) => a.checked_in_at).length;
  const checkinPct = attendees.length ? Math.round((checkedIn / attendees.length) * 100) : 0;

  // Sales-over-time: last 14 days
  const days = 14;
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    return { day: d.toISOString().slice(0, 10), cents: 0 };
  });
  const idx = new Map(buckets.map((b, i) => [b.day, i]));
  paid.forEach((o) => {
    const key = o.created_at.slice(0, 10);
    const i = idx.get(key); if (i != null) buckets[i].cents += o.amount_cents ?? 0;
  });
  const max = Math.max(1, ...buckets.map((b) => b.cents));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gross sales" value={money(gross)} />
        <Stat label="Net revenue (est.)" value={money(Math.max(0, net))} />
        <Stat label="Tickets sold" value={String(sold)} />
        <Stat label="Remaining" value={capacity ? `${remaining} / ${capacity}` : "Unlimited"} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Sales over time · last {days} days</p>
          <p className="text-xs text-muted-foreground">Gross</p>
        </div>
        <div className="mt-4 flex h-32 items-end gap-1">
          {buckets.map((b) => (
            <div key={b.day} className="group flex flex-1 flex-col items-center gap-1" title={`${b.day}: ${money(b.cents)}`}>
              <div className="w-full rounded-t bg-primary/70 transition group-hover:bg-primary" style={{ height: `${(b.cents / max) * 100}%`, minHeight: b.cents ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{buckets[0].day.slice(5)}</span><span>{buckets[buckets.length - 1].day.slice(5)}</span>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Check-in progress</p>
          <p className="text-xs text-muted-foreground">{checkedIn} / {attendees.length}</p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${checkinPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{checkinPct}% checked in</p>
      </div>
    </div>
  );
}

// ---------- Create / edit dialog ----------
function TicketTypeDialog({
  open, onOpenChange, eventId, existing,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; eventId: string; existing?: TicketTypeRow | null;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createTicketType);
  const update = useServerFn(updateTicketType);

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [price, setPrice] = useState(existing ? String(existing.price_cents / 100) : "");
  const [quantity, setQuantity] = useState(existing?.quantity != null ? String(existing.quantity) : "");
  const [maxPer, setMaxPer] = useState(String(existing?.max_per_order ?? 10));
  const [salesStart, setSalesStart] = useState(existing?.sales_start?.slice(0, 16) ?? "");
  const [salesEnd, setSalesEnd] = useState(existing?.sales_end?.slice(0, 16) ?? "");
  const [visibility, setVisibility] = useState<"public" | "unlisted">(existing?.visibility ?? "public");
  const [promo, setPromo] = useState(existing?.promo_code ?? "");
  const [busy, setBusy] = useState(false);

  // Re-init when `existing` changes
  useEffect(() => {
    setName(existing?.name ?? "");
    setDescription(existing?.description ?? "");
    setPrice(existing ? String(existing.price_cents / 100) : "");
    setQuantity(existing?.quantity != null ? String(existing.quantity) : "");
    setMaxPer(String(existing?.max_per_order ?? 10));
    setSalesStart(existing?.sales_start?.slice(0, 16) ?? "");
    setSalesEnd(existing?.sales_end?.slice(0, 16) ?? "");
    setVisibility(existing?.visibility ?? "public");
    setPromo(existing?.promo_code ?? "");
  }, [existing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const priceCents = Math.round(Number(price || "0") * 100);
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price_cents: priceCents,
        quantity: quantity ? Number(quantity) : null,
        max_per_order: Math.max(1, Math.min(100, Number(maxPer) || 10)),
        sales_start: salesStart ? new Date(salesStart).toISOString() : null,
        sales_end: salesEnd ? new Date(salesEnd).toISOString() : null,
        visibility,
        promo_code: promo.trim() || null,
      };
      if (existing) {
        await update({ data: { id: existing.id, ...payload } });
        toast.success("Ticket type updated");
      } else {
        await create({ data: { eventId, ...payload } });
        toast.success("Ticket type created");
      }
      await qc.invalidateQueries({ queryKey: ["ticket-types", eventId] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save ticket");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{existing ? "Edit ticket type" : "New ticket type"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-name">Ticket name</Label>
            <Input id="t-name" placeholder="e.g. Early Bird" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" rows={2} placeholder="Optional details shown to buyers" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-price">Price (USD) · 0 for free</Label>
              <Input id="t-price" type="number" min="0" step="0.01" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-qty">Quantity · blank = unlimited</Label>
              <Input id="t-qty" type="number" min="1" placeholder="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-max">Max per order</Label>
              <Input id="t-max" type="number" min="1" max="100" value={maxPer} onChange={(e) => setMaxPer(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-vis">Visibility</Label>
              <select id="t-vis" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "unlisted")}>
                <option value="public">Public — shown on purchase page</option>
                <option value="unlisted">Unlisted — only via direct link</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-start">Sales start</Label>
              <Input id="t-start" type="datetime-local" value={salesStart} onChange={(e) => setSalesStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-end">Sales end</Label>
              <Input id="t-end" type="datetime-local" value={salesEnd} onChange={(e) => setSalesEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-promo">Promo code (optional)</Label>
            <Input id="t-promo" placeholder="e.g. EARLY25" value={promo} onChange={(e) => setPromo(e.target.value)} />
            <p className="text-xs text-muted-foreground">When set, buyers must enter this code to purchase.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{existing ? "Save changes" : "Create ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
