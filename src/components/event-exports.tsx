/**
 * EventExports — export buttons for event data.
 *
 * Basic guest CSV export is always available (planners already have this inline
 * in GuestsTab; this adds a dedicated exports panel).
 * Attendee list, budget summary, timeline, and vendor list are gated behind
 * the "exports" feature — free users see a lock and upgrade prompt.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Download, Users, Wallet, Clock, Store, Lock, Ticket, Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FeatureGate } from "@/components/feature-gate";
import { UpgradeModal } from "@/components/upgrade-modal";
import { listAttendees } from "@/lib/tickets.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useFeatureGate } from "@/hooks/use-feature-gate";

type Guest = Database["public"]["Tables"]["guests"]["Row"];
type BudgetItem = Database["public"]["Tables"]["budget_items"]["Row"];

function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function safeDate() {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  eventId: string;
  eventName: string;
  guests: Guest[];
  budget: BudgetItem[];
}

export function EventExports({ eventId, eventName, guests, budget }: Props) {
  const slug = eventName.replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
  const date = safeDate();
  const { allowed: exportsAllowed } = useFeatureGate("exports");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const listAttendeesFn = useServerFn(listAttendees);

  // ── Guest list (always available) ─────────────────────────────────────────
  function exportGuests() {
    const rows: string[][] = [["Name", "Email", "Household", "RSVP Status", "Plus-ones", "Meal Choice"]];
    guests.forEach((g) => rows.push([
      g.full_name ?? "", g.email ?? "", g.household ?? "",
      g.rsvp_status ?? "pending", String(g.plus_ones ?? 0), g.meal_choice ?? "",
    ]));
    download(`${slug}-GuestList-${date}.csv`, toCsv(rows));
  }

  // ── Attendee list (paid) ───────────────────────────────────────────────────
  async function exportAttendees() {
    if (!exportsAllowed) { setUpgradeOpen(true); return; }
    setLoading("attendees");
    try {
      const rows = await listAttendeesFn({ data: { eventId } });
      const csv = toCsv([
        ["Full Name", "Email", "QR Code", "Checked In At", "Order ID"],
        ...rows.map((a) => [
          a.full_name ?? "", a.email ?? "", a.qr_code ?? "",
          a.checked_in_at ? new Date(a.checked_in_at).toLocaleString() : "",
          a.order_id ?? "",
        ]),
      ]);
      download(`${slug}-AttendeeList-${date}.csv`, csv);
    } catch (e) {
      console.error(e);
    } finally { setLoading(null); }
  }

  // ── Budget summary (paid) ──────────────────────────────────────────────────
  function exportBudget() {
    if (!exportsAllowed) { setUpgradeOpen(true); return; }
    const rows: string[][] = [["Category", "Description", "Budgeted ($)", "Spent ($)", "Paid ($)"]];
    budget.forEach((b) => rows.push([
      b.category ?? "", b.label ?? "",
      String(Number(b.estimated_amount) || 0),
      String(Number(b.actual_amount) || 0),
      String(Number(b.paid_amount) || 0),
    ]));
    const totalEst = budget.reduce((s, b) => s + Number(b.estimated_amount), 0);
    const totalAct = budget.reduce((s, b) => s + Number(b.actual_amount), 0);
    const totalPaid = budget.reduce((s, b) => s + Number(b.paid_amount), 0);
    rows.push(["TOTAL", "", String(totalEst), String(totalAct), String(totalPaid)]);
    download(`${slug}-BudgetSummary-${date}.csv`, toCsv(rows));
  }

  // ── Timeline / runsheet (paid) ─────────────────────────────────────────────
  async function exportTimeline() {
    if (!exportsAllowed) { setUpgradeOpen(true); return; }
    setLoading("timeline");
    try {
      const { data: rows } = await supabase
        .from("event_runsheet_items")
        .select("title,start_time,duration_min,owner,status,notes")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false });
      const csv = toCsv([
        ["Start Time", "Title", "Duration (min)", "Owner", "Status", "Notes"],
        ...(rows ?? []).map((r) => [
          r.start_time ?? "", r.title ?? "", String(r.duration_min ?? ""),
          r.owner ?? "", r.status ?? "", r.notes ?? "",
        ]),
      ]);
      download(`${slug}-Runsheet-${date}.csv`, csv);
    } catch (e) {
      console.error(e);
    } finally { setLoading(null); }
  }

  // ── Vendor list (paid) ─────────────────────────────────────────────────────
  async function exportVendors() {
    if (!exportsAllowed) { setUpgradeOpen(true); return; }
    setLoading("vendors");
    try {
      const { data: rows } = await (supabase as any)
        .from("event_vendor_needs")
        .select("category,status,notes,priority")
        .eq("event_id", eventId)
        .order("category");
      const csv = toCsv([
        ["Category", "Status", "Priority", "Notes"],
        ...(rows ?? []).map((r: any) => [
          r.category ?? "", r.status ?? "",
          String(r.priority ?? ""), r.notes ?? "",
        ]),
      ]);
      download(`${slug}-VendorList-${date}.csv`, csv);
    } catch (e) {
      console.error(e);
    } finally { setLoading(null); }
  }

  return (
    <Card className="border-border/60 p-6 shadow-soft">
      <h3 className="mb-5 font-display text-lg font-semibold">Export event data</h3>
      <div className="space-y-2">
        <ExportRow
          icon={Users}
          label="Guest list"
          description="Name, email, RSVP status, dietary, plus-ones"
          format="CSV"
          loading={false}
          locked={false}
          onClick={exportGuests}
        />
        <ExportRow
          icon={Ticket}
          label="Attendee list"
          description="Checked-in attendees with ticket type and QR code"
          format="CSV"
          loading={loading === "attendees"}
          locked={!exportsAllowed}
          onClick={exportAttendees}
        />
        <ExportRow
          icon={Wallet}
          label="Budget summary"
          description="Categories, estimated, actual, and paid amounts"
          format="CSV"
          loading={false}
          locked={!exportsAllowed}
          onClick={exportBudget}
        />
        <ExportRow
          icon={Clock}
          label="Timeline / runsheet"
          description="Run-of-show with start times, durations, and owners"
          format="CSV"
          loading={loading === "timeline"}
          locked={!exportsAllowed}
          onClick={exportTimeline}
        />
        <ExportRow
          icon={Store}
          label="Vendor list"
          description="Vendor categories, booking status, priority, and notes"
          format="CSV"
          loading={loading === "vendors"}
          locked={!exportsAllowed}
          onClick={exportVendors}
        />
      </div>

      {!exportsAllowed && (
        <p className="mt-4 text-xs text-muted-foreground">
          <Lock className="mr-1 inline h-3 w-3" />
          Attendee, budget, timeline, and vendor exports require a paid plan.{" "}
          <button
            type="button"
            className="font-medium text-primary underline"
            onClick={() => setUpgradeOpen(true)}
          >
            Upgrade
          </button>
        </p>
      )}

      <UpgradeModal feature="exports" open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </Card>
  );
}

interface ExportRowProps {
  icon: typeof Users;
  label: string;
  description: string;
  format: string;
  loading: boolean;
  locked: boolean;
  onClick: () => void;
}

function ExportRow({ icon: Icon, label, description, format, loading, locked, onClick }: ExportRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Badge variant="secondary" className="shrink-0 text-[10px]">{format}</Badge>
      <Button
        type="button"
        size="sm"
        variant={locked ? "outline" : "ghost"}
        disabled={loading}
        onClick={onClick}
        className="shrink-0 gap-1.5"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : locked ? (
          <><Lock className="h-3.5 w-3.5" /> Upgrade</>
        ) : (
          <><Download className="h-3.5 w-3.5" /> Download</>
        )}
      </Button>
    </div>
  );
}
