import { useState } from "react";
import { Check, Loader2, Pencil, RotateCw, Wand2, X, Copy, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { MelaAssistAction } from "./types";
import { getActionMeta } from "./action-registry";

export function ActionCard({
  action,
  onApprove,
  onEditSave,
  onRegenerate,
  onCancel,
}: {
  action: MelaAssistAction;
  onApprove: () => Promise<void> | void;
  onEditSave: (nextPayload: Record<string, unknown>) => void;
  onRegenerate: () => void;
  onCancel: () => void;
}) {
  const meta = getActionMeta(action.kind);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(() => renderPayloadAsText(action.payload));
  const [running, setRunning] = useState(false);

  const isDone = action.status === "executed";
  const isFailed = action.status === "failed";
  const isCancelled = action.status === "cancelled";
  const isTerminal = isDone || isCancelled;

  async function approve() {
    setRunning(true);
    try {
      await onApprove();
    } finally {
      setRunning(false);
    }
  }

  function saveEdit() {
    onEditSave(parseTextToPayload(draft, action.payload));
    setEditing(false);
  }

  function copyDraft() {
    void navigator.clipboard.writeText(draft);
    toast.success("Copied to clipboard");
  }

  return (
    <div
      className={`rounded-2xl border p-3 text-sm shadow-soft ${
        isFailed
          ? "border-destructive/40 bg-destructive/5"
          : isDone
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-primary">
              <Wand2 className="h-3 w-3" />
            </span>
            <p className="font-medium leading-tight">{action.title || meta.label}</p>
            {action.previewOnly && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                Preview
              </Badge>
            )}
            {isDone && (
              <Badge className="h-5 bg-emerald-500/15 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                Approved
              </Badge>
            )}
            {isFailed && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                Failed
              </Badge>
            )}
            {isCancelled && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
                Cancelled
              </Badge>
            )}
          </div>
          {action.summary && (
            <p className="mt-1 text-xs text-muted-foreground">{action.summary}</p>
          )}
        </div>
      </div>

      <div className="mt-2">
        {editing ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[110px] resize-y text-xs"
          />
        ) : (
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-2 text-[12px] leading-snug text-foreground/90">
            {draft}
          </pre>
        )}
      </div>

      {isFailed && action.error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
          <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
          {action.error}
        </p>
      )}

      {!isTerminal && (
        <>
          <p className="mt-2 text-[11px] text-muted-foreground">{meta.approvalCopy}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {editing ? (
              <>
                <Button size="sm" onClick={saveEdit} className="h-7 gap-1 px-2 text-xs">
                  <Check className="h-3 w-3" /> Save edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  Cancel edit
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="hero"
                  onClick={approve}
                  disabled={running}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  {running ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  {action.previewOnly ? "Accept preview" : "Approve"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(true)}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onRegenerate}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <RotateCw className="h-3 w-3" /> Regenerate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyDraft}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Copy className="h-3 w-3" /> Copy
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCancel}
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                >
                  <X className="h-3 w-3" /> Cancel
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function renderPayloadAsText(payload: Record<string, unknown>): string {
  // Prefer common single-string fields to keep editing natural.
  const preferred = ["text", "content", "description", "notes", "body", "message"];
  for (const key of preferred) {
    const v = payload[key];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function parseTextToPayload(text: string, original: Record<string, unknown>): Record<string, unknown> {
  // If the original had a single preferred text field, put the edit back there.
  const preferred = ["text", "content", "description", "notes", "body", "message"];
  for (const key of preferred) {
    if (typeof original[key] === "string") return { ...original, [key]: text };
  }
  // Otherwise try JSON, then fall back to storing under `text`.
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return { ...original, text };
}
