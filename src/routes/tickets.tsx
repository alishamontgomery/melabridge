import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Ticket, Plus, Loader2, Trash2, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useEcosystem } from "@/lib/ecosystem-store";
import {
  listTicketTypes,
  createTicketType,
  updateTicketType,
  deleteTicketType,
  listTicketOrders,
  listAttendees,
  checkInAttendee,
} from "@/lib/tickets.functions";

export const Route = createFileRoute("/tickets")({
  head: () => ({
    meta: [
      { title: "Tickets — MelaBridge" },
      { name: "description", content: "Create ticket tiers, sell online, and check guests in — all in your event workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TicketsPage,
});

function TicketsPage() {
  const { event, hasEvent } = useEcosystem();
  const [openAdd, setOpenAdd] = useState(false);

  const listTypes = useServerFn(listTicketTypes);
  const listOrders = useServerFn(listTicketOrders);
  const listAtt = useServerFn(listAttendees);

  const typesQ = useQuery({
    queryKey: ["ticket-types", event.id],
    enabled: !!event.id,
    queryFn: () => listTypes({ data: { eventId: event.id! } }),
  });
  const ordersQ = useQuery({
    queryKey: ["ticket-orders", event.id],
    enabled: !!event.id,
    queryFn: () => listOrders({ data: { eventId: event.id! } }),
  });
  const attQ = useQuery({
    queryKey: ["ticket-attendees", event.id],
    enabled: !!event.id,
    queryFn: () => listAtt({ data: { eventId: event.id! } }),
  });

  const types = typesQ.data ?? [];
  const orders = ordersQ.data ?? [];
  const attendees = attQ.data ?? [];

  const paidOrders = orders.filter((o: { status: string }) => o.status === "paid");
  const revenue = paidOrders.reduce((s: number, o: { amount_cents: number }) => s + (o.amount_cents ?? 0), 0);
  const sold = types.reduce((s: number, t: { sold_count?: number | null }) => s + (t.sold_count ?? 0), 0);
  const inventory = types.reduce(
    (s: number, t: { quantity?: number | null; sold_count?: number | null }) =>
      s + (t.quantity != null ? Math.max(0, (t.quantity ?? 0) - (t.sold_count ?? 0)) : 0),
    0,
  );

  const shareUrl = typeof window !== "undefined" && event.id ? `${window.location.origin}/tickets/${event.id}` : "";

  return (
    <AppShell active="/tickets">
      <PageHeader
        eyebrow="Tickets"
        icon={Ticket}
        title={<>Sell admissions <span className="text-gradient">from your event workspace</span>.</>}
        description={hasEvent ? `${event.name} · manage tiers, orders, and check-in.` : "Create an event first to enable ticketing."}
        actions={
          hasEvent ? (
            <div className="flex gap-2">
              {shareUrl && (
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    toast.success("Buy link copied");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />Copy buy link
                </Button>
              )}
              <Button variant="hero" onClick={() => setOpenAdd(true)}>
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
          <section className="mt-8 grid gap-3 md:grid-cols-4">
            <Stat label="Ticket types" value={String(types.length)} />
            <Stat label="Sold" value={String(sold)} />
            <Stat label="Revenue" value={`$${(revenue / 100).toLocaleString()}`} />
            <Stat label="Inventory left" value={inventory > 0 ? String(inventory) : "—"} />
          </section>

          <Tabs defaultValue="types" className="mt-6">
            <TabsList>
              <TabsTrigger value="types">Ticket types</TabsTrigger>
              <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
              <TabsTrigger value="attendees">Attendees ({attendees.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="types" className="mt-4">
              {typesQ.isLoading ? (
                <Center><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Center>
              ) : types.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
                  <p className="text-sm text-muted-foreground">No ticket types yet.</p>
                  <Button className="mt-4" variant="hero" onClick={() => setOpenAdd(true)}>
                    <Plus className="mr-2 h-4 w-4" />Create your first ticket
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {types.map((t) => <TypeRow key={t.id} row={t} eventId={event.id!} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="orders" className="mt-4">
              {ordersQ.isLoading ? <Center><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Center> :
               orders.length === 0 ? <Empty msg="No orders yet." /> : (
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr><th className="p-3">Buyer</th><th className="p-3">Ticket</th><th className="p-3">Qty</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">When</th></tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} className="border-t border-border">
                          <td className="p-3"><div className="font-medium">{o.buyer_name ?? "—"}</div><div className="text-xs text-muted-foreground">{o.buyer_email}</div></td>
                          <td className="p-3">{(o.ticket_types as { name?: string } | null)?.name ?? "—"}</td>
                          <td className="p-3">{o.quantity}</td>
                          <td className="p-3">${((o.amount_cents ?? 0) / 100).toLocaleString()}</td>
                          <td className="p-3"><Badge variant={o.status === "paid" ? "default" : "secondary"}>{o.status}</Badge></td>
                          <td className="p-3 text-xs text-muted-foreground">{new Date(o.created_at as string).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="attendees" className="mt-4">
              {attQ.isLoading ? <Center><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Center> :
               attendees.length === 0 ? <Empty msg="No attendees yet." /> : (
                <div className="space-y-2">
                  {attendees.map((a) => <AttendeeRow key={a.id} row={a} />)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {hasEvent && (
        <TicketTypeDialog open={openAdd} onOpenChange={setOpenAdd} eventId={event.id!} />
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
function Center({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-[200px] place-items-center">{children}</div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">{msg}</div>;
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

type TypeRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  quantity: number | null;
  sold_count: number | null;
  is_active: boolean;
};

function TypeRow({ row, eventId }: { row: TypeRow; eventId: string }) {
  const qc = useQueryClient();
  const del = useServerFn(deleteTicketType);
  const upd = useServerFn(updateTicketType);
  const remaining = row.quantity != null ? Math.max(0, row.quantity - (row.sold_count ?? 0)) : null;

  const toggle = useMutation({
    mutationFn: () => upd({ data: { id: row.id, is_active: !row.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket-types", eventId] }),
  });
  const remove = useMutation({
    mutationFn: () => del({ data: { id: row.id } }),
    onSuccess: () => { toast.success("Ticket type removed"); qc.invalidateQueries({ queryKey: ["ticket-types", eventId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{row.name}</p>
          {!row.is_active && <Badge variant="secondary">Paused</Badge>}
        </div>
        {row.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.description}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          ${(row.price_cents / 100).toLocaleString()} · sold {row.sold_count ?? 0}
          {row.quantity != null ? ` / ${row.quantity} (${remaining} left)` : " · unlimited"}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => toggle.mutate()}>{row.is_active ? "Pause" : "Activate"}</Button>
        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this ticket type?")) remove.mutate(); }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function AttendeeRow({ row }: { row: { id: string; full_name: string | null; email: string | null; qr_code: string; checked_in_at: string | null } }) {
  const qc = useQueryClient();
  const checkIn = useServerFn(checkInAttendee);
  const m = useMutation({
    mutationFn: () => checkIn({ data: { id: row.id } }),
    onSuccess: () => { toast.success("Checked in"); qc.invalidateQueries({ queryKey: ["ticket-attendees"] }); },
  });
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{row.full_name ?? "Guest"}</p>
        <p className="truncate text-xs text-muted-foreground">{row.email ?? "—"} · <span className="font-mono">{row.qr_code.slice(0, 8)}</span></p>
      </div>
      {row.checked_in_at ? (
        <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Checked in</Badge>
      ) : (
        <Button size="sm" variant="outline" onClick={() => m.mutate()}>Check in</Button>
      )}
    </div>
  );
}

function TicketTypeDialog({ open, onOpenChange, eventId }: { open: boolean; onOpenChange: (v: boolean) => void; eventId: string }) {
  const qc = useQueryClient();
  const create = useServerFn(createTicketType);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await create({
        data: {
          eventId,
          name: name.trim(),
          description: description.trim() || null,
          price_cents: Math.round(Number(price || "0") * 100),
          quantity: quantity ? Number(quantity) : null,
        },
      });
      toast.success("Ticket type created");
      await qc.invalidateQueries({ queryKey: ["ticket-types", eventId] });
      setName(""); setDescription(""); setPrice(""); setQuantity("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create ticket");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>New ticket type</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-name">Name</Label>
            <Input id="t-name" placeholder="e.g. Early Bird" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" rows={2} placeholder="Optional" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-price">Price (USD)</Label>
              <Input id="t-price" type="number" min="0" step="0.01" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-qty">Quantity (blank = unlimited)</Label>
              <Input id="t-qty" type="number" min="1" placeholder="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
