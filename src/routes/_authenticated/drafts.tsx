import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  CheckCircle2,
  Edit3,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  approveDraft,
  discardDraft,
  extractDraft,
  listDrafts,
  updateDraft,
  type ExtractedEvent,
} from "@/lib/event-drafts.functions";

export const Route = createFileRoute("/_authenticated/drafts")({
  head: () => ({
    meta: [
      { title: "AI Draft Inbox — MelaBridge" },
      {
        name: "description",
        content:
          "Review AI-drafted events from emails and messages. Approve, edit, or discard before creating anything.",
      },
    ],
  }),
  component: DraftsPage,
});

type DraftRow = Awaited<ReturnType<typeof listDrafts>>[number];

function confidenceBadge(c: number) {
  if (c >= 0.8)
    return { label: "High confidence", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
  if (c >= 0.5)
    return { label: "Medium confidence", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
  return { label: "Low confidence", cls: "bg-rose-500/10 text-rose-600 border-rose-500/20" };
}

const FIELDS: Array<{ key: keyof ExtractedEvent; label: string; type?: "date" | "time" | "number" | "text" }> = [
  { key: "name", label: "Event name" },
  { key: "event_type", label: "Type" },
  { key: "event_date", label: "Date", type: "date" },
  { key: "start_time", label: "Start", type: "time" },
  { key: "end_time", label: "End", type: "time" },
  { key: "client_name", label: "Client name" },
  { key: "client_email", label: "Client email" },
  { key: "client_phone", label: "Client phone" },
  { key: "guest_target", label: "Guests", type: "number" },
  { key: "deposit_required", label: "Deposit", type: "number" },
  { key: "location", label: "Location" },
  { key: "venue_city", label: "City" },
  { key: "venue_state", label: "State" },
  { key: "venue_zip", label: "Zip" },
];

function DraftsPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const list = useServerFn(listDrafts);
  const extract = useServerFn(extractDraft);
  const update = useServerFn(updateDraft);
  const approve = useServerFn(approveDraft);
  const discard = useServerFn(discardDraft);

  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rawInput, setRawInput] = useState("");
  const [extracting, setExtracting] = useState(false);

  const reload = useCallback(async () => {
    try {
      const rows = await list();
      setDrafts(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load drafts");
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pending = useMemo(
    () => drafts.filter((d) => d.status === "pending" || d.status === "edited"),
    [drafts],
  );
  const done = useMemo(
    () => drafts.filter((d) => d.status === "approved" || d.status === "discarded"),
    [drafts],
  );

  async function onExtract() {
    if (!rawInput.trim() || extracting) return;
    setExtracting(true);
    try {
      await extract({ data: { raw_input: rawInput.trim(), source: "manual_paste" } });
      setRawInput("");
      toast.success("Draft generated — review below");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not extract draft");
    } finally {
      setExtracting(false);
    }
  }

  async function onSave(id: string, extracted: ExtractedEvent) {
    setBusyId(id);
    try {
      await update({ data: { id, extracted } });
      toast.success("Draft updated");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onApprove(id: string) {
    setBusyId(id);
    try {
      const { eventId } = await approve({ data: { id } });
      toast.success("Event created");
      router.invalidate();
      navigate({ to: "/events/$eventId", params: { eventId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onDiscard(id: string) {
    setBusyId(id);
    try {
      await discard({ data: { id } });
      toast.message("Draft discarded");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Discard failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell active="/drafts">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          to="/vendor"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> MelaAssist™ draft inbox
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Review AI drafts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing is created automatically. Paste an email or message, and MelaAssist prepares
            an event draft for you to approve, edit, or discard.
          </p>
        </div>

        <Card className="p-5">
          <Label htmlFor="raw" className="text-sm font-medium">
            Paste an email, message, or voice memo transcript
          </Label>
          <Textarea
            id="raw"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={
              "e.g. Hi, we'd like to book you for our sangeet on Aug 22nd, 2026 at Rosewood Hall in Atlanta. Around 180 guests, starts 6pm. — Priya (priya@example.com, 555-0142)"
            }
            className="mt-2 min-h-[120px]"
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={onExtract} disabled={!rawInput.trim() || extracting}>
              <Wand2 className="mr-2 h-4 w-4" />
              {extracting ? "Extracting…" : "Extract draft"}
            </Button>
          </div>
        </Card>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Pending review ({pending.length})</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading drafts…</p>
          ) : pending.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No drafts waiting. Paste a message above to generate one.
            </Card>
          ) : (
            pending.map((d) => (
              <DraftCard
                key={d.id}
                draft={d}
                busy={busyId === d.id}
                onSave={(ex) => onSave(d.id, ex)}
                onApprove={() => onApprove(d.id)}
                onDiscard={() => onDiscard(d.id)}
              />
            ))
          )}
        </section>

        {done.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Recently handled</h2>
            <div className="grid gap-2">
              {done.slice(0, 10).map((d) => (
                <Card
                  key={d.id}
                  className="flex items-center justify-between p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {(d.extracted as ExtractedEvent)?.name ?? "Untitled"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.summary ?? d.raw_input?.slice(0, 100)}
                    </p>
                  </div>
                  <Badge variant={d.status === "approved" ? "default" : "secondary"}>
                    {d.status}
                  </Badge>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function DraftCard({
  draft,
  busy,
  onSave,
  onApprove,
  onDiscard,
}: {
  draft: DraftRow;
  busy: boolean;
  onSave: (ex: ExtractedEvent) => void;
  onApprove: () => void;
  onDiscard: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ExtractedEvent>(
    (draft.extracted as ExtractedEvent) ?? {},
  );
  const badge = confidenceBadge(Number(draft.confidence ?? 0));
  const fieldConf = (draft.field_confidences ?? {}) as Record<string, number>;
  const nextActions = (draft.suggested_next_actions ?? []) as string[];

  function set<K extends keyof ExtractedEvent>(k: K, v: ExtractedEvent[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">
            {form.name || "Untitled event"}
          </h3>
          {draft.summary && (
            <p className="mt-0.5 text-sm text-muted-foreground">{draft.summary}</p>
          )}
        </div>
        <Badge variant="outline" className={badge.cls}>
          {badge.label} · {Math.round(Number(draft.confidence ?? 0) * 100)}%
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const v = form[f.key];
          const conf = fieldConf[f.key as string];
          const low = typeof conf === "number" && conf < 0.5;
          return (
            <div key={String(f.key)} className="min-w-0">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground">
                  {f.label}
                </Label>
                {low && (
                  <span className="text-[10px] font-medium text-amber-600">needs review</span>
                )}
              </div>
              {editing ? (
                <Input
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "time" ? "time" : "text"}
                  value={v == null ? "" : String(v)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (f.type === "number") {
                      set(f.key, (val === "" ? null : Number(val)) as never);
                    } else {
                      set(f.key, (val === "" ? null : val) as never);
                    }
                  }}
                  className={low ? "border-amber-500/40" : ""}
                />
              ) : (
                <p
                  className={`mt-1 truncate text-sm ${low ? "text-amber-700" : ""}`}
                >
                  {v == null || v === "" ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    String(v)
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {nextActions.length > 0 && (
        <div className="mt-4 rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">Suggested next actions</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
            {nextActions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {editing ? (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setForm((draft.extracted as ExtractedEvent) ?? {});
                setEditing(false);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                onSave(form);
                setEditing(false);
              }}
              disabled={busy}
            >
              Save edits
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setEditing(true)} disabled={busy}>
            <Edit3 className="mr-2 h-4 w-4" /> Edit
          </Button>
        )}
        <Button variant="ghost" onClick={onDiscard} disabled={busy}>
          <Trash2 className="mr-2 h-4 w-4" /> Discard
        </Button>
        <Button onClick={onApprove} disabled={busy}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {busy ? "Working…" : "Approve & create event"}
        </Button>
      </div>
    </Card>
  );
}
