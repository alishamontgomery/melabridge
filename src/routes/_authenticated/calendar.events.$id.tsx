import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Copy, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { getEvent, createEvent, updateEvent, cancelEvent, completeEvent, duplicateEvent, checkConflicts } from "@/lib/calendar.functions";

export const Route = createFileRoute("/_authenticated/calendar/events/$id")({
  head: () => ({ meta: [{ title: "Event — MelaBridge Calendar" }, { name: "robots", content: "noindex" }] }),
  component: EventDetailPage,
});

const STATUSES = ["inquiry", "pending", "confirmed", "completed", "cancelled", "declined"] as const;

function toLocalInput(iso: string | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EventDetailPage() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();

  const load = useServerFn(getEvent);
  const create = useServerFn(createEvent);
  const update = useServerFn(updateEvent);
  const cancel = useServerFn(cancelEvent);
  const complete = useServerFn(completeEvent);
  const dupe = useServerFn(duplicateEvent);
  const conflicts = useServerFn(checkConflicts);

  const q = useQuery({
    queryKey: ["cal-event", id],
    queryFn: () => load({ data: { id } }),
    enabled: !isNew,
  });

  const [form, setForm] = useState<any>({
    event_name: "",
    event_type: "",
    client_name: "",
    venue_name: "",
    address: "",
    starts_at: "",
    ends_at: "",
    setup_minutes: 0,
    breakdown_minutes: 0,
    status: "pending",
    internal_notes: "",
    payment_status: "",
    contract_status: "",
    revenue_amount: 0,
  });
  const [conflictList, setConflictList] = useState<any[]>([]);

  useEffect(() => {
    if (q.data) {
      setForm({
        ...q.data,
        starts_at: toLocalInput(q.data.starts_at),
        ends_at: toLocalInput(q.data.ends_at),
      });
    }
  }, [q.data]);

  async function runConflicts() {
    if (!form.starts_at || !form.ends_at) return;
    const res = await conflicts({
      data: {
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        setup_minutes: Number(form.setup_minutes) || 0,
        breakdown_minutes: Number(form.breakdown_minutes) || 0,
        excludeId: isNew ? undefined : id,
      },
    });
    setConflictList(res);
  }

  async function save() {
    const payload: any = {
      event_name: form.event_name,
      event_type: form.event_type || null,
      client_name: form.client_name || null,
      venue_name: form.venue_name || null,
      address: form.address || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      setup_minutes: Number(form.setup_minutes) || 0,
      breakdown_minutes: Number(form.breakdown_minutes) || 0,
      status: form.status,
      internal_notes: form.internal_notes || null,
      payment_status: form.payment_status || null,
      contract_status: form.contract_status || null,
      revenue_amount: Number(form.revenue_amount) || null,
    };
    try {
      if (isNew) {
        const out = await create({ data: payload });
        toast.success("Event created");
        navigate({ to: "/calendar/events/$id", params: { id: out.id } });
      } else {
        await update({ data: { ...payload, id } });
        toast.success("Saved");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const hardConflicts = conflictList.filter((c) => c.hard);

  return (
    <AppShell active="/calendar">
      <Link to="/calendar" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to calendar
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">{isNew ? "New event" : form.event_name || "Event"}</h1>
        <div className="flex flex-wrap gap-2">
          {!isNew && (
            <>
              <Button variant="outline" size="sm" onClick={async () => { await complete({ data: { id } }); toast.success("Marked complete"); q.refetch(); }}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Complete
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const out = await dupe({ data: { id, newStartsAt: new Date(form.starts_at).toISOString(), newEndsAt: new Date(form.ends_at).toISOString() } });
                  toast.success("Duplicated");
                  navigate({ to: "/calendar/events/$id", params: { id: out.id } });
                }}
              >
                <Copy className="mr-1 h-4 w-4" /> Duplicate
              </Button>
              <Button variant="ghost" size="sm" onClick={async () => { await cancel({ data: { id } }); toast.success("Cancelled"); q.refetch(); }}>
                <XCircle className="mr-1 h-4 w-4" /> Cancel
              </Button>
            </>
          )}
          <Button variant="hero" size="sm" onClick={save} disabled={hardConflicts.length > 0 && form.status === "confirmed"}>
            <Save className="mr-1 h-4 w-4" /> Save
          </Button>
        </div>
      </div>

      {conflictList.length > 0 && (
        <Card className={`mt-4 p-4 ${hardConflicts.length ? "border-rose-500/40 bg-rose-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className={`mt-0.5 h-4 w-4 ${hardConflicts.length ? "text-rose-600" : "text-amber-600"}`} />
            <div>
              <p className="text-sm font-medium">{hardConflicts.length ? "Conflicts block this booking" : "Warnings"}</p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {conflictList.map((c, i) => (
                  <li key={i}>{c.message} <Badge variant="outline" className="ml-1 text-[10px]">{c.reason}</Badge></li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-display text-lg font-semibold">Details</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Event name"><Input value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} /></Field>
            <Field label="Event type"><Input value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} placeholder="Wedding, Sangeet…" /></Field>
            <Field label="Client"><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></Field>
            <Field label="Venue"><Input value={form.venue_name} onChange={(e) => setForm({ ...form, venue_name: e.target.value })} /></Field>
            <Field label="Address" className="sm:col-span-2"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="Start"><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} onBlur={runConflicts} /></Field>
            <Field label="End"><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} onBlur={runConflicts} /></Field>
            <Field label="Setup (min)"><Input type="number" min={0} value={form.setup_minutes} onChange={(e) => setForm({ ...form, setup_minutes: e.target.value })} onBlur={runConflicts} /></Field>
            <Field label="Breakdown (min)"><Input type="number" min={0} value={form.breakdown_minutes} onChange={(e) => setForm({ ...form, breakdown_minutes: e.target.value })} onBlur={runConflicts} /></Field>
            <Field label="Internal notes" className="sm:col-span-2">
              <Textarea rows={3} value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold">Status & payment</h3>
          <div className="mt-4 space-y-3">
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Payment status"><Input value={form.payment_status ?? ""} onChange={(e) => setForm({ ...form, payment_status: e.target.value })} placeholder="Unpaid, Deposit, Paid…" /></Field>
            <Field label="Contract status"><Input value={form.contract_status ?? ""} onChange={(e) => setForm({ ...form, contract_status: e.target.value })} placeholder="Sent, Signed…" /></Field>
            <Field label="Revenue ($)"><Input type="number" min={0} value={form.revenue_amount ?? 0} onChange={(e) => setForm({ ...form, revenue_amount: e.target.value })} /></Field>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
