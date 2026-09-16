import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEcosystem } from "@/lib/ecosystem-store";
import { supabase } from "@/integrations/supabase/client";
import {
  Wallet,
  Plus,
  Loader2,
  Pencil,
  AlertTriangle,
  Trash2,
  ChevronDown,
  Sparkles,
  Check,
} from "lucide-react";
import { ModuleError, ModuleLoading, RouteError } from "@/components/module-states";
import { toast } from "sonner";
import { parseCurrency } from "@/lib/parse-currency";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/budget")({
  head: () => ({
    meta: [
      { title: "Budget — MelaBridge" },
      { name: "description", content: "Track your event spending and payments." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BudgetPage,
  errorComponent: RouteError,
});

// ── Types ──────────────────────────────────────────────────────────────────────

type BudgetItem = {
  id: string;
  category: string | null;
  label: string | null;
  estimated_amount: number | null;
  actual_amount: number | null;
  paid_amount: number | null;
  vendor_name: string | null;
};

// ── Category chips ─────────────────────────────────────────────────────────────

const CATEGORY_CHIPS = [
  "Photography",
  "Venue",
  "Catering",
  "Music/DJ",
  "Florals",
  "Cake",
  "Attire",
  "Beauty",
  "Transport",
  "Stationery",
  "Decor",
  "Other",
] as const;

// ── Natural-language parser ────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Photography: ["photo", "photographer", "videograph", "video", "shoot"],
  Venue: ["venue", "hall", "ballroom", "location", "space", "room", "site"],
  Catering: ["cater", "food", "catering", "meal", "dinner", "lunch", "buffet", "bar", "beverages", "drink"],
  "Music/DJ": ["dj", "music", "band", "orchestra", "musician", "entertainment", "disco"],
  Florals: ["floral", "florals", "flowers", "bouquet", "arrangement", "centerpiece", "petals"],
  Cake: ["cake", "dessert", "bakery", "cupcakes", "pastry"],
  Attire: ["dress", "suit", "attire", "gown", "tux", "tuxedo", "outfit", "alterations", "bridal"],
  Beauty: ["beauty", "hair", "makeup", "stylist", "salon", "glam"],
  Transport: ["transport", "limo", "car", "vehicle", "shuttle", "driver", "coach", "bus"],
  Stationery: ["stationery", "invitations", "invitation", "card", "menu", "program", "print"],
  Decor: ["decor", "decoration", "lighting", "rental", "chair", "table", "linen", "backdrop"],
};

function inferCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some((kw) => lower.includes(kw))) return cat;
  }
  return "";
}

interface ParsedItem {
  label: string;
  category: string;
  cost: number | null;
  paid: number | null;
}

function parseNaturalLanguage(text: string): ParsedItem | null {
  if (!text.trim()) return null;

  // Extract all dollar amounts in order
  const amounts: number[] = [];
  const amountRe = /\$[\d,]+(?:\.\d{1,2})?/g;
  let m: RegExpExecArray | null;
  while ((m = amountRe.exec(text)) !== null) {
    const n = parseCurrency(m[0]);
    if (n !== null) amounts.push(n);
  }
  if (amounts.length === 0) return null;

  const cost: number | null = amounts[0];
  let paid: number | null = null;

  const lower = text.toLowerCase();
  if (/paid\s+in\s+full|fully\s+paid|100\s*%/.test(lower)) {
    paid = cost;
  } else if (amounts.length >= 2) {
    // If "paid", "deposit", or "down" appears before the second amount
    if (/(?:paid|deposit|down\s+payment)[\s\S]*\$/.test(lower) || /\$[\s\S]*(?:paid|deposit)/.test(lower)) {
      paid = amounts[1];
    }
  }

  // Strip dollar amounts and payment qualifiers to get the label
  const label = text
    .replace(/\$[\d,]+(?:\.\d{1,2})?/g, "")
    .replace(/,?\s*paid\s+in\s+full/gi, "")
    .replace(/,?\s*fully\s+paid/gi, "")
    .replace(/,?\s*(?:paid|deposit|down\s+payment)\s+(?:of\s+)?/gi, "")
    .replace(/,?\s*100\s*%/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-–,\s]+|[-–,\s]+$/g, "")
    .trim();

  if (!label) return null;
  const category = inferCategory(label);
  return { label, category, cost, paid };
}

// ── Main page ─────────────────────────────────────────────────────────────────

function BudgetPage() {
  const { event, hasEvent, loading: eventLoading } = useEcosystem();
  const qc = useQueryClient();
  const [openAdd, setOpenAdd] = useState(false);
  const [openEditBudget, setOpenEditBudget] = useState(false);
  const [localBudget, setLocalBudget] = useState<number | null>(null);
  const budgetTarget = localBudget ?? event.budget;

  const q = useQuery({
    queryKey: ["budget-items", event.id],
    enabled: !!event.id,
    queryFn: async (): Promise<BudgetItem[]> => {
      const { data, error } = await supabase
        .from("budget_items")
        .select("id, category, label, estimated_amount, actual_amount, paid_amount, vendor_name")
        .eq("event_id", event.id!)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BudgetItem[];
    },
  });

  const items = useMemo(() => q.data ?? [], [q.data]);

  // ── Aggregates ───────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const map = new Map<string, { planned: number; paid: number }>();
    for (const it of items) {
      const key = it.category?.trim() || "Uncategorized";
      const cur = map.get(key) ?? { planned: 0, paid: 0 };
      cur.planned += Number(it.estimated_amount ?? 0);
      cur.paid += Number(it.paid_amount ?? 0);
      map.set(key, cur);
    }
    return Array.from(map, ([name, v]) => ({ name, ...v }));
  }, [items]);

  const totalPlanned = categories.reduce((s, c) => s + c.planned, 0);
  const totalPaid = categories.reduce((s, c) => s + c.paid, 0);
  const remaining = budgetTarget > 0 ? budgetTarget - totalPlanned : null;
  const overBudget = budgetTarget > 0 && totalPlanned > budgetTarget;
  const overBy = overBudget ? totalPlanned - budgetTarget : 0;
  const plannedPct = budgetTarget > 0 ? Math.min(100, Math.round((totalPlanned / budgetTarget) * 100)) : 0;

  async function saveBudgetTarget(newTarget: number) {
    if (!event.id) return;
    const { error } = await supabase.from("events").update({ budget_target: newTarget }).eq("id", event.id);
    if (error) { toast.error(error.message); return; }
    setLocalBudget(newTarget);
    toast.success("Budget updated");
    setOpenEditBudget(false);
  }

  const refetch = async () => { await qc.invalidateQueries({ queryKey: ["budget-items", event.id] }); };

  return (
    <AppShell active="/budget">
      <PageHeader
        eyebrow="Budget"
        icon={Wallet}
        title={<>Money, <span className="text-gradient">managed with intention</span>.</>}
        description={
          hasEvent
            ? `${event.name} · ${budgetTarget > 0 ? `$${budgetTarget.toLocaleString()} budget` : "No budget set"} · $${totalPaid.toLocaleString()} paid`
            : "Create an event to start tracking your budget."
        }
        actions={
          hasEvent ? (
            <Button variant="hero" onClick={() => setOpenAdd(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add expense
            </Button>
          ) : null
        }
      />

      {eventLoading || (hasEvent && q.isLoading) ? (
        <ModuleLoading rows={4} />
      ) : hasEvent && q.isError ? (
        <ModuleError error={q.error} onRetry={() => q.refetch()} />
      ) : !hasEvent ? (
        <EmptyBudget message="Create an event to start tracking your budget." />
      ) : items.length === 0 ? (
        <>
          {budgetTarget === 0 && (
            <Card className="mt-8 border-primary/20 bg-primary/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">No budget set</p>
                  <p className="text-sm text-muted-foreground">Set your total budget so you can track how much you have left.</p>
                </div>
                <Button onClick={() => setOpenEditBudget(true)} className="gap-1.5">
                  <Pencil className="h-4 w-4" /> Set budget
                </Button>
              </div>
            </Card>
          )}
          <EmptyBudget
            message="No expenses yet. Add your first item to start tracking."
            action={
              <Button className="mt-5" variant="hero" onClick={() => setOpenAdd(true)}>
                <Plus className="mr-2 h-4 w-4" />Add expense
              </Button>
            }
          />
        </>
      ) : (
        <>
          {/* Over-budget banner */}
          {overBudget && (
            <Card className="mt-8 border-destructive/40 bg-destructive/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    You're ${overBy.toLocaleString()} over budget
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Planned spend is ${totalPlanned.toLocaleString()} against a ${budgetTarget.toLocaleString()} budget.{" "}
                    <button
                      onClick={() => setOpenEditBudget(true)}
                      className="underline hover:text-foreground"
                    >
                      Increase budget
                    </button>{" "}
                    or remove some expenses.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Stat cards */}
          <section className={`${overBudget ? "mt-4" : "mt-8"} grid gap-3 grid-cols-2 md:grid-cols-4`}>
            {/* Budget with inline edit */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Total budget</p>
                <button
                  type="button"
                  onClick={() => setOpenEditBudget(true)}
                  className="rounded-md p-0.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  aria-label="Edit budget target"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 font-display text-2xl font-semibold">
                {budgetTarget > 0 ? `$${budgetTarget.toLocaleString()}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {budgetTarget > 0 ? `${plannedPct}% planned` : "Select to set a target"}
              </p>
            </div>

            <Stat
              label="Planned"
              value={`$${totalPlanned.toLocaleString()}`}
              sub={`${categories.length} ${categories.length === 1 ? "category" : "categories"}`}
            />
            <Stat
              label="Paid"
              value={`$${totalPaid.toLocaleString()}`}
              sub="Cleared so far"
            />
            <Stat
              label="Remaining"
              value={remaining !== null ? `${remaining < 0 ? "−" : ""}$${Math.abs(remaining).toLocaleString()}` : "—"}
              sub={budgetTarget > 0 ? (overBudget ? "Over budget" : "Left to spend") : "Set a budget first"}
              valueClassName={overBudget ? "text-destructive" : undefined}
            />
          </section>

          {/* Budget progress bar */}
          {budgetTarget > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>${totalPlanned.toLocaleString()} planned of ${budgetTarget.toLocaleString()}</span>
                {overBudget ? (
                  <span className="font-medium text-destructive">Over budget</span>
                ) : (
                  <span>${Math.max(0, budgetTarget - totalPlanned).toLocaleString()} remaining</span>
                )}
              </div>
              <Progress
                value={plannedPct}
                className={overBudget ? "[&>div]:bg-destructive" : ""}
              />
              {!overBudget && plannedPct >= 80 && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span><strong>Nearly there.</strong> You have ${Math.max(0, budgetTarget - totalPlanned).toLocaleString()} left in the plan.</span>
                </div>
              )}
            </div>
          )}

          {/* Categories stay open so common amount edits never require a modal. */}
          <section className="mt-6 space-y-3">
            {categories.map((c) => {
              const paidPct = c.planned > 0 ? Math.min(100, Math.round((c.paid / c.planned) * 100)) : 0;
              const fullyPaid = paidPct >= 100;
              const categoryItems = items.filter((it) => (it.category?.trim() || "Uncategorized") === c.name);
              return (
                <div
                  key={c.name}
                  className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/20 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ${c.planned.toLocaleString()} planned
                        {c.paid > 0 && ` · $${c.paid.toLocaleString()} paid`}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        fullyPaid
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : paidPct > 0
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                          : "border border-border bg-background text-muted-foreground"
                      }`}
                    >
                      {fullyPaid ? "Paid in full" : paidPct > 0 ? `${paidPct}% paid` : "Nothing paid"}
                    </span>
                  </div>
                  <div className="divide-y divide-border/70">
                    {categoryItems.map((item) => (
                      <ItemRow key={item.id} item={item} eventId={event.id!} onSaved={refetch} />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}

      {/* Dialogs */}
      {hasEvent && (
        <AddExpenseDialog
          open={openAdd}
          onOpenChange={setOpenAdd}
          eventId={event.id!}
          onAdded={refetch}
          budgetTarget={budgetTarget}
          totalPlanned={totalPlanned}
        />
      )}

      {hasEvent && openEditBudget && (
        <EditBudgetDialog
          current={budgetTarget}
          onClose={() => setOpenEditBudget(false)}
          onSave={saveBudgetTarget}
        />
      )}
    </AppShell>
  );
}

// ── Shared stat card ───────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  sub,
  valueClassName,
}: {
  label: string;
  value: string;
  sub: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${valueClassName ?? ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyBudget({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Wallet className="h-5 w-5" />
      </span>
      <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{message}</p>
      {action ?? (
        <Button asChild className="mt-5" variant="hero">
          <Link to="/events/new">
            <Plus className="mr-2 h-4 w-4" />Create an event
          </Link>
        </Button>
      )}
    </div>
  );
}

// ── Inline-editable amount ─────────────────────────────────────────────────────

function InlineAmount({
  value,
  onSave,
  ariaLabel,
}: {
  value: number;
  onSave: (n: number) => void;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEdit() {
    setDraft(value > 0 ? String(value) : "");
    setEditing(true);
  }

  function commit() {
    const n = parseCurrency(draft);
    if (n !== null) onSave(n);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        inputMode="decimal"
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-8 w-full rounded-lg border border-primary bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder="0"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      aria-label={ariaLabel ? `Edit ${ariaLabel}` : undefined}
      className="group flex h-8 w-full items-center rounded-lg border border-transparent px-2 text-sm font-medium transition hover:border-border hover:bg-accent"
    >
      <span>${value.toLocaleString()}</span>
      <Pencil className="ml-auto h-3 w-3 opacity-0 transition group-hover:opacity-40" />
    </button>
  );
}

// ── Item row inside category dialog ────────────────────────────────────────────

function ItemRow({
  item,
  eventId,
  onSaved,
}: {
  item: BudgetItem;
  eventId: string;
  onSaved: () => Promise<void>;
}) {
  const cost = Number(item.estimated_amount ?? 0);
  const paid = Number(item.paid_amount ?? 0);
  const paidPct = cost > 0 ? Math.min(100, Math.round((paid / cost) * 100)) : 0;
  const [deleting, setDeleting] = useState(false);

  async function handleCostSave(n: number) {
    // Only update estimated_amount — actual_amount is managed separately by
    // downstream consumers (dashboard, exports, event-comms) for "spent" tracking.
    const { error } = await supabase
      .from("budget_items")
      .update({ estimated_amount: n })
      .eq("id", item.id)
      .eq("event_id", eventId);
    if (error) { toast.error(error.message); return; }
    await onSaved();
  }

  async function handlePaidSave(n: number) {
    const { error } = await supabase
      .from("budget_items")
      .update({ paid_amount: n })
      .eq("id", item.id)
      .eq("event_id", eventId);
    if (error) { toast.error(error.message); return; }
    await onSaved();
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase
      .from("budget_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("event_id", eventId);
    if (error) { toast.error(error.message); setDeleting(false); return; }
    await onSaved();
  }

  return (
    <div className="space-y-2 bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.label ?? "Untitled"}</p>
          {item.vendor_name && (
            <p className="truncate text-xs text-muted-foreground">{item.vendor_name}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Remove expense"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cost</p>
          <InlineAmount value={cost} onSave={handleCostSave} ariaLabel={`cost for ${item.label}`} />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Paid</p>
          <InlineAmount value={paid} onSave={handlePaidSave} ariaLabel={`amount paid for ${item.label}`} />
        </div>
      </div>

      {cost > 0 && (
        <Progress value={paidPct} className="h-1" />
      )}
    </div>
  );
}

// ── Category editor dialog ─────────────────────────────────────────────────────

function CategoryEditorDialog({
  open,
  onOpenChange,
  category,
  items,
  eventId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: string;
  items: BudgetItem[];
  eventId: string;
  onChanged: () => Promise<void>;
}) {
  const totalCost = items.reduce((s, it) => s + Number(it.estimated_amount ?? 0), 0);
  const totalPaid = items.reduce((s, it) => s + Number(it.paid_amount ?? 0), 0);
  const paidPct = totalCost > 0 ? Math.round((totalPaid / totalCost) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{category}</DialogTitle>
        </DialogHeader>

        {/* Mini stats */}
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Total cost"
            value={`$${totalCost.toLocaleString()}`}
            sub={`${items.length} item${items.length === 1 ? "" : "s"}`}
          />
          <Stat
            label="Paid"
            value={`$${totalPaid.toLocaleString()}`}
            sub={totalCost > 0 ? `${paidPct}% of total` : "Nothing paid yet"}
          />
        </div>

        {totalCost > 0 && (
          <Progress value={paidPct} className="h-1.5" />
        )}

        <p className="text-[11px] text-muted-foreground">
          Tap any amount below to edit it inline.
        </p>

        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses in this category.</p>
          ) : (
            items.map((it) => (
              <ItemRow key={it.id} item={it} eventId={eventId} onSaved={onChanged} />
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add expense dialog ─────────────────────────────────────────────────────────

function AddExpenseDialog({
  open,
  onOpenChange,
  eventId,
  onAdded,
  budgetTarget,
  totalPlanned,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  onAdded: () => Promise<void>;
  budgetTarget: number;
  totalPlanned: number;
}) {
  const { user } = useAuth();
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [cost, setCost] = useState("");
  const [alreadyPaid, setAlreadyPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [nlText, setNlText] = useState("");
  const [parsed, setParsed] = useState<ParsedItem | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setLabel(""); setCategory(""); setCost(""); setAlreadyPaid("");
    setNotes(""); setDueDate(""); setNlText(""); setParsed(null);
    setMoreOpen(false);
  }

  function handleNlChange(text: string) {
    setNlText(text);
    setParsed(text.trim() ? parseNaturalLanguage(text) : null);
  }

  function applyParsed() {
    if (!parsed) return;
    setLabel(parsed.label);
    if (parsed.category) setCategory(parsed.category);
    if (parsed.cost !== null) setCost(String(parsed.cost));
    if (parsed.paid !== null) setAlreadyPaid(String(parsed.paid));
    setNlText(""); setParsed(null);
  }

  async function submit() {
    if (!label.trim()) { toast.error("Description is required"); return; }
    setBusy(true);
    try {
      const parsedCost = parseCurrency(cost) ?? 0;
      const parsedPaid = parseCurrency(alreadyPaid) ?? 0;

      if (budgetTarget > 0 && totalPlanned + parsedCost > budgetTarget) {
        toast.warning(
          `Adding this will put you $${(totalPlanned + parsedCost - budgetTarget).toLocaleString()} over your $${budgetTarget.toLocaleString()} budget.`
        );
      }

      const combinedNotes = [
        notes.trim(),
        dueDate ? `Due: ${dueDate}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const { error } = await supabase.from("budget_items").insert({
        event_id: eventId,
        category: category.trim() || "Uncategorized",
        label: label.trim(),
        estimated_amount: parsedCost,
        actual_amount: 0, // managed separately — not written from the simplified UI
        paid_amount: parsedPaid,
        notes: combinedNotes || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;

      toast.success("Expense added");
      await onAdded();
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add expense");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) { onOpenChange(v); if (!v) reset(); }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* MelaAssist natural-language entry */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Quick entry — just describe it
            </div>
            <Textarea
              rows={2}
              placeholder={`e.g. "Photographer $3,000, paid $800 deposit"`}
              value={nlText}
              onChange={(e) => handleNlChange(e.target.value)}
              className="resize-none text-sm"
            />
            {parsed && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-2">
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{parsed.label}</span>
                  {parsed.category && ` · ${parsed.category}`}
                  {parsed.cost !== null && ` · $${parsed.cost.toLocaleString()}`}
                  {parsed.paid !== null && ` · paid $${parsed.paid.toLocaleString()}`}
                </p>
                <Button
                  size="sm"
                  onClick={applyParsed}
                  className="h-6 shrink-0 gap-1 px-2 text-xs"
                >
                  <Check className="h-3 w-3" /> Use this
                </Button>
              </div>
            )}
            {nlText.trim() && !parsed && (
              <p className="text-[11px] text-muted-foreground">
                Include a dollar amount (e.g. $500) to auto-fill the fields below.
              </p>
            )}
          </div>

          {/* Category chips */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setCategory(chip === category ? "" : chip)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                    category === chip
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <Input
              placeholder="Or type a custom category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-label">
              What is this expense? <span className="text-destructive">*</span>
            </Label>
            <Input
              id="exp-label"
              placeholder="e.g. Grand Ballroom rental"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus={false}
            />
          </div>

          {/* Cost + already paid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-cost">Cost ($)</Label>
              <Input
                id="exp-cost"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-paid">Already paid ($)</Label>
              <Input
                id="exp-paid"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={alreadyPaid}
                onChange={(e) => setAlreadyPaid(e.target.value)}
              />
            </div>
          </div>

          {/* More options collapsible */}
          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`}
                />
                {moreOpen ? "Fewer options" : "More options (notes & due date)"}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="exp-due">Due date</Label>
                <Input
                  id="exp-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-notes">Notes</Label>
                <Textarea
                  id="exp-notes"
                  rows={2}
                  placeholder="Optional context"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => { onOpenChange(false); reset(); }}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !label.trim()} className="gap-1.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Add expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit budget target dialog ──────────────────────────────────────────────────

function EditBudgetDialog({
  current,
  onClose,
  onSave,
}: {
  current: number;
  onClose: () => void;
  onSave: (n: number) => Promise<void>;
}) {
  const [value, setValue] = useState(current > 0 ? String(current) : "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseCurrency(value);
    if (n === null) { toast.error("Enter a valid budget amount"); return; }
    setSaving(true);
    await onSave(n);
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set your budget</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="budget-target">Total budget ($)</Label>
            <Input
              id="budget-target"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 50000"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              This is your total spending ceiling. You'll see a warning when planned expenses get close.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !value} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
